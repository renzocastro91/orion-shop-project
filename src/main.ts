import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import express from 'express';
import { join } from 'path';
import { AppModule } from './app.module';

let cachedServer: express.Express | null = null;

function configureApp(app: Awaited<ReturnType<typeof NestFactory.create>>) {
  app.enableCors();
  app.use('/uploads', express.static(join(process.cwd(), 'uploads')));
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );
}

async function createServer() {
  const server = express();
  const app = await NestFactory.create(AppModule, new ExpressAdapter(server));
  configureApp(app);
  await app.init();
  return server;
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  configureApp(app);

  const port = process.env.PORT || 3000;
  await app.listen(port);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  cachedServer ??= await createServer();
  return cachedServer(req, res);
}

if (!process.env.VERCEL) {
  bootstrap();
}
