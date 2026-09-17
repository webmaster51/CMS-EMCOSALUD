# Instalación

## Requisitos

- **Node.js 22 LTS** o superior.
- Para el entorno completo: **Docker + Docker Compose** (PostgreSQL, MinIO, correo).
- Sin Docker: se puede usar el modo embebido (`DB_DRIVER=pglite`, `STORAGE_DRIVER=fs`).

## 1. Configuración

```bash
cp .env.example .env
```

Edita `.env`. Mínimo indispensable:

| Variable | Valor |
| --- | --- |
| `AUTH_SECRET` | 32+ caracteres aleatorios: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `SEED_SUPERADMIN_EMAIL` / `SEED_SUPERADMIN_PASSWORD` | Credenciales del primer superadmin |
| `DATABASE_URL` | Cadena de conexión PostgreSQL (modo `pg`) |
| `STORAGE_*` | MinIO/S3 (modo `s3`) |

Modos de desarrollo:

- **Rápido, sin Docker**: `DB_DRIVER=pglite`, `STORAGE_DRIVER=fs`,
  `STORAGE_PUBLIC_URL=http://localhost:4321/media`.
- **Completo**: `DB_DRIVER=pg`, `STORAGE_DRIVER=s3`, y `docker compose up -d`.

## 2. Dependencias y base de datos

```bash
npm install
npm run db:migrate     # aplica ./drizzle/*.sql
npm run seed           # portales base, patrones de certificados y superadmin
```

> Genera nuevas migraciones tras cambiar `src/lib/db/schema.ts` con `npm run db:generate`.
> En desarrollo con PGlite, `npm run db:reset` borra `.data/`, migra y siembra.

## 3. Arranque

```bash
npm run dev            # http://localhost:4321  (desarrollo, HMR)
# o
npm run build && npm run start   # producción (Node standalone)
```

- Panel: `/admin` — login con el superadmin sembrado.
- Correos de desarrollo (Docker/MailHog): `http://localhost:8025`.
- Consola de MinIO (Docker): `http://localhost:9001` (minioadmin / minioadmin).

## 4. Comprobación

```bash
npm run build          # astro check + build (0 errores)
npm run test           # 60 pruebas unitarias
npm run lint
```

## 5. Crear más superadmins

```bash
npm run create:superadmin -- correo@emcosalud.com "Nombre Apellido" "ContraseñaSegura123"
```

## Notas de seguridad de dependencias

`npm audit` reporta 7 advertencias moderadas heredadas de herramientas **solo de
desarrollo** (`esbuild` vía drizzle-kit/tsx) y de un parámetro de `uuid` (vía
`exceljs`) que este proyecto no usa. No afectan al artefacto de producción.
