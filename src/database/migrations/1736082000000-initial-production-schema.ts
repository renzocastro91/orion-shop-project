import { MigrationInterface, QueryRunner, Table, TableForeignKey, TableIndex } from 'typeorm';

export class InitialProductionSchema1736082000000 implements MigrationInterface {
  name = 'InitialProductionSchema1736082000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    const isPostgres = queryRunner.connection.options.type === 'postgres';
    const uuidType = isPostgres ? 'uuid' : 'varchar';
    const textType = isPostgres ? 'text' : 'text';
    const timestampType = isPostgres ? 'timestamptz' : 'datetime';
    const nowDefault = isPostgres ? 'now()' : "datetime('now')";

    if (isPostgres) {
      await queryRunner.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
    }

    await queryRunner.createTable(
      new Table({
        name: 'users',
        columns: [
          { name: 'id', type: uuidType, isPrimary: true, isGenerated: true, generationStrategy: 'uuid' },
          { name: 'firstName', type: 'varchar', length: '80' },
          { name: 'lastName', type: 'varchar', length: '80' },
          { name: 'email', type: 'varchar', isUnique: true },
          { name: 'phone', type: 'varchar', length: '40', isNullable: true },
          { name: 'passwordHash', type: 'varchar', isNullable: true },
          { name: 'role', type: textType, default: "'buyer'" },
          { name: 'createdAt', type: timestampType, default: nowDefault },
          { name: 'updatedAt', type: timestampType, default: nowDefault },
        ],
      }),
      true,
    );

    await queryRunner.createTable(
      new Table({
        name: 'products',
        columns: [
          { name: 'id', type: uuidType, isPrimary: true, isGenerated: true, generationStrategy: 'uuid' },
          { name: 'name', type: 'varchar', length: '120' },
          { name: 'description', type: textType },
          { name: 'price', type: 'decimal', precision: 10, scale: 2 },
          { name: 'discountPercent', type: 'int', default: 0 },
          { name: 'imageUrl', type: 'varchar', isNullable: true },
          { name: 'isActive', type: 'boolean', default: true },
          { name: 'createdAt', type: timestampType, default: nowDefault },
          { name: 'updatedAt', type: timestampType, default: nowDefault },
        ],
      }),
      true,
    );

    await queryRunner.createTable(
      new Table({
        name: 'content_blocks',
        columns: [
          { name: 'id', type: uuidType, isPrimary: true, isGenerated: true, generationStrategy: 'uuid' },
          { name: 'title', type: 'varchar', length: '120' },
          { name: 'body', type: textType },
          { name: 'imageUrl', type: 'varchar', isNullable: true },
          { name: 'isActive', type: 'boolean', default: true },
          { name: 'createdAt', type: timestampType, default: nowDefault },
          { name: 'updatedAt', type: timestampType, default: nowDefault },
        ],
      }),
      true,
    );

    await queryRunner.createTable(
      new Table({
        name: 'app_settings',
        columns: [
          { name: 'key', type: 'varchar', length: '80', isPrimary: true },
          { name: 'value', type: textType },
          { name: 'updatedAt', type: timestampType, default: nowDefault },
        ],
      }),
      true,
    );

    await queryRunner.createTable(
      new Table({
        name: 'orders',
        columns: [
          { name: 'id', type: 'int', isPrimary: true, isGenerated: true, generationStrategy: 'increment' },
          { name: 'buyerId', type: uuidType },
          { name: 'items', type: textType },
          { name: 'total', type: 'decimal', precision: 10, scale: 2 },
          { name: 'isActive', type: 'boolean', default: true },
          { name: 'createdAt', type: timestampType, default: nowDefault },
        ],
      }),
      true,
    );

    await queryRunner.createForeignKey(
      'orders',
      new TableForeignKey({
        columnNames: ['buyerId'],
        referencedTableName: 'users',
        referencedColumnNames: ['id'],
        onDelete: 'RESTRICT',
      }),
    );

    await queryRunner.createIndex('orders', new TableIndex({ name: 'IDX_orders_isActive', columnNames: ['isActive'] }));
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('orders', true);
    await queryRunner.dropTable('app_settings', true);
    await queryRunner.dropTable('content_blocks', true);
    await queryRunner.dropTable('products', true);
    await queryRunner.dropTable('users', true);
  }
}
