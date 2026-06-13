import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { ProductsService } from '../../products/application/products.service';
import { SettingsService } from '../../settings/application/settings.service';
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
    private readonly settingsService: SettingsService,
    private readonly dataSource: DataSource,
  ) {}

  async create(buyerId: string, dto: CreateOrderDto) {
    const buyer = await this.usersService.findById(buyerId);
    const requestedItems = [...dto.items.reduce((map, item) => {
      map.set(item.productId, {
        productId: item.productId,
        quantity: (map.get(item.productId)?.quantity ?? 0) + item.quantity,
      });
      return map;
    }, new Map<string, { productId: string; quantity: number }>()).values()];
    const requestedIds = requestedItems.map((item) => item.productId);
    const products = await this.productsService.findActiveByIds(requestedIds);
    const byId = new Map(products.map((product: any) => [product.id, product]));

    const snapshots: OrderItemSnapshot[] = requestedItems.map((item) => {
      const product: any = byId.get(item.productId);
      if (!product) throw new BadRequestException('El pedido contiene productos no disponibles');
      if (product.stock < item.quantity) throw new BadRequestException(`Stock insuficiente para ${product.name}. Disponible: ${product.stock}`);

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

    const originalTotal = Number(snapshots.reduce((sum, item) => sum + item.subtotal, 0).toFixed(2));
    const { pesosPerPoint, cashbackPesos } = await this.settingsService.getPointsRate();
    const cashbackAvailable = dto.useCashback ? await this.cashbackAvailableForBuyer(buyerId, pesosPerPoint, cashbackPesos) : { rewardPesos: 0 };
    const cashbackDiscount = dto.useCashback ? Math.min(originalTotal, cashbackAvailable.rewardPesos) : 0;
    const total = Number((originalTotal - cashbackDiscount).toFixed(2));
    const order = this.orders.create({
      buyer,
      items: snapshots,
      originalTotal,
      cashbackDiscount,
      cashbackUsed: cashbackDiscount > 0,
      total,
      isActive: true,
      stockApplied: false,
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
        originalTotal: Number(order.originalTotal ?? order.total),
        cashbackDiscount: Number(order.cashbackDiscount ?? 0),
      }))
      .reverse();
  }

  async cashbackAvailableForBuyer(buyerId: string, pesosPerPoint?: number, cashbackPesos?: number) {
    if (pesosPerPoint === undefined || cashbackPesos === undefined) {
      const settings = await this.settingsService.getPointsRate();
      pesosPerPoint = settings.pesosPerPoint;
      cashbackPesos = settings.cashbackPesos;
    }
    const buyer = await this.usersService.findById(buyerId);
    const attendedOrders = await this.orders.find({ where: { buyer: { id: buyerId }, isActive: false } });
    const rewardBasePurchased = attendedOrders
      .filter((order) => !buyer.loyaltyResetAt || order.createdAt >= buyer.loyaltyResetAt)
      .reduce((sum, order) => sum + Number(order.total), 0);
    const points = Math.floor(rewardBasePurchased / pesosPerPoint);
    return {
      rewardBasePurchased: Number(rewardBasePurchased.toFixed(2)),
      points,
      rewardPesos: points * cashbackPesos,
    };
  }

  async buyerSummary(pesosPerPoint: number, cashbackPesos: number) {
    const buyers = await this.usersService.listBuyers();
    const attendedOrders = await this.orders.find({ where: { isActive: false } });
    const buyersById = new Map(buyers.map((buyer) => [buyer.id, buyer]));
    const totalsByBuyer = attendedOrders.reduce((map, order) => {
      const buyer = buyersById.get(order.buyer.id);
      if (!buyer) return map;
      const buyerId = buyer.id;
      map.set(buyerId, (map.get(buyerId) ?? 0) + Number(order.total));
      return map;
    }, new Map<string, number>());
    const rewardBaseByBuyer = attendedOrders.reduce((map, order) => {
      const buyer = buyersById.get(order.buyer.id);
      if (!buyer) return map;
      if (buyer.loyaltyResetAt && order.createdAt < buyer.loyaltyResetAt) return map;
      const buyerId = buyer.id;
      map.set(buyerId, (map.get(buyerId) ?? 0) + Number(order.total));
      return map;
    }, new Map<string, number>());

    return buyers
      .filter((buyer) => `${buyer.firstName} ${buyer.lastName}`.trim().toLowerCase() !== 'comprador historial')
      .map((buyer) => {
        const totalPurchased = Number((totalsByBuyer.get(buyer.id) ?? 0).toFixed(2));
        const rewardBasePurchased = Number((rewardBaseByBuyer.get(buyer.id) ?? 0).toFixed(2));
        const points = Math.floor(rewardBasePurchased / pesosPerPoint);
        return {
          id: buyer.id,
          firstName: buyer.firstName,
          lastName: buyer.lastName,
          email: buyer.email,
          phone: buyer.phone,
          totalPurchased,
          rewardBasePurchased,
          points,
          rewardPesos: points * cashbackPesos,
        };
      })
      .sort((a, b) => b.points - a.points || b.totalPurchased - a.totalPurchased || a.lastName.localeCompare(b.lastName));
  }

  async attend(id: number) {
    return this.dataSource.transaction(async (manager) => {
      const orders = manager.getRepository(OrderEntity);
      const order = await orders.findOne({ where: { id } });
      if (!order) throw new NotFoundException('Pedido no encontrado');
      if (!order.stockApplied) {
        await this.productsService.adjustStock(order.items, 'decrement', manager);
        order.stockApplied = true;
      }
      order.isActive = false;
      const saved = await orders.save(order);
      if (order.cashbackUsed) {
        await this.usersService.setLoyaltyResetAt(order.buyer.id, order.createdAt);
      }
      return saved;
    });
  }

  async reactivate(id: number, restoreStock: boolean) {
    return this.dataSource.transaction(async (manager) => {
      const orders = manager.getRepository(OrderEntity);
      const order = await orders.findOne({ where: { id } });
      if (!order) throw new NotFoundException('Pedido no encontrado');
      if (restoreStock && order.stockApplied) {
        await this.productsService.adjustStock(order.items, 'increment', manager);
        order.stockApplied = false;
      }
      order.isActive = true;
      return orders.save(order);
    });
  }

  async closeAttended(id: number) {
    const order = await this.orders.findOne({ where: { id } });
    if (!order) throw new NotFoundException('Pedido no encontrado');
    if (order.isActive) throw new ConflictException('Solo se pueden cerrar pedidos atendidos');
    await this.orders.remove(order);
    return { id, closed: true };
  }
}
