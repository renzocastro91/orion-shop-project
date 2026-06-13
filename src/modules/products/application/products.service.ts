import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import { EntityManager, In, Repository } from 'typeorm';
import { OrderEntity } from '../../orders/domain/order.entity';
import { CreateProductDto, UpdateProductDto } from '../dto/product.dto';
import { ProductCategoriesService } from './product-categories.service';
import { ProductEntity } from '../domain/product.entity';
import { ProductRatingEntity } from '../domain/product-rating.entity';

@Injectable()
export class ProductsService {
  constructor(
    @InjectRepository(ProductEntity)
    private readonly products: Repository<ProductEntity>,
    @InjectRepository(ProductRatingEntity)
    private readonly ratings: Repository<ProductRatingEntity>,
    @InjectRepository(OrderEntity)
    private readonly orders: Repository<OrderEntity>,
    private readonly categoriesService: ProductCategoriesService,
    private readonly jwtService: JwtService,
  ) {}

  async list(includeInactive = false, userId?: string, authHeader?: string) {
    const products = await this.products.find({
      where: includeInactive ? {} : { isActive: true },
      relations: { category: true },
      order: { createdAt: 'DESC' },
    });
    const ratingStats = await this.ratingStats(products.map((product) => product.id));
    const resolvedUserId = userId ?? this.userIdFromAuthHeader(authHeader);
    const myRatings = await this.myRatingMap(products.map((product) => product.id), resolvedUserId);
    return products.map((product) => this.withFinalPrice(product, ratingStats.get(product.id), myRatings.get(product.id) ?? 0));
  }

  async create(dto: CreateProductDto, imageUrl: string | null) {
    const category = dto.categoryId ? await this.categoriesService.findActiveById(dto.categoryId) : null;
    const product = this.products.create({
      name: dto.name,
      description: dto.description,
      extraInfo: dto.extraInfo?.trim() || null,
      price: Number(dto.price),
      discountPercent: dto.discountPercent ?? 0,
      stock: dto.stock ?? 0,
      imageUrl,
      categoryId: category?.id ?? null,
      category,
    });
    return this.withFinalPrice(await this.products.save(product));
  }

  async update(id: string, dto: UpdateProductDto, imageUrl?: string | null) {
    const product = await this.products.findOne({ where: { id }, relations: { category: true } });
    if (!product) throw new NotFoundException('Producto no encontrado');

    product.name = dto.name ?? product.name;
    product.description = dto.description ?? product.description;
    product.extraInfo = dto.extraInfo === undefined ? product.extraInfo : dto.extraInfo.trim() || null;
    product.price = dto.price ? Number(dto.price) : product.price;
    product.discountPercent = dto.discountPercent ?? product.discountPercent;
    product.stock = dto.stock ?? product.stock;
    if (dto.categoryId !== undefined) {
      const category = dto.categoryId ? await this.categoriesService.findActiveById(dto.categoryId) : null;
      product.categoryId = category?.id ?? null;
      product.category = category;
    }
    product.isActive = dto.isActive == null ? product.isActive : dto.isActive === 'true';
    if (imageUrl !== undefined) product.imageUrl = imageUrl;

    return this.withFinalPrice(await this.products.save(product));
  }

  async deactivate(id: string) {
    const product = await this.products.findOne({ where: { id }, relations: { category: true } });
    if (!product) throw new NotFoundException('Producto no encontrado');
    product.isActive = false;
    return this.withFinalPrice(await this.products.save(product));
  }

  async findActiveByIds(ids: string[]) {
    const products = await this.products.find({ where: { id: In(ids) }, relations: { category: true } });
    return products.filter((product) => product.isActive);
  }

  async adjustStock(items: { productId: string; quantity: number }[], direction: 'decrement' | 'increment', manager?: EntityManager) {
    const totals = items.reduce((map, item) => {
      map.set(item.productId, (map.get(item.productId) ?? 0) + item.quantity);
      return map;
    }, new Map<string, number>());
    const ids = [...totals.keys()];
    const repository = manager?.getRepository(ProductEntity) ?? this.products;
    const products = await repository.find({ where: { id: In(ids) } });
    const byId = new Map(products.map((product) => [product.id, product]));

    for (const [productId, quantity] of totals) {
      const product = byId.get(productId);
      if (!product) throw new NotFoundException(`Producto no encontrado: ${productId}`);

      if (direction === 'decrement' && product.stock < quantity) {
        throw new BadRequestException(`Stock insuficiente para ${product.name}. Disponible: ${product.stock}`);
      }
    }

    for (const [productId, quantity] of totals) {
      const product = byId.get(productId)!;
      product.stock += direction === 'increment' ? quantity : -quantity;
    }

    await repository.save(products);
  }

  async rateProduct(productId: string, buyerId: string, rating: number) {
    const product = await this.products.findOne({ where: { id: productId, isActive: true } });
    if (!product) throw new NotFoundException('Producto no encontrado');

    const buyerOrders = await this.orders.find({ where: { buyer: { id: buyerId } } });
    const boughtProduct = buyerOrders.some((order) => !order.isActive && order.items.some((item) => item.productId === productId));
    if (!boughtProduct) throw new BadRequestException('Solo podes calificar productos de pedidos atendidos');

    let productRating = await this.ratings.findOne({ where: { productId, buyerId } });
    if (!productRating) {
      productRating = this.ratings.create({ productId, buyerId, rating });
    } else {
      productRating.rating = rating;
    }

    await this.ratings.save(productRating);
    const stats = await this.ratingStats([productId]);
    return {
      productId,
      rating,
      ...stats.get(productId),
    };
  }

  private async ratingStats(productIds: string[]) {
    const stats = new Map<string, { ratingAverage: number; ratingAverageExact: number; ratingCount: number }>();
    productIds.forEach((id) => stats.set(id, { ratingAverage: 0, ratingAverageExact: 0, ratingCount: 0 }));
    if (!productIds.length) return stats;

    const ratings = await this.ratings.find({ where: { productId: In(productIds) } });
    const grouped = ratings.reduce((map, item) => {
      const current = map.get(item.productId) ?? { total: 0, count: 0 };
      current.total += item.rating;
      current.count += 1;
      map.set(item.productId, current);
      return map;
    }, new Map<string, { total: number; count: number }>());

    grouped.forEach((value, productId) => {
      const exact = value.total / value.count;
      stats.set(productId, {
        ratingAverage: Math.round(exact),
        ratingAverageExact: Number(exact.toFixed(1)),
        ratingCount: value.count,
      });
    });

    return stats;
  }

  private async myRatingMap(productIds: string[], buyerId?: string) {
    const ratings = new Map<string, number>();
    if (!buyerId || !productIds.length) return ratings;

    const rows = await this.ratings.find({ where: { buyerId, productId: In(productIds) } });
    rows.forEach((row) => ratings.set(row.productId, row.rating));
    return ratings;
  }

  private userIdFromAuthHeader(authHeader?: string) {
    const [, token] = String(authHeader || '').split(' ');
    if (!token) return undefined;
    try {
      const payload: any = this.jwtService.verify(token);
      return payload.sub;
    } catch (_error) {
      return undefined;
    }
  }

  private withFinalPrice(product: ProductEntity, rating?: { ratingAverage: number; ratingAverageExact: number; ratingCount: number }, myRating = 0) {
    const price = Number(product.price);
    const discountAmount = price * (product.discountPercent / 100);
    return {
      ...product,
      price,
      stock: Number(product.stock),
      finalPrice: Number((price - discountAmount).toFixed(2)),
      ratingAverage: rating?.ratingAverage ?? 0,
      ratingAverageExact: rating?.ratingAverageExact ?? 0,
      ratingCount: rating?.ratingCount ?? 0,
      myRating,
    };
  }
}
