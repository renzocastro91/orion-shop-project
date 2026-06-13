import { MigrationInterface, QueryRunner, Table, TableColumn, TableForeignKey, TableIndex, TableUnique } from 'typeorm';

export class AddProductExtraInfoAndRatings1736082300000 implements MigrationInterface {
  name = 'AddProductExtraInfoAndRatings1736082300000';

  async up(queryRunner: QueryRunner): Promise<void> {
    const isPostgres = queryRunner.connection.options.type === 'postgres';
    const uuidType = isPostgres ? 'uuid' : 'varchar';
    const textType = isPostgres ? 'text' : 'text';
    const timestampType = isPostgres ? 'timestamptz' : 'datetime';
    const nowDefault = isPostgres ? 'now()' : "datetime('now')";

    if (!(await queryRunner.hasColumn('products', 'extraInfo'))) {
      await queryRunner.addColumn('products', new TableColumn({ name: 'extraInfo', type: textType, isNullable: true }));
    }

    if (!(await queryRunner.hasTable('product_ratings'))) {
      await queryRunner.createTable(
        new Table({
          name: 'product_ratings',
          columns: [
            { name: 'id', type: uuidType, isPrimary: true, isGenerated: true, generationStrategy: 'uuid' },
            { name: 'productId', type: uuidType },
            { name: 'buyerId', type: uuidType },
            { name: 'rating', type: 'int' },
            { name: 'createdAt', type: timestampType, default: nowDefault },
            { name: 'updatedAt', type: timestampType, default: nowDefault },
          ],
        }),
        true,
      );

      await queryRunner.createUniqueConstraint('product_ratings', new TableUnique({
        name: 'UQ_product_ratings_product_buyer',
        columnNames: ['productId', 'buyerId'],
      }));
      await queryRunner.createIndex('product_ratings', new TableIndex({ name: 'IDX_product_ratings_productId', columnNames: ['productId'] }));
      await queryRunner.createForeignKey('product_ratings', new TableForeignKey({
        name: 'FK_product_ratings_product',
        columnNames: ['productId'],
        referencedTableName: 'products',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }));
      await queryRunner.createForeignKey('product_ratings', new TableForeignKey({
        name: 'FK_product_ratings_buyer',
        columnNames: ['buyerId'],
        referencedTableName: 'users',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }));
    }
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('product_ratings')) await queryRunner.dropTable('product_ratings', true);
    if (await queryRunner.hasColumn('products', 'extraInfo')) await queryRunner.dropColumn('products', 'extraInfo');
  }
}
