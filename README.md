# Orion Shop

Sistema full-stack para tienda/empresa, hecho con NestJS, Postgres y frontend web servido desde el mismo backend.

## Funcionalidad

- Registro/login de clientes con nombre, apellido, email, telefono y password.
- Superusuario con permisos para:
  - cambiar fondo de pantalla, nombre de empresa y logo,
  - cargar globos informativos para Inicio con texto e imagen,
  - crear categorias de productos,
  - cargar productos con imagen, categoria, precio, descuento, stock e informacion ampliada,
  - agregar informacion extra/tutoriales en productos, incluyendo links de YouTube renderizados como enlaces con titulo,
  - ver pedidos activos y marcarlos como atendidos,
  - ver pedidos atendidos, reactivarlos o cerrarlos,
  - ver tabla de clientes con total comprado, base de cashback, puntos y pesos de regalo,
  - configurar pesos por punto y cashback por punto.
- Clientes con:
  - carrito, cantidades y generacion de pedido,
  - busqueda de productos desde la barra superior,
  - filtro por categoria,
  - uso opcional de cashback en el pedido,
  - historial de pedidos,
  - calificacion de productos comprados y atendidos.
- Productos:
  - tarjetas expandibles con informacion ampliada,
  - stock visible y bloqueo de compra si no hay stock,
  - promedio general de estrellas,
  - calificacion personal por cliente.
- Pedidos:
  - snapshot de productos, datos del cliente, total original, descuento por cashback y total final,
  - descuento efectivo de stock al marcar como Atendido,
  - restauracion opcional de stock al volver un pedido atendido a activo,
  - limpieza automatica de productos eliminados/inactivos en carritos abiertos.
- Cashback:
  - el total comprado general del cliente no se reinicia,
  - la base para puntos/cashback se reinicia cuando un pedido con cashback usado pasa a Atendido,
  - los nuevos puntos empiezan a contar desde la compra atendida que uso cashback.
- UI:
  - modo claro/oscuro con preferencia guardada,
  - tarjetas con hover visual,
  - layout responsive para escritorio y celular.

## Arquitectura

El backend esta organizado por modulos con separacion DDD liviana:

- `domain`: entidades del negocio.
- `application`: casos de uso y servicios.
- `dto`: contratos de entrada.
- controllers: API REST.

El frontend esta en `public/`:

- `index.html`: estructura de pantallas.
- `styles.css`: estilos responsive y modo oscuro.
- `app.js`: estado de sesion, llamadas API y render dinamico.

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

## Migraciones

La app usa TypeORM con `synchronize: false` y migraciones automaticas si `TYPEORM_MIGRATIONS_RUN=true`.

Migraciones actuales principales:

- esquema inicial de usuarios, productos, pedidos, contenido y settings,
- categorias de productos,
- stock de productos y marca de stock aplicado en pedidos,
- informacion ampliada y calificaciones de productos,
- cashback/redencion y reinicio de base de puntos por cliente.

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

Cuando existe un token de Vercel Blob (`BLOB_READ_WRITE_TOKEN` o una variable `BLOB_READ_WRITE_TOKEN_*` generada por Vercel), las imagenes se guardan en Vercel Blob. Si el store esta actualizado a OIDC, Vercel inyecta el token automaticamente y el proyecto necesita `BLOB_STORE_ID`.

Sin credenciales de Blob, las imagenes van a `uploads/`, solo recomendado para desarrollo local.

Para crear el superusuario en produccion:

```bash
npm run seed
```

## Deploy en Vercel

El proyecto incluye `vercel.json` y `src/main.ts` exporta un handler serverless para Vercel.

Configurar en Vercel:

- `DATABASE_URL` con Postgres.
- `BLOB_READ_WRITE_TOKEN` con Vercel Blob, o `BLOB_STORE_ID` si el store usa OIDC.
- `JWT_SECRET`, `ADMIN_EMAIL` y `ADMIN_PASSWORD`.
- `TYPEORM_MIGRATIONS_RUN=true`.

No usar `uploads/` locales en Vercel porque el filesystem serverless no es persistente.

## Scripts utiles

```bash
npm run build      # compila NestJS
npm run start:dev  # servidor local en modo watch
npm run seed       # crea superusuario inicial si no existe
```

## Archivos locales

- Imagenes subidas localmente se guardan en `uploads/`.
