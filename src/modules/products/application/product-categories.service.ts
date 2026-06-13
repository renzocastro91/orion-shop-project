import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProductCategoryEntity } from '../domain/product-category.entity';
import { CreateProductCategoryDto, UpdateProductCategoryDto } from '../dto/product-category.dto';

@Injectable()
export class ProductCategoriesService {
  constructor(
    @InjectRepository(ProductCategoryEntity)
    private readonly categories: Repository<ProductCategoryEntity>,
  ) {}

  list(includeInactive = false) {
    return this.categories.find({
      where: includeInactive ? {} : { isActive: true },
      order: { name: 'ASC' },
    });
  }

  async findActiveById(id: string) {
    const category = await this.categories.findOne({ where: { id, isActive: true } });
    if (!category) throw new NotFoundException('Categoria no encontrada');
    return category;
  }

  async create(dto: CreateProductCategoryDto) {
    const name = dto.name.trim();
    const exists = await this.categories.findOne({ where: { name } });
    if (exists) throw new ConflictException('Ya existe una categoria con ese nombre');

    return this.categories.save(this.categories.create({
      name,
      description: dto.description?.trim() || null,
    }));
  }

  async update(id: string, dto: UpdateProductCategoryDto) {
    const category = await this.categories.findOne({ where: { id } });
    if (!category) throw new NotFoundException('Categoria no encontrada');

    if (dto.name !== undefined) {
      const name = dto.name.trim();
      const exists = await this.categories.findOne({ where: { name } });
      if (exists && exists.id !== id) throw new ConflictException('Ya existe una categoria con ese nombre');
      category.name = name;
    }

    category.description = dto.description?.trim() || null;
    category.isActive = dto.isActive == null ? category.isActive : dto.isActive === 'true';
    return this.categories.save(category);
  }

  async deactivate(id: string) {
    const category = await this.categories.findOne({ where: { id } });
    if (!category) throw new NotFoundException('Categoria no encontrada');
    category.isActive = false;
    return this.categories.save(category);
  }
}
