import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddCashbackRedemption1736082400000 implements MigrationInterface {
  name = 'AddCashbackRedemption1736082400000';

  async up(queryRunner: QueryRunner): Promise<void> {
    const isPostgres = queryRunner.connection.options.type === 'postgres';
    const timestampType = isPostgres ? 'timestamptz' : 'datetime';

    if (!(await queryRunner.hasColumn('users', 'loyaltyResetAt'))) {
      await queryRunner.addColumn('users', new TableColumn({ name: 'loyaltyResetAt', type: timestampType, isNullable: true }));
    }
    if (!(await queryRunner.hasColumn('orders', 'originalTotal'))) {
      await queryRunner.addColumn('orders', new TableColumn({ name: 'originalTotal', type: 'decimal', precision: 10, scale: 2, isNullable: true }));
      await queryRunner.query('UPDATE orders SET "originalTotal" = total WHERE "originalTotal" IS NULL');
    }
    if (!(await queryRunner.hasColumn('orders', 'cashbackDiscount'))) {
      await queryRunner.addColumn('orders', new TableColumn({ name: 'cashbackDiscount', type: 'decimal', precision: 10, scale: 2, default: 0 }));
    }
    if (!(await queryRunner.hasColumn('orders', 'cashbackUsed'))) {
      await queryRunner.addColumn('orders', new TableColumn({ name: 'cashbackUsed', type: 'boolean', default: false }));
    }
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasColumn('orders', 'cashbackUsed')) await queryRunner.dropColumn('orders', 'cashbackUsed');
    if (await queryRunner.hasColumn('orders', 'cashbackDiscount')) await queryRunner.dropColumn('orders', 'cashbackDiscount');
    if (await queryRunner.hasColumn('orders', 'originalTotal')) await queryRunner.dropColumn('orders', 'originalTotal');
    if (await queryRunner.hasColumn('users', 'loyaltyResetAt')) await queryRunner.dropColumn('users', 'loyaltyResetAt');
  }
}
