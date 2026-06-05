# Orion Shop

Sistema full-stack simple para empresa, hecho con NestJS, Postgres y frontend web servido desde el mismo backend.

## Funcionalidad

- Registro/login de compradores con nombre, apellido, email, telefono y password.
- Superusuario con permisos para:
  - cambiar el fondo de pantalla,
  - cargar globos informativos para Inicio con texto e imagen,
  - cargar productos con imagen, precio y porcentaje de descuento,
  - ver pedidos activos y marcarlos como atendidos,
  - ver pedidos atendidos y reactivarlos.
- Comprador con carrito, cantidades y generacion de pedido.
- Pedidos guardados con snapshot de productos, datos del comprador, total e `isActive`.

## Arquitectura

El backend esta organizado por modulos con separacion DDD liviana:

- `domain`: entidades del negocio.
- `application`: casos de uso y servicios.
- `dto`: contratos de entrada.
- controllers: API REST.

## Instalacion local

```bash
npm install
cp .env.example .env
npm run seed
npm run start:dev
```

Antes de `seed`, configurar `DATABASE_URL` apuntando a un Postgres local o alojado.

Para levantar un Postgres local con Docker:

```bash
docker compose up -d
```

El Postgres local queda publicado en `localhost:5433` para evitar conflictos con instalaciones existentes en el puerto `5432`.

Abrir:

```text
http://localhost:3000
```

Credenciales iniciales:

```text
admin@empresa.com / admin1234
```

## Produccion

Para produccion usar Postgres y storage persistente de imagenes:

```text
NODE_ENV=production
JWT_SECRET=un-secreto-largo-y-unico
DATABASE_URL=postgres://user:password@host:5432/database
DB_SSL=true
TYPEORM_MIGRATIONS_RUN=true
BLOB_READ_WRITE_TOKEN=vercel_blob_rw_xxx
# o, si el store esta actualizado a OIDC:
BLOB_STORE_ID=store_xxx
ADMIN_EMAIL=admin@empresa.com
ADMIN_PASSWORD=cambiar-antes-de-publicar
```

La app usa Postgres, tiene `synchronize` desactivado y ejecuta migraciones TypeORM. Cuando existe un token de Vercel Blob (`BLOB_READ_WRITE_TOKEN` o una variable `BLOB_READ_WRITE_TOKEN_*` generada por Vercel), las imagenes se guardan en Vercel Blob. Si el store esta actualizado a OIDC, Vercel inyecta el token automaticamente y el proyecto necesita `BLOB_STORE_ID`. Sin credenciales de Blob, las imagenes van a `uploads/`, solo recomendado para desarrollo local.

Para crear el superusuario en produccion:

```bash
npm run seed
```

## Archivos locales

- Imagenes subidas localmente se guardan en `uploads/`.

## Deploy en Vercel

El proyecto incluye `vercel.json` y `src/main.ts` exporta un handler serverless para Vercel. Configurar en Vercel:

- `DATABASE_URL` con Postgres.
- `BLOB_READ_WRITE_TOKEN` con Vercel Blob, o `BLOB_STORE_ID` si el store usa OIDC.
- `JWT_SECRET`, `ADMIN_EMAIL` y `ADMIN_PASSWORD`.

No usar `uploads/` locales en Vercel porque el filesystem serverless no es persistente.
