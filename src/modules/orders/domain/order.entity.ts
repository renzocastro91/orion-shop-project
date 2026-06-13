import { Column, CreateDateColumn, Entity, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { UserEntity } from '../../users/domain/user.entity';

export interface OrderItemSnapshot {
  productId: string;
  name: string;
  quantity: number;
  unitPrice: number;
  discountPercent: number;
  finalUnitPrice: number;
  subtotal: number;
}

@Entity('orders')
export class OrderEntity {
  @PrimaryGeneratedColumn('increment')
  id: number;

  @ManyToOne(() => UserEntity, { nullable: false, eager: true })
  buyer: UserEntity;

  @Column({ type: 'simple-json' })
  items: OrderItemSnapshot[];

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  total: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  originalTotal: number | null;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  cashbackDiscount: number;

  @Column({ default: false })
  cashbackUsed: boolean;

  @Column({ default: true })
  isActive: boolean;

  @Column({ default: false })
  stockApplied: boolean;

  @CreateDateColumn()
  createdAt: Date;
}
