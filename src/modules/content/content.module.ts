import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ContentService } from './application/content.service';
import { ContentController } from './content.controller';
import { ContentBlockEntity } from './domain/content-block.entity';

@Module({
  imports: [TypeOrmModule.forFeature([ContentBlockEntity])],
  controllers: [ContentController],
  providers: [ContentService],
})
export class ContentModule {}
