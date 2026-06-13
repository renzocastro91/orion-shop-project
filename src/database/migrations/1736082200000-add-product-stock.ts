import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddProductStock1736082200000 implements MigrationInterface {
  name = 'AddProductStock1736082200000';

  async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasColumn('products', 'stock'))) {
      await queryRunner.addColumn('products', new TableColumn({ name: 'stock', type: 'int', default: 0 }));
    }

    if (!(await queryRunner.hasColumn('orders', 'stockApplied'))) {
      await queryRunner.addColumn('orders', new TableColumn({ name: 'stockApplied', type: 'boolean', default: false }));
    }
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasColumn('orders', 'stockApplied')) await queryRunner.dropColumn('orders', 'stockApplied');
    if (await queryRunner.hasColumn('products', 'stock')) await queryRunner.dropColumn('products', 'stock');
  }
}
