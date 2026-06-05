import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { CreateProductDto, UpdateProductDto } from '../dto/product.dto';
import { ProductEntity } from '../domain/product.entity';

@Injectable()
export class ProductsService {
  constructor(
    @InjectRepository(ProductEntity)
    private readonly products: Repository<ProductEntity>,
  ) {}

  async list(includeInactive = false) {
    const products = await this.products.find({
      where: includeInactive ? {} : { isActive: true },
      order: { createdAt: 'DESC' },
    });
    return products.map((product) => this.withFinalPrice(product));
  }

  async create(dto: CreateProductDto, imageUrl: string | null) {
    const product = this.products.create({
      name: dto.name,
      description: dto.description,
      price: Number(dto.price),
      discountPercent: dto.discountPercent ?? 0,
      imageUrl,
    });
    return this.withFinalPrice(await this.products.save(product));
  }

  async update(id: string, dto: UpdateProductDto, imageUrl?: string | null) {
    const product = await this.products.findOne({ where: { id } });
    if (!product) throw new NotFoundException('Producto no encontrado');

    product.name = dto.name ?? product.name;
    product.description = dto.description ?? product.description;
    product.price = dto.price ? Number(dto.price) : product.price;
    product.discountPercent = dto.discountPercent ?? product.discountPercent;
    product.isActive = dto.isActive == null ? product.isActive : dto.isActive === 'true';
    if (imageUrl !== undefined) product.imageUrl = imageUrl;

    return this.withFinalPrice(await this.products.save(product));
  }

  async deactivate(id: string) {
    const product = await this.products.findOne({ where: { id } });
    if (!product) throw new NotFoundException('Producto no encontrado');
    product.isActive = false;
    return this.withFinalPrice(await this.products.save(product));
  }

  async findActiveByIds(ids: string[]) {
    const products = await this.products.find({ where: { id: In(ids) } });
    return products.filter((product) => product.isActive);
  }

  private withFinalPrice(product: ProductEntity) {
    const price = Number(product.price);
    const discountAmount = price * (product.discountPercent / 100);
    return {
      ...product,
      price,
      finalPrice: Number((price - discountAmount).toFixed(2)),
    };
  }
}
