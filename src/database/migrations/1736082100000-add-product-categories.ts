import { MigrationInterface, QueryRunner, Table, TableColumn, TableForeignKey, TableIndex } from 'typeorm';

export class AddProductCategories1736082100000 implements MigrationInterface {
  name = 'AddProductCategories1736082100000';

  async up(queryRunner: QueryRunner): Promise<void> {
    const isPostgres = queryRunner.connection.options.type === 'postgres';
    const uuidType = isPostgres ? 'uuid' : 'varchar';
    const textType = isPostgres ? 'text' : 'text';
    const timestampType = isPostgres ? 'timestamptz' : 'datetime';
    const nowDefault = isPostgres ? 'now()' : "datetime('now')";

    if (isPostgres) {
      await queryRunner.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
    }

    if (!(await queryRunner.hasTable('product_categories'))) {
      await queryRunner.createTable(
        new Table({
          name: 'product_categories',
          columns: [
            { name: 'id', type: uuidType, isPrimary: true, isGenerated: true, generationStrategy: 'uuid' },
            { name: 'name', type: 'varchar', length: '80', isUnique: true },
            { name: 'description', type: textType, isNullable: true },
            { name: 'isActive', type: 'boolean', default: true },
            { name: 'createdAt', type: timestampType, default: nowDefault },
            { name: 'updatedAt', type: timestampType, default: nowDefault },
          ],
        }),
        true,
      );
    }

    if (!(await queryRunner.hasColumn('products', 'categoryId'))) {
      await queryRunner.addColumn('products', new TableColumn({ name: 'categoryId', type: uuidType, isNullable: true }));
    }

    const productsTable = await queryRunner.getTable('products');
    const hasCategoryFk = productsTable?.foreignKeys.some((fk) => fk.name === 'FK_products_category') ?? false;
    if (!hasCategoryFk) {
      await queryRunner.createForeignKey(
        'products',
        new TableForeignKey({
          name: 'FK_products_category',
          columnNames: ['categoryId'],
          referencedTableName: 'product_categories',
          referencedColumnNames: ['id'],
          onDelete: 'SET NULL',
        }),
      );
    }

    const hasCategoryIndex = productsTable?.indices.some((index) => index.name === 'IDX_products_categoryId') ?? false;
    if (!hasCategoryIndex) {
      await queryRunner.createIndex('products', new TableIndex({ name: 'IDX_products_categoryId', columnNames: ['categoryId'] }));
    }
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    const productsTable = await queryRunner.getTable('products');
    const categoryFk = productsTable?.foreignKeys.find((fk) => fk.name === 'FK_products_category');
    if (categoryFk) await queryRunner.dropForeignKey('products', categoryFk);
    const categoryIndex = productsTable?.indices.find((index) => index.name === 'IDX_products_categoryId');
    if (categoryIndex) await queryRunner.dropIndex('products', categoryIndex);
    if (await queryRunner.hasColumn('products', 'categoryId')) await queryRunner.dropColumn('products', 'categoryId');
    if (await queryRunner.hasTable('product_categories')) await queryRunner.dropTable('product_categories', true);
  }
}
