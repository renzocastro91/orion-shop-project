import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { UserRole } from './common/roles';
import { AppModule } from './app.module';
import { UsersService } from './modules/users/application/users.service';

async function seed() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const usersService = app.get(UsersService);
  const config = app.get(ConfigService);

  const email = config.get<string>('ADMIN_EMAIL', 'admin@empresa.com');
  const password = config.get<string>('ADMIN_PASSWORD', 'admin1234');
  const exists = await usersService.findByEmail(email);

  if (!exists) {
    await usersService.create({
      firstName: 'Super',
      lastName: 'Usuario',
      email,
      phone: '0000000000',
      password,
      role: UserRole.SuperUser,
    });
    console.log(`Superusuario creado: ${email} / ${password}`);
  } else {
    console.log(`Superusuario ya existe: ${email}`);
  }

  await app.close();
}

seed();
