# CMS EMCO SALUD — CMS institucional headless y multiportal

Panel administrativo central para gestionar múltiples portales (EMCOSALUD, Clínica
Emcosalud, Escuela/FUNAM, Radio y futuros) y sus contenidos, con una API que cada sitio
consume en su build.

- **Stack:** Astro 7 (SSR) · React 19 (islas) · Tailwind v4 · PostgreSQL 16 · Drizzle ORM ·
  Better Auth · MinIO (S3) · pg-boss.
- **Arquitectura completa:** ver `docs/` y el documento de arquitectura aprobado.
- **Concepto clave — multiportal:** un contenido se publica en varios portales sin
  duplicarse (`distribution_type` = `specific` | `general` | `all` + tablas puente).

## Requisitos

- Node.js ≥ 22
- Para el entorno completo: Docker + Docker Compose (PostgreSQL, MinIO, correo de desarrollo)

## Puesta en marcha rápida — sin Docker (PGlite + disco local)

PostgreSQL embebido (`.data/pglite`) + archivos en disco (`.data/media`). Sirve para
probar el panel; **no es apto para producción** ni para pg-boss.

```bash
cp .env.example .env
#   pon: DB_DRIVER=pglite  ·  STORAGE_DRIVER=fs  ·  STORAGE_PUBLIC_URL=http://localhost:4321/media
#   y un AUTH_SECRET cualquiera
npm install
npm run db:migrate            # aplica el esquema al PGlite
npm run seed                  # portales base + patrones + superadmin
npm run dev                   # http://localhost:4321
```

Login: `admin@emcosalud.com` / el valor de `SEED_SUPERADMIN_PASSWORD` del `.env`.

Durante el desarrollo el esquema se regenera como una sola migración; si cambia,
`npm run db:reset` borra `.data`, vuelve a migrar y siembra.

## Puesta en marcha — entorno completo (Docker)

```bash
cp .env.example .env          # DB_DRIVER=pg, completa AUTH_SECRET y SEED_SUPERADMIN_PASSWORD
docker compose up -d postgres minio minio-init mailhog
npm install
npm run db:migrate            # aplica migraciones
npm run seed                  # portales base + patrones + superadmin
npm run dev                   # http://localhost:4321
```

- Panel: `http://localhost:4321/admin`
- Correos de desarrollo (MailHog): `http://localhost:8025`
- Consola de MinIO: `http://localhost:9001`

## Scripts

| Script | Descripción |
| --- | --- |
| `npm run dev` | Servidor de desarrollo |
| `npm run build` | `astro check` + build de producción |
| `npm run start` | Sirve `dist/` (Node standalone) |
| `npm run db:generate` | Genera migraciones SQL desde `src/lib/db/schema.ts` |
| `npm run db:migrate` | Aplica migraciones |
| `npm run db:reset` | (solo pglite) borra `.data`, migra y siembra |
| `npm run db:studio` | Drizzle Studio |
| `npm run seed` | Datos semilla idempotentes |
| `npm run create:superadmin -- <email> <nombre> <clave>` | Crea/promueve un superadmin |
| `npm run lint` / `npm run format` | ESLint / Prettier |
| `npm run test` / `npm run test:e2e` | Vitest / Playwright |

## Estado del desarrollo

El proyecto se construye por fases (ver documento de arquitectura).

- **Fase 2 completada:** scaffolding, esquema de base de datos completo, migraciones,
  autenticación base (Better Auth), middleware de seguridad, Docker Compose y seed.
- **Fase 3 completada:** Design System (`src/components/ui/`), shell del panel (Sidebar
  colapsable, Topbar, selector de portal global, menú de usuario), Dashboard con métricas
  reales (globales, por portal y actividad reciente) y páginas de sección con control de
  permisos.
- **Fase 4 completada:** autenticación pulida (mensajes de error en español, "Recordar
  sesión", recuperación de contraseña, protección de open-redirect), **rate limiting
  persistente** (5 intentos/15 min en login y recuperación), **RBAC en el middleware**
  (además de en cada página) y **auditoría de accesos** (`login`, `login_failed`,
  `logout`, `password_reset`) + `last_login_at`. Test unitario de la matriz de permisos.
- **Fase 5 completada:** módulo **Portales** (CRUD completo con listado paginado y buscador,
  modales de crear/editar, validación Zod compartida, guarda de borrado si tiene contenidos)
  y **claves de API por portal** (hash SHA-256, prefijo, valor en claro mostrado una sola vez,
  revocación). Todo con auditoría. Establece el patrón repositorio → servicio → endpoint →
  isla para el resto de módulos.
- **Fase 6 completada:** módulo **Empresas** (CRUD con NIT único validado, listado paginado,
  contador de certificados, guarda de borrado si tiene certificados/cargas). Reusa el patrón
  de la Fase 5.
- **Fase 7 completada:** **Multimedia** — subida con validación de firma binaria (`file-type`),
  límite de tamaño, nombres únicos, miniatura webp (`sharp`), biblioteca con filtros y buscador,
  detalle con copiar URL / renombrar / eliminar (guarda si el archivo está en uso). Componente
  reutilizable **`ImagePicker`** integrado en los logos de Portales y Empresas. Driver de
  almacenamiento `s3` (MinIO) o `fs` (disco local para desarrollo sin Docker, servido en `/media`).
- **Fase 8 completada:** **Boletines** — primer contenido multiportal. Componentes transversales
  **`PortalSelector`** (específico / general / todos), **`CategoryCombobox`** (crear al vuelo) y
  **`MediaPicker`** (PDF + portada). Escritura multiportal en transacción con tabla puente
  (`syncContentPortals`), sin duplicar el registro; resolución de lectura `all` OR tabla puente
  (`listPublishedBoletinesForPortal`, base de la API de la Fase 14). Verificado: un boletín
  `general` aparece solo en sus portales; cambiarlo a `all` lo hace visible en todos —incluidos
  los portales creados después— y volverlo a borrador lo retira de todos.
- **Fase 9 completada:** **Publicaciones de cartelera** (avisos con imagen JPG/PNG/WEBP). Mismo
  patrón multiportal que boletines; validación "publicada requiere imagen". Nota: el módulo se
  llama *cartelera* (el encargo original decía "carretera" por error). Internamente las tablas
  son `board_publications` / `board_publication_portals`.
- **Fase 10 completada:** **Blog multiportal** — editor rich text **Tiptap** (`contentHtml`
  saneado en servidor con `sanitize-html` + `contentJson`), slug único, **etiquetas** con
  autocompletado y creación al vuelo, SEO (meta title/description) e **imagen Open Graph**, y
  4 estados: borrador / **programado** / publicado / archivado. Los artículos programados se
  publican solos vía un planificador en proceso (`src/server/jobs/scheduler.ts`, cada minuto;
  pasará a pg-boss en la Fase 14). Verificado: sanitización de `<script>`/`onerror`, resolución
  multiportal, y publicación automática al vencer la fecha programada.
- **Fase 11 completada:** **Capacitaciones** — material formativo con archivo de cualquier tipo
  (PDF, Office, ZIP, imagen, video) + imagen opcional + categoría. `MediaPicker` generalizado
  (sin `lockKind` acepta cualquier archivo). Mismo patrón multiportal; validación "publicada
  requiere archivo". Verificado: subida ZIP, resolución multiportal, guarda de borrado del
  archivo en uso.
- **Fase 12 completada:** **Certificados de retenciones** (CRUD por empresa + año, clave única
  empresa/año/documento) y **carga masiva** — asistente de 3 modos (**varios PDF**, **ZIP**,
  **planilla CSV/Excel + ZIP**), procesamiento por lotes en un worker en proceso que **no se
  detiene si un archivo falla**, contadores en vivo (Encontrados/Procesados/Correctos/Errores),
  **reporte de errores CSV**, y **detección de documento/año por patrones de nombre**
  configurables (`certificate_filename_patterns`, con grupos `doc`/`year` y fallback). Verificado
  end-to-end: 7 PDF (5 ok, 2 error), extracción de ZIP con `yauzl`, año extraído del nombre vs
  año del job, y reanudación de cargas atascadas tras reinicio.
- **Fase 13 completada:** **Popups multiportal** — dos ejes de segmentación: **portales**
  (`PortalSelector`) y **páginas** (`PagesInput`: todas o rutas específicas). Todos los campos
  del pliego (imagen + imagen móvil, enlace, frecuencia `always`/`once_session`/`once_user`/
  `every_x_days`, dispositivo, prioridad) y 5 estados con **activación/finalización automática**
  por fecha (scheduler). Consulta de resolución para los sitios
  (`resolvePopupsForPortal(slug, path, device)`, base de la Fase 14). Verificada la "prueba
  dorada" del plan §22.
- **Fase 14 completada:** **API pública `/api/v1`** — autenticación por `x-api-key` (una clave
  por portal, hash SHA-256, caché de 30 s), rate limit (120/min por clave), CORS al origen del
  portal, `Cache-Control` + `ETag`/`304`, y **resolución multiportal** en todos los endpoints
  (`/blog`, `/blog/:slug`, `/boletines`, `/publicaciones`, `/capacitaciones`, `/popups`,
  `/portales/:slug`, `/certificados`). **Webhooks de reconstrucción** ([rebuildService](src/server/services/rebuildService.ts))
  — al publicar contenido se llama al *deploy hook* de cada portal afectado, con debounce y
  3 reintentos. **SDK `@emcosalud/cms-client`** ([sdk/cms-client/](sdk/cms-client/)) — cliente
  tipado solo-`fetch`. Docs [API.md](docs/API.md) e [INTEGRATION.md](docs/INTEGRATION.md).
  Verificado E2E: 401 sin clave, 403 con portal ajeno, 304 con ETag, 204 en preflight, el
  webhook se dispara al publicar, y el SDK lista/consulta contenido.
- **Fase 15 completada:** **Usuarios** (CRUD superadmin: crear con contraseña, editar rol/estado,
  restablecer contraseña —cierra sesiones—, suspender, eliminar; guardas contra dejar el sistema
  sin superadmin y contra auto-degradarse), **Configuración** (ajustes generales en `settings` +
  panel de información del sistema y estado de deploy hooks) y **Auditoría** (vista de solo
  lectura de `audit_logs` con filtros por módulo/acción/fecha y detalle del `metadata`).
  Verificado E2E: RBAC, guardas de auto-protección, reset de contraseña (la clave vieja deja de
  funcionar), suspensión que bloquea el acceso, y persistencia de configuración.
- **Fase 16 completada:** endurecimiento y cierre.
  - **Seguridad**: CSP de producción **con hashes de scripts** (`security.csp` de Astro, sin
    `'unsafe-inline'` en `script-src`); cabeceras `HSTS`, `X-Frame-Options`, `nosniff`,
    `X-DNS-Prefetch-Control`, `Permissions-Policy`. `npm audit` sin vulnerabilidades altas
    (quedan 7 moderadas solo de herramientas de desarrollo).
  - **Optimización**: caché de 3 min del Dashboard en `dashboard_stats`, refrescada por el
    planificador; índices ya presentes en el esquema.
  - **Scripts JS puros** (`seed.mjs`, `create-superadmin.mjs`, `migrate.mjs`) que funcionan en
    la imagen de producción sin `tsx`.
  - **Deployment**: `docs/DEPLOYMENT.md` completo (Docker Compose / PM2, Nginx + TLS, backups,
    migraciones, checklist) e `docs/INSTALL.md`.
  - **Tests E2E**: `playwright.config.ts` + `tests/e2e/critical-flows.spec.ts` (login, rutas
    protegidas, crear portal, crear boletín multiportal). Requiere `npx playwright install chromium`.

Entregables: 60 pruebas unitarias, `docs/{ARCHITECTURE,INSTALL,DEPLOYMENT,API,INTEGRATION}.md`,
SDK en `sdk/cms-client/`, `.env.example`, seed idempotente y Docker Compose.

### Ampliaciones posteriores

- **Módulo Banners (hero / slider)** — franja de imágenes fija en la **página de inicio** del
  portal. Distribución multiportal y programación por fecha como los popups; varios activos
  ordenados como carrusel (`sort_order`, reordenables con flechas ↑/↓ y con tira de
  previsualización de los activos). El visitante solo navega entre imágenes, no las cierra. Menú
  en *Configuración*. API pública `GET /api/v1/banners?portal=…`; SDK `cms.banners.list()`. El
  planificador activa/finaliza los banners programados por fecha.
- **Módulo Estados financieros** — cada empresa publica una vez al año su juego de documentos
  (situación financiera, resultados, flujos, notas, dictamen). Clave única `(empresa, año)` en la
  base de datos; documentos etiquetados y ordenables; distribución multiportal. Menú en
  *Documentos*, junto a *Certificados de retenciones*. API pública
  `GET /api/v1/estados-financieros?portal=…&year=…`; SDK `cms.estadosFinancieros.list()`.
  Al eliminar una publicación se borran también sus PDF del almacenamiento.

## Documentación

| Documento | Contenido |
| --- | --- |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Arquitectura completa, modelo de datos, sistema multiportal |
| [docs/INSTALL.md](docs/INSTALL.md) | Instalación paso a paso (Docker y sin Docker) |
| [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) | Despliegue en VPS (Docker Compose / PM2, Nginx, TLS, backups) |
| [docs/API.md](docs/API.md) | API pública `/api/v1` (endpoints, auth, caché, webhooks) |
| [docs/INTEGRATION.md](docs/INTEGRATION.md) | Cómo un sitio consume el CMS (build-time + popups en runtime) |
