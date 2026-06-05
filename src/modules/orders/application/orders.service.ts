import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProductsService } from '../../products/application/products.service';
import { UsersService } from '../../users/application/users.service';
import { CreateOrderDto } from '../dto/order.dto';
import { OrderEntity, OrderItemSnapshot } from '../domain/order.entity';

@Injectable()
export class OrdersService {
  constructor(
    @InjectRepository(OrderEntity)
    private readonly orders: Repository<OrderEntity>,
    private readonly productsService: ProductsService,
    private readonly usersService: UsersService,
  ) {}

  async create(buyerId: string, dto: CreateOrderDto) {
    const buyer = await this.usersService.findById(buyerId);
    const requestedIds = dto.items.map((item) => item.productId);
    const products = await this.productsService.findActiveByIds(requestedIds);
    const byId = new Map(products.map((product: any) => [product.id, product]));

    const snapshots: OrderItemSnapshot[] = dto.items.map((item) => {
      const product: any = byId.get(item.productId);
      if (!product) throw new BadRequestException('El pedido contiene productos no disponibles');

      const price = Number(product.price);
      const finalUnitPrice = Number((price - price * (product.discountPercent / 100)).toFixed(2));
      return {
        productId: product.id,
        name: product.name,
        quantity: item.quantity,
        unitPrice: price,
        discountPercent: product.discountPercent,
        finalUnitPrice,
        subtotal: Number((finalUnitPrice * item.quantity).toFixed(2)),
      };
    });

    const total = snapshots.reduce((sum, item) => sum + item.subtotal, 0);
    const order = this.orders.create({
      buyer,
      items: snapshots,
      total: Number(total.toFixed(2)),
      isActive: true,
    });

    return this.orders.save(order);
  }

  async list(active: boolean) {
    return this.orders.find({
      where: { isActive: active },
      order: { createdAt: 'DESC' },
    });
  }

  async listByBuyer(buyerId: string) {
    const orders = await this.orders.find({
      where: { buyer: { id: buyerId } },
      order: { createdAt: 'ASC' },
    });

    return orders
      .map((order, index) => ({
        ...order,
        buyerOrderNumber: index + 1,
        total: Number(order.total),
      }))
      .reverse();
  }

  async setActive(id: number, isActive: boolean) {
    const order = await this.orders.findOne({ where: { id } });
    if (!order) throw new NotFoundException('Pedido no encontrado');
    order.isActive = isActive;
    return this.orders.save(order);
  }

  async closeAttended(id: number) {
    const order = await this.orders.findOne({ where: { id } });
    if (!order) throw new NotFoundException('Pedido no encontrado');
    if (order.isActive) throw new ConflictException('Solo se pueden cerrar pedidos atendidos');
    await this.orders.remove(order);
    return { id, closed: true };
  }
}
