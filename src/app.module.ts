import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ServeStaticModule } from '@nestjs/serve-static';
import { TypeOrmModule } from '@nestjs/typeorm';
import { join } from 'path';
import { InitialProductionSchema1736082000000 } from './database/migrations/1736082000000-initial-production-schema';
import { AuthModule } from './modules/auth/auth.module';
import { ContentModule } from './modules/content/content.module';
import { OrdersModule } from './modules/orders/orders.module';
import { ProductsModule } from './modules/products/products.module';
import { SettingsModule } from './modules/settings/settings.module';
import { UsersModule } from './modules/users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const databaseUrl = config.get<string>('DATABASE_URL');
        const isProduction = config.get<string>('NODE_ENV') === 'production';

        if (!databaseUrl) {
          throw new Error('DATABASE_URL es requerido. Usa Postgres local o alojado para ejecutar la app.');
        }

        return {
          type: 'postgres',
          url: databaseUrl,
          ssl: config.get<string>('DB_SSL', isProduction ? 'true' : 'false') === 'true' ? { rejectUnauthorized: false } : false,
          autoLoadEntities: true,
          synchronize: false,
          migrations: [InitialProductionSchema1736082000000],
          migrationsRun: config.get<string>('TYPEORM_MIGRATIONS_RUN', 'true') === 'true',
        };
      },
    }),
    ServeStaticModule.forRoot(
      {
        rootPath: join(process.cwd(), 'public'),
        exclude: ['/api/*path', '/uploads/*path'],
      },
    ),
    UsersModule,
    AuthModule,
    ProductsModule,
    OrdersModule,
    ContentModule,
    SettingsModule,
  ],
})
export class AppModule {}
