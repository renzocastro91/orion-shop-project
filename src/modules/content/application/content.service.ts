import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ContentBlockEntity } from '../domain/content-block.entity';
import { CreateContentBlockDto, UpdateContentBlockDto } from '../dto/content.dto';

@Injectable()
export class ContentService {
  constructor(
    @InjectRepository(ContentBlockEntity)
    private readonly blocks: Repository<ContentBlockEntity>,
  ) {}

  list(includeInactive = false) {
    return this.blocks.find({
      where: includeInactive ? {} : { isActive: true },
      order: { createdAt: 'DESC' },
    });
  }

  create(dto: CreateContentBlockDto, imageUrl: string | null) {
    return this.blocks.save(this.blocks.create({ ...dto, imageUrl }));
  }

  async update(id: string, dto: UpdateContentBlockDto, imageUrl?: string | null) {
    const block = await this.blocks.findOne({ where: { id } });
    if (!block) throw new NotFoundException('Bloque no encontrado');

    block.title = dto.title ?? block.title;
    block.body = dto.body ?? block.body;
    block.isActive = dto.isActive == null ? block.isActive : dto.isActive === 'true';
    if (imageUrl !== undefined) block.imageUrl = imageUrl;

    return this.blocks.save(block);
  }

  async deactivate(id: string) {
    const block = await this.blocks.findOne({ where: { id } });
    if (!block) throw new NotFoundException('Bloque no encontrado');
    block.isActive = false;
    return this.blocks.save(block);
  }
}
