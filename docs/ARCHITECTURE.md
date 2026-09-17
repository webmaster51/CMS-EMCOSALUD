# CMS Institucional Headless y Multiportal — EMCO SALUD

## Contexto

EMCO SALUD (Grupo Empresarial) opera varios sitios web independientes (EMCOSALUD, Clínica
Emcosalud, Escuela/FUNAM, Radio, Ferrocarriles, y futuros como Farmacia o Fundación). Hoy cada
sitio es un proyecto Astro estático separado, con el contenido escrito a mano en colecciones
locales (`src/data/*.ts`, `src/content/**`). No existe ningún panel central: publicar una noticia,
un boletín o un popup implica editar código y volver a desplegar cada sitio, y un mismo contenido
que debe salir en tres portales se copia tres veces.

Este proyecto crea un **CMS central headless** (en `e:\modelos paginas\cms`) desde el cual se
administran todos los portales y todos los contenidos, con una **API** que cada sitio consume en su
build. La pieza clave es el **sistema multiportal**: un único registro de contenido puede
publicarse en varios portales a la vez (opción "General" + selección de portales, u opción "Todos
los portales") sin duplicarlo.

Hallazgos de la exploración de los sitios existentes:

- `ferrocarriles`: Astro 5 + Tailwind v4 (`@theme` en CSS), estático, blog por content collection.
- `funam`: Astro (última gen) + Tailwind v4, Content Layer con `glob()`, `noticias` con categoría
  `boletin`/`evento`, `programas` con `educacion-continua`.
- `clinica`: Astro 4 + Tailwind v3 (`tailwind.config.mjs`), páginas institucionales, blog aún vacío,
  export WordPress de 21 MB (`export.xml`) pendiente de migrar.
- `escuela` y `distribuciones`: vacíos (aún no existen como sitio).
- Ningún sitio llama a una API hoy; ninguno tiene popups, capacitaciones ni certificados.
- Paletas **por sitio** (clínica azul `#003399`, funam azul `#00348e` / verde `#2f7a02` / dorado
  `#f59e0b`), derivadas del logo de cada uno.

Decisiones ya confirmadas con el usuario:

| Tema | Decisión |
|---|---|
| UI interactiva | Astro SSR (shell/rutas) + **islas React 19** donde hace falta |
| Autenticación | **Better Auth** (Lucia está descontinuado) |
| ORM | **Drizzle ORM** sobre PostgreSQL |
| Storage | **MinIO** autohospedado (S3-compatible) en el VPS |
| API pública | **API key por portal** (`x-api-key`) |
| Alcance editor | Editores acceden a **todos los portales** (restricción por portal se puede añadir luego) |
| Consumo de sitios | **Build-time fetch + webhook de rebuild**; popups en runtime client-side |

> Este archivo es el **entregable de la Fase 1** (arquitectura para aprobación). No se genera
> código todavía. Tras la aprobación se desarrolla fase por fase.

---

## 1. Análisis del logo y Design System

### 1.1 Colores extraídos del logo "EMCO SALUD — Grupo Empresarial"

- **"EMCO"** — azul marino corporativo profundo.
- **"SALUD"** — verde hoja vivo.
- Acento de "hoja" verde dentro de la "e"; línea divisoria y "GRUPO EMPRESARIAL" en el mismo azul.
- Fondo blanco puro.

Paleta institucional del **CMS** (marca EMCO SALUD Grupo, distinta de la de cada portal):

```
/* Azul institucional (primary) — anclado en el azul del logo ~#1D3C7A */
--brand-50:  #eef2fa
--brand-100: #d6e0f2
--brand-200: #adbfe3
--brand-300: #7d97cf
--brand-400: #4d6db6
--brand-500: #2c4d97
--brand-600: #1d3c7a   /* primary — botones, activo de sidebar, enlaces */
--brand-700: #172f60
--brand-800: #132749
--brand-900: #101f3a
--brand-950: #0a1424

/* Verde salud (accent) — anclado en el verde del logo ~#5CB030 */
--accent-50:  #f0f9e8
--accent-100: #dcf0c8
--accent-200: #bde294
--accent-300: #97d05c
--accent-400: #74bd35
--accent-500: #5cb030   /* accent — indicadores, chips "General", CTAs secundarios */
--accent-600: #468a22
--accent-700: #386e1e   /* verde texto con contraste AA sobre blanco */
--accent-800: #2f5a1c
--accent-900: #29491b

/* Neutros — escala slate de Tailwind (coincide con los sitios existentes) */
--surface:        #ffffff
--surface-muted:  #f8fafc   /* slate-50 — fondo de la app */
--border:         #e2e8f0   /* slate-200 */
--text:           #0f172a   /* slate-900 */
--text-muted:     #475569   /* slate-600 */

/* Semánticos */
--success: #16a34a   --success-bg: #dcfce7
--warning: #d97706   --warning-bg: #fef3c7   /* dorado, coincide con funam */
--danger:  #dc2626   --danger-bg:  #fee2e2
--info:    #2563eb   --info-bg:    #dbeafe
```

Modo oscuro: se definen los mismos tokens bajo `@media (prefers-color-scheme: dark)` +
`:root[data-theme]`. La v1 se entrega en claro; los tokens quedan listos.

### 1.2 Tipografía

- **Inter** (variable, self-hosted vía `@fontsource-variable/inter`) para toda la UI del panel.
- **Plus Jakarta Sans** para títulos de login y encabezados de página (opcional, un solo peso extra).
- Escala: `text-xs 12` · `sm 14` (base de tablas) · `base 15/16` · `lg 18` · `xl 20` · `2xl 24` ·
  `3xl 30` (títulos de página).

### 1.3 Tokens de forma y elevación

- Radios: `sm 6px` (inputs, badges) · `md 10px` (botones) · `lg 14px` (cards) · `xl 20px` (modales).
- Sombras: `sm` cards en reposo · `md` dropdowns/popovers · `lg` modales.
- Idiom de card (heredado de los sitios): `rounded-lg border border-slate-200 bg-white shadow-sm`.
- Espaciado en múltiplos de 4; contenedor de página `max-w-[1400px]`.

### 1.4 Componentes del Design System (a construir en Fase 2)

Shell: `AppShell`, `Sidebar` (colapsable, grupos), `Topbar` (selector de portal global,
breadcrumbs, buscador ⌘K, menú usuario), `PageHeader` (título + acciones).

Datos: `DataTable` (TanStack Table: orden, filtros, paginación server-side, selección),
`Card`/`StatCard`, `Badge` (estados), `EmptyState`, `Skeleton`, `Pagination`.

Formularios (react-hook-form + Zod): `Form`, `Field`, `Input`, `Textarea`, `Select`,
`Combobox`, `DatePicker`, `Switch`, `Checkbox`, `RadioGroup`, `FileDropzone`,
`RichTextEditor` (Tiptap, para el contenido del blog), `PortalSelector` (el componente
transversal multiportal — ver §4), `ImagePicker` (abre la Biblioteca Multimedia).

Feedback: `Toast` (sonner), `Modal`/`Dialog` (Radix), `ConfirmDialog`, `AlertBanner`,
`ProgressBar` (carga masiva).

Todos son islas React (`client:load` / `client:visible`) montadas en páginas `.astro`.

---

## 2. Stack tecnológico

| Capa | Elección | Notas |
|---|---|---|
| Framework | **Astro 7** `output: 'server'` + `@astrojs/node` 11 (standalone) | SSR para el panel y la API. Vite/Rolldown |
| UI islas | **React 19** (`@astrojs/react`) | solo componentes interactivos |
| Estilos | **Tailwind CSS v4** (`@tailwindcss/vite`, `@theme` en CSS) | coincide con ferrocarriles/funam |
| Primitivos UI | **Radix UI** + patrón shadcn/ui (copiados al repo, no dependencia) | |
| Tablas | **TanStack Table v8** | server-side pagination/sort/filter |
| Formularios | **react-hook-form** + **Zod v4** | mismos esquemas Zod se reusan en el servidor |
| Editor rich text | **Tiptap** | HTML sanitizado en servidor |
| DB | **PostgreSQL 16** | |
| ORM | **Drizzle ORM** + **drizzle-kit** (migraciones) | tipado total, sin `any` |
| Auth | **Better Auth** (email/password, sesiones, cookies HttpOnly, rate limit, reset, plugin admin/roles) | tablas gestionadas por Drizzle adapter |
| Hash | **@node-rs/argon2** (argon2id) | lo usa Better Auth |
| Storage | **MinIO** (S3-compatible) vía **@aws-sdk/client-s3** + **@aws-sdk/s3-request-presigner** | subidas y descargas con URL prefirmada |
| Jobs / colas | **pg-boss** (cola sobre PostgreSQL, sin Redis) | carga masiva, publicación programada, webhooks |
| Validación archivos | **file-type** (magic bytes) + límites por MIME | no confiar en la extensión |
| ZIP | **yauzl** (streaming, tolerante a ZIP grandes) | |
| CSV/Excel | **papaparse** (CSV) + **exceljs** (xlsx) | |
| Email | **nodemailer** + SMTP | recuperación de contraseña, avisos |
| Sanitización HTML | **sanitize-html** | contenido del blog y campos rich |
| Fechas | **date-fns** + `date-fns-tz` (America/Bogota) | |
| Rate limiting | **rate-limiter-flexible** (store PostgreSQL) | login y API pública |
| Logs | **pino** | JSON estructurado |
| Tests | **Vitest** (unidad/servicios) + **Playwright** (E2E de flujos críticos) | |
| Lint/format | **ESLint** (typescript-eslint estricto) + **Prettier** | |
| Deploy | **Docker Compose** (app + postgres + minio) tras **Nginx** + TLS; PM2 documentado como alternativa | |

Todas son librerías mantenidas activamente en 2026. Nada de Lucia, nada abandonado.

---

## 3. Arquitectura general

```
                    ┌─────────────────────────────────────────┐
                    │            CMS CENTRAL (Astro SSR)       │
                    │                                         │
   Navegador admin ─┤  /login  /admin/**   (sesión + RBAC)    │
                    │  /api/admin/**       (mutaciones, CSRF)  │
   Sitios externos ─┤  /api/v1/**          (lectura, x-api-key)│
                    │                                         │
                    │  middleware.ts → auth · rbac · headers   │
                    │        │                                │
                    │   services/  ── lógica de negocio        │
                    │   repositories/ ── acceso a datos (Drizzle)
                    │        │                    │            │
                    │   pg-boss (jobs)      PostgreSQL 16      │
                    │        │                                │
                    └────────┼────────────────────┬───────────┘
                             │                    │
                        MinIO (S3)          Webhooks de rebuild
                     PDFs · imágenes ·          │
                     ZIPs · certificados        ▼
                                        ┌───────────────────────┐
                                        │  Sitios Astro (build)  │
                                        │  fetch /api/v1/... →   │
                                        │  HTML estático → deploy │
                                        └───────────────────────┘
                                    EMCOSALUD · CLÍNICA · ESCUELA · RADIO · …
                                    (popups: fetch runtime client-side)
```

Capas dentro del CMS:

```
UI (Astro page + isla React)
  → Zod schema (mismo objeto en cliente y servidor)
  → endpoint /api/admin/* (verifica sesión, rol, CSRF, rate limit)
  → service (reglas de negocio, transacción, auditoría, encola job)
  → repository (Drizzle, consultas parametrizadas)
  → PostgreSQL / MinIO
  → respuesta tipada → UI (toast + refresh de tabla)
```

Regla del proyecto (punto 36): **cero mockups**. Cada botón ejecuta esta cadena completa.

---

## 4. Modelo de base de datos

Convenciones: `snake_case`, PK `id` (`bigint generated always as identity` o `uuid v7` para
entidades expuestas por API), `created_at`/`updated_at timestamptz`, borrado lógico
(`deleted_at`) donde aplica, todos los FKE con índice.

### 4.1 Identidad y acceso

```
users            id, email (uniq), name, password_hash, role ('superadmin'|'editor'),
                 status ('active'|'suspended'), last_login_at, created_at, updated_at
sessions         (Better Auth) id, user_id, token (uniq), ip, user_agent, expires_at
verification     (Better Auth) tokens de reset / verificación de email
api_keys         id, portal_id FK, name, key_hash (uniq), last_used_at, revoked_at, created_at
```

Permisos: matriz `rol × recurso × acción` en código (`lib/auth/permissions.ts`), no en BD —
2 roles fijos (punto 8). SUPERADMIN = todo; EDITOR = todo el contenido + multimedia, **no**
usuarios/portales/empresas/configuración/auditoría.

### 4.2 Entidades núcleo

```
portals      id, name, short_name, slug (uniq), url, logo_media_id FK, description,
             status ('active'|'inactive'), created_at, updated_at
companies    id, name, short_name, tax_id (NIT, uniq), logo_media_id FK, description,
             status, created_at, updated_at
media        id (uuid), filename (única en storage), original_name, internal_name, mime_type,
             size_bytes, storage_key, width, height, content_kind ('image'|'document'|'video'|'archive'|'other'),
             uploaded_by FK users, created_at
categories   id, module ('blog'|'boletin'|'road'|'training'), name, slug, portal_id FK NULL,
             UNIQUE(module, slug, portal_id)
tags         id, name, slug (uniq)
audit_logs   id, user_id FK NULL, action, module, entity_type, entity_id, summary,
             metadata jsonb, ip, user_agent, created_at    -- append-only, sin update/delete
job_runs     id, type, status, params jsonb, totals jsonb, created_by FK, created_at, finished_at
settings     key (PK), value jsonb, updated_by FK, updated_at
```

### 4.3 Contenidos multiportal (patrón repetido)

Cada tipo de contenido tiene **su tabla** + **su tabla puente** hacia `portals`. Ninguna tabla de
contenido tiene `portal_id` directo (punto 27).

Columna común en cada tabla de contenido:

```
distribution_type  ('specific' | 'general' | 'all')
```

- `specific` → exactamente 1 fila en la tabla puente.
- `general`  → 1..N filas en la tabla puente (los portales marcados).
- `all`      → 0 filas; visible en todos los portales presentes y futuros.

```
boletines               id, title, description, pdf_media_id FK, cover_media_id FK,
                        category_id FK, published_date, status ('draft'|'published'|'archived'),
                        author_id FK, distribution_type, created_at, updated_at
boletin_portals         boletin_id FK, portal_id FK            PK(boletin_id, portal_id)

board_publications       id, title, description, image_media_id FK, published_date,
                        status, author_id FK, distribution_type, ...
board_publication_portals board_publication_id FK, portal_id FK  PK(...)

blog_posts              id (uuid), title, slug (uniq), excerpt, content_html, content_json,
                        featured_media_id FK, category_id FK, author_id FK,
                        published_at, scheduled_at, status ('draft'|'scheduled'|'published'|'archived'),
                        meta_title, meta_description, og_media_id FK, distribution_type,
                        created_at, updated_at
blog_post_portals       blog_post_id FK, portal_id FK          PK(...)
blog_post_tags          blog_post_id FK, tag_id FK             PK(...)

training_materials      id, title, description, file_media_id FK, image_media_id FK,
                        category_id FK, published_date, status, author_id FK, distribution_type, ...
training_material_portals training_material_id FK, portal_id FK PK(...)

popups                  id (uuid), internal_name, distribution_type,
                        title, subtitle, description, image_media_id FK, mobile_image_media_id FK,
                        button_text, url, link_type ('internal'|'external'|'none'),
                        page_mode ('all_pages'|'specific_pages'),
                        starts_at, ends_at, status ('draft'|'scheduled'|'active'|'inactive'|'finished'),
                        priority int, frequency ('always'|'once_session'|'once_user'|'every_x_days'),
                        frequency_days int NULL, device ('all'|'desktop'|'tablet'|'mobile'),
                        created_by FK, created_at, updated_at
popup_portals           popup_id FK, portal_id FK              PK(...)
popup_pages             popup_id FK, path text                 PK(popup_id, path)
                        -- p.ej. '/', '/noticias', '/servicios/medicina-general'
```

### 4.4 Empresas y certificados (NO multiportal — se clasifican por empresa)

```
certificates            id, company_id FK, tax_year int, document_number text, full_name text,
                        pdf_media_id FK, status ('active'|'inactive'), issued_date,
                        created_at, updated_at
                        UNIQUE(company_id, tax_year, document_number)
                        INDEX(company_id, tax_year), INDEX(document_number)

certificate_filename_patterns
                        id, name, regex text, document_group int, year_group int NULL,
                        is_default bool, enabled bool
                        -- p.ej. '^(?<doc>\d{6,15})[-_].*', '^CC[_-](?<doc>\d+)[_-](?<year>\d{4})'

bulk_jobs               id, kind ('multi_pdf'|'zip'|'csv_zip'), company_id FK, tax_year int,
                        pattern_id FK NULL, status ('queued'|'processing'|'completed'|'completed_with_errors'|'failed'),
                        total int, processed int, succeeded int, failed int,
                        source_prefix text, csv_map jsonb NULL, created_by FK,
                        error_report_media_id FK NULL, created_at, started_at, finished_at
bulk_job_items          id, bulk_job_id FK, source_filename, storage_key text, size_bytes bigint,
                        detected_document, detected_year, full_name text NULL,
                        media_id FK NULL, certificate_id FK NULL,
                        status ('pending'|'ok'|'error'|'skipped'), error_message text NULL
                        INDEX(bulk_job_id, status)
```

### 4.5 Diagrama de relaciones (resumen)

```
users ──< audit_logs        users ──< media ──< (todas las tablas de contenido vía *_media_id)
portals ──< api_keys        portals ──< categories
portals ──<>── blog_posts          (blog_post_portals)
portals ──<>── boletines           (boletin_portals)
portals ──<>── board_publications   (board_publication_portals)
portals ──<>── training_materials  (training_material_portals)
portals ──<>── popups               (popup_portals)         popups ──< popup_pages
tags   ──<>── blog_posts           (blog_post_tags)
companies ──< certificates          companies ──< bulk_jobs ──< bulk_job_items >── certificates
```

---

## 5. Cómo funciona el sistema multiportal

### 5.1 El componente `<PortalSelector>` (UI transversal)

Aparece en el formulario de **boletines, publicaciones, blog, capacitaciones y popups**. Tres
opciones excluyentes + selección:

```
Distribución:
  ( ) Portal específico     → [ combobox: un portal ]
  (•) General               → [ ☑ Emcosalud  ☑ Clínica  ☑ Radio  ☐ Escuela ]
  ( ) Todos los portales    → (sin selección; incluye portales futuros)
```

El submit envía `{ distribution_type, portal_ids: number[] }`. Validación Zod (cliente + servidor):

- `specific` ⇒ `portal_ids.length === 1`
- `general`  ⇒ `portal_ids.length >= 1`
- `all`      ⇒ `portal_ids` ignorado (se guarda vacío)

### 5.2 Escritura (service)

En una transacción: `insert` del contenido con su `distribution_type` → `delete` de las filas
puente anteriores → `insert` de las nuevas (`specific`/`general`). Un **único registro** de
contenido; las tablas puente expresan la pertenencia a varios portales. Nunca se duplica.

### 5.3 Lectura / resolución (la regla central, punto 26)

Consulta canónica para `GET /api/v1/blog?portal=<slug>` (idéntica para boletines, popups, etc.):

```sql
SELECT c.*
FROM blog_posts c
WHERE c.status = 'published'
  AND c.deleted_at IS NULL
  AND (
        c.distribution_type = 'all'
     OR EXISTS (
          SELECT 1
          FROM blog_post_portals cp
          JOIN portals p ON p.id = cp.portal_id
          WHERE cp.blog_post_id = c.id
            AND p.slug = :portalSlug
            AND p.status = 'active'
        )
  )
ORDER BY c.published_at DESC
LIMIT :limit OFFSET :offset;
```

Ejemplo del enunciado — artículo `general` con Emcosalud + Clínica + Radio:

- `?portal=emcosalud` → **sí** (fila puente) · `?portal=clinica` → **sí** · `?portal=radio` → **sí**
- `?portal=escuela` → **no** (sin fila puente, y no es `all`)

Añadir el portal FARMACIA en el futuro: solo se crea la fila en `portals`. Los contenidos `all`
pasan a estar disponibles automáticamente; los `general`/`specific` no cambian. Cero migraciones,
cero cambios de arquitectura (puntos 2 y 27).

### 5.4 Índices que sostienen esto

- `blog_post_portals (portal_id, blog_post_id)` y PK `(blog_post_id, portal_id)`.
- `blog_posts (status, published_at desc)` parcial `WHERE deleted_at IS NULL`.
- `blog_posts (distribution_type)`.
- Análogos para cada tipo de contenido.

---

## 6. Blog → Portales (puntos 12–14, 40)

Formulario "Nuevo artículo": Título, Slug (autogenerado, editable), Resumen, Contenido (Tiptap),
Imagen destacada (ImagePicker → Multimedia), Categoría, Etiquetas, Autor (por defecto el usuario),
**`<PortalSelector>`**, Fecha de publicación, Estado (`Borrador`/`Programado`/`Publicado`/`Archivado`),
Meta title, Meta description, Imagen Open Graph.

"Campaña de prevención" marcada General + Emcosalud + Clínica ⇒ 1 fila en `blog_posts`
(`distribution_type='general'`) + 2 filas en `blog_post_portals`. `/api/v1/blog?portal=emcosalud`
y `?portal=clinica` lo devuelven; `?portal=escuela` y `?portal=radio` no. **Un solo artículo.**

Estado `Programado`: un job cron de pg-boss (cada minuto) hace
`UPDATE blog_posts SET status='published', published_at=now() WHERE status='scheduled' AND scheduled_at <= now()`
y dispara el webhook de rebuild de los portales afectados.

---

## 7. Popup → Portales → Páginas (puntos 20–25, 40)

Dos ejes independientes:

1. **En qué portales** — mismo `<PortalSelector>` (`specific` / `general` / `all`) → `popup_portals`.
2. **En qué páginas de cada portal** — `page_mode`:
   - `all_pages` → todas las rutas del portal.
   - `specific_pages` → filas en `popup_pages` con `path` (`/`, `/noticias`, `/servicios`,
     `/contacto`, o una ruta exacta `/servicios/medicina-general`).

Campos (punto 23): nombre interno, portales, título, subtítulo, descripción, imagen, imagen móvil,
texto de botón, URL, tipo de enlace, páginas, fecha inicial, fecha final, estado, prioridad,
frecuencia, dispositivo.

Frecuencia (punto 24): `always` · `once_session` · `once_user` · `every_x_days` (con
`frequency_days`). Dispositivo: `all` · `desktop` · `tablet` · `mobile`. La **decisión de mostrar**
y el conteo de frecuencia ocurren en el cliente del sitio (localStorage/cookie); el CMS solo
entrega la configuración.

Estados (punto 25): `draft` · `scheduled` · `active` · `inactive` · `finished`. Job cron:
`scheduled→active` al llegar `starts_at`; `active→finished` al pasar `ends_at`.

Endpoint de consumo:

```
GET /api/v1/popups?portal=emcosalud&path=/servicios/medicina-general&device=mobile
→ popups activos, dentro de rango de fechas, cuyo portal resuelve (specific/general/all),
  cuyo page_mode es all_pages o cuyo popup_pages contiene un path que hace match,
  y cuyo device es 'all' o 'mobile', ordenados por priority desc.
```

El sitio hace este fetch **en runtime** (client-side, tras cargar la página) para que popups
programados aparezcan sin rebuild.

---

## 8. Carga masiva de certificados (puntos 18–19)

### 8.1 Flujo UI

```
Paso 1  Empresa [combobox]   Año gravable [selector]   Patrón de nombre [selector, opc.]
Paso 2  Origen:
          ( ) Múltiples PDFs  → FileDropzone (cientos/miles de archivos)
          ( ) Un ZIP          → 1 archivo .zip
          ( ) CSV/Excel + ZIP → planilla (documento, nombre, archivo) + zip de PDFs
Paso 3  Subida a MinIO con URLs prefirmadas (en lotes, con reintentos)  → se crea bulk_job
Paso 4  Progreso en vivo (polling a /api/admin/bulk-jobs/:id cada 2s):

        Procesando...  ████████████████░░░░  80%
        Encontrados: 2.000   Procesados: 1.500   Correctos: 1.495   Errores: 5

Paso 5  Al terminar: resumen + descarga de reporte de errores (CSV) si los hubo.
```

### 8.2 Procesamiento (worker pg-boss, por lotes de ~200)

Por cada archivo:

1. Extraer del nombre `document` y `year` aplicando `certificate_filename_patterns`
   (el patrón elegido primero; si no, se prueban los `enabled` por orden; `year` cae al año del job
   si el patrón no lo captura). Ejemplos que debe resolver:
   `123456789-certificado.pdf` → doc `123456789`; `CC_123456789_2026.pdf` → doc `123456789`, año `2026`.
2. Validar magic bytes = PDF y tamaño ≤ límite.
3. `upsert` en `certificates` por `(company_id, tax_year, document_number)`.
4. Registrar `bulk_job_items` con `ok` / `error` (+ mensaje) / `skipped`.
5. **Un archivo que falla no detiene el job** (punto 18): se captura, se cuenta, se sigue.

Contadores de `bulk_jobs` actualizados por lote (no fila a fila). Estado final:
`completed` o `completed_with_errors`. Reporte de errores = CSV en `media`, enlazado en el job.

Modo CSV/Excel: la planilla aporta `document_number`, `full_name` y `filename`; el año puede venir
por columna o del job. El match archivo↔fila es por nombre exacto dentro del ZIP.

---

## 9. API multiportal (puntos 26, 39)

### 9.1 API pública de lectura — `/api/v1/**`

- Auth: header `x-api-key: <clave>` → resuelve `portal_id`. El parámetro `?portal=<slug>` debe
  coincidir con el portal de la clave (o se omite y se infiere de la clave).
- Formato: JSON `{ data: [...], meta: { page, limit, total, totalPages } }`.
- Paginación: `?page=1&limit=20` (límite máx. 100). Filtros: `?category=`, `?tag=`, `?search=`,
  `?since=`. Detalle: `/api/v1/blog/:slug`.
- Solo contenido `published` / `active` y con fecha vigente.
- Cache: `Cache-Control: public, s-maxage=300, stale-while-revalidate=600` + `ETag`.
- Rate limit por clave (p.ej. 120 req/min).
- CORS: `Access-Control-Allow-Origin` = `url` del portal de la clave.

Endpoints:

```
GET /api/v1/blog?portal=…            GET /api/v1/blog/:slug
GET /api/v1/boletines?portal=…       GET /api/v1/boletines/:id
GET /api/v1/publicaciones?portal=…
GET /api/v1/capacitaciones?portal=…
GET /api/v1/popups?portal=…&path=…&device=…
GET /api/v1/portales/:slug           (metadata pública del portal: nombre, logo, url)
GET /api/v1/certificados?company=<nit>&year=<n>&document=<n>   (búsqueda puntual, throttled)
```

### 9.2 API de administración — `/api/admin/**`

- Auth: sesión Better Auth (cookie HttpOnly) + verificación de rol + token CSRF (double-submit).
- CRUD completo de cada módulo, subida de multimedia (presigned), lanzamiento de bulk jobs,
  gestión de usuarios/portales/empresas/configuración, consulta de auditoría.
- Toda mutación escribe en `audit_logs` y, si corresponde, encola el webhook de rebuild.

### 9.3 Webhooks de rebuild

`settings` guarda por portal una URL de deploy hook (Netlify/Vercel/GitHub Actions/script propio).
Al publicar/despublicar contenido, un job pg-boss (con debounce de ~30 s y reintentos) hace `POST`
a los hooks de los portales afectados.

### 9.4 Consumo desde los sitios Astro (entregable: guía de integración)

```ts
// src/lib/cms.ts  (en cada sitio)
const CMS = import.meta.env.CMS_API_URL;      // https://cms.emcosalud.com/api/v1
const KEY = import.meta.env.CMS_API_KEY;      // clave del portal
const PORTAL = 'emcosalud';

export async function getBlog(page = 1) {
  const r = await fetch(`${CMS}/blog?portal=${PORTAL}&page=${page}`, {
    headers: { 'x-api-key': KEY },
  });
  if (!r.ok) throw new Error(`CMS ${r.status}`);
  return r.json() as Promise<{ data: BlogPost[]; meta: PageMeta }>;
}
```

```astro
---
// src/pages/noticias/index.astro  — fetch en build
import { getBlog } from '@/lib/cms';
const { data: posts } = await getBlog();
---
```

Popups (runtime, isla client-side):

```ts
const res = await fetch(
  `${CMS}/popups?portal=emcosalud&path=${location.pathname}&device=${detectDevice()}`,
  { headers: { 'x-api-key': KEY } },
);
// aplicar reglas de frecuencia con localStorage y renderizar el de mayor priority
```

Se entrega un paquete opcional `@emcosalud/cms-client` (SDK tipado) reutilizable entre los sitios
(compatible con Astro 4 y 5, solo `fetch`).

---

## 10. Autenticación y roles (puntos 7–8)

- **Better Auth** con proveedor email/password, `argon2id`.
- Sesiones en tabla `sessions`, cookie `__Host-` HttpOnly + Secure + SameSite=Lax, expiración
  configurable (p.ej. 8 h; "Recordar sesión" → 30 días).
- Recuperación de contraseña: token de un solo uso (tabla `verification`), email vía nodemailer,
  expiración 1 h.
- Rate limiting en `/login` y `/forgot-password` (5 intentos / 15 min / IP+email).
- `middleware.ts`: toda ruta `/admin/**` y `/api/admin/**` exige sesión válida; si no, redirige a
  `/login` (o 401 en API). Verificación de rol por recurso antes del handler.
- Logout: invalida la sesión en BD y limpia la cookie.
- Auditoría de `login`, `logout`, `login_failed`, `password_reset`.

Matriz de permisos (`lib/auth/permissions.ts`):

| Recurso | SUPERADMIN | EDITOR |
|---|---|---|
| Dashboard | ✔ | ✔ |
| Blog, Boletines, Publicaciones, Capacitaciones | ✔ CRUD+publicar | ✔ CRUD+publicar |
| Certificados (incl. carga masiva) | ✔ | ✔ |
| Multimedia | ✔ | ✔ subir/usar |
| Popups | ✔ | ✔ |
| Portales | ✔ | ✖ |
| Empresas | ✔ | ✖ |
| Usuarios | ✔ | ✖ |
| Configuración | ✔ | ✖ |
| Auditoría | ✔ | ✖ |

---

## 11. Seguridad (punto 30)

- Validación **server-side** de todo input con Zod; el esquema del cliente es una copia, no la
  defensa.
- SQL Injection: Drizzle parametriza siempre; prohibido SQL string-interpolado (regla de lint).
- XSS: `sanitize-html` sobre `content_html` del blog y cualquier campo rich antes de persistir;
  escape por defecto en Astro/React en el render.
- CSRF: token double-submit en formularios admin + verificación de `Origin`/`Referer` en
  mutaciones.
- Archivos: validación de magic bytes (`file-type`), allowlist de MIME por módulo, límite de
  tamaño (`MAX_FILE_SIZE`), nombres regenerados (uuid), sin ejecución, servidos desde MinIO con
  `Content-Disposition` y URL prefirmada de corta duración.
- Headers (middleware): `Content-Security-Policy`, `X-Content-Type-Options: nosniff`,
  `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`,
  `Strict-Transport-Security`, `Permissions-Policy`.
- Rate limiting: login, reset, API pública (`rate-limiter-flexible` con store Postgres).
- Cookies: `__Host-` prefix, HttpOnly, Secure, SameSite.
- Secretos solo por variables de entorno; `.env` en `.gitignore`; `.env.example` sin valores.
- Auditoría append-only (sin `UPDATE`/`DELETE`; revocado a nivel de rol de BD de la app).
- Dependencias: `npm audit` en CI; Dependabot/renovate.

---

## 12. Rendimiento (punto 31)

- Paginación server-side obligatoria en toda tabla y endpoint (cursor donde el volumen lo exija:
  certificados, auditoría, `bulk_job_items`).
- Índices: FKs, tablas puente `(portal_id, <content>_id)`, `certificates (company_id, tax_year)` y
  `(document_number)`, `blog_posts (status, published_at)`, `audit_logs (created_at)`,
  `audit_logs (entity_type, entity_id)`.
- Carga masiva: subida y proceso por lotes, worker asíncrono (pg-boss), contadores agregados.
- API pública: `Cache-Control` + `ETag`; opcionalmente CDN delante.
- Consultas de conteo del dashboard: materializadas o cacheadas (5 min) en `settings`/tabla
  `dashboard_stats`, recalculadas por job.
- `sharp` para derivados de imagen (thumbnail, webp) al subir a Multimedia.
- Conexión a BD con pool (`pg` pool, límite acorde al VPS).

---

## 13. Estructura de archivos

```
cms/
├─ astro.config.mjs                  # output: 'server', @astrojs/node, react, tailwind vite
├─ drizzle.config.ts
├─ docker-compose.yml                # app + postgres + minio
├─ Dockerfile
├─ .env.example
├─ nginx/emcosalud-cms.conf          # ejemplo de reverse proxy + TLS
├─ src/
│  ├─ middleware.ts                   # auth, rbac, security headers, csrf
│  ├─ styles/global.css               # @theme (tokens del §1)
│  ├─ layouts/  AdminLayout.astro  AuthLayout.astro
│  ├─ components/
│  │  ├─ ui/            # Design System (islas React): Button, DataTable, Modal, Toast, …
│  │  ├─ admin/         # Sidebar, Topbar, PortalSwitcher, PageHeader
│  │  └─ forms/         # PortalSelector, ImagePicker, RichTextEditor, BulkUploadWizard
│  ├─ pages/
│  │  ├─ login.astro   forgot-password.astro   reset-password.astro
│  │  ├─ admin/
│  │  │  ├─ index.astro                 # Dashboard
│  │  │  ├─ portales/  empresas/  usuarios/  configuracion/  auditoria/
│  │  │  ├─ boletines/  publicaciones/  blog/  capacitaciones/
│  │  │  ├─ certificados/  ( + certificados/carga-masiva )
│  │  │  ├─ popups/   multimedia/
│  │  └─ api/
│  │     ├─ v1/     blog.ts  boletines.ts  publicaciones.ts  capacitaciones.ts
│  │     │          popups.ts  portales/[slug].ts  certificados.ts
│  │     └─ admin/  [module]/...   auth/...   bulk-jobs/...   media/...
│  ├─ server/
│  │  ├─ services/       # portalService, blogService, certificateService, bulkUploadService, auditService, …
│  │  ├─ repositories/   # acceso Drizzle por entidad
│  │  ├─ jobs/           # pg-boss: definición y workers (bulk, schedule, webhooks, stats)
│  │  └─ auth/           # config Better Auth, permissions.ts, guards
│  ├─ lib/
│  │  ├─ db/             # schema.ts (Drizzle), client.ts, migraciones
│  │  ├─ storage/        # cliente S3/MinIO, presign, validación de archivos
│  │  ├─ validations/    # esquemas Zod compartidos cliente/servidor
│  │  └─ utils/          # slug, fechas (TZ Bogotá), filename-pattern parser, csv
│  └─ types/
├─ scripts/  seed.ts   create-superadmin.ts
├─ tests/    unit/  e2e/
└─ docs/
   ├─ README.md
   ├─ INSTALL.md
   ├─ DEPLOYMENT.md
   ├─ API.md
   └─ INTEGRATION.md        # guía para los sitios externos
```

---

## 14. Variables de entorno (`.env.example`)

```
# App
NODE_ENV=production
APP_URL=https://cms.emcosalud.com
PORT=4321

# Base de datos
DATABASE_URL=postgres://cms:__PASSWORD__@localhost:5432/cms

# Auth
AUTH_SECRET=__32B_RANDOM__
SESSION_TTL_HOURS=8
REMEMBER_TTL_DAYS=30

# Storage (MinIO / S3)
STORAGE_ENDPOINT=http://localhost:9000
STORAGE_REGION=us-east-1
STORAGE_ACCESS_KEY=
STORAGE_SECRET_KEY=
STORAGE_BUCKET=cms-media
STORAGE_PUBLIC_URL=https://files.emcosalud.com

# Archivos
MAX_FILE_SIZE=52428800            # 50 MB
MAX_BULK_FILES=5000

# Email (recuperación de contraseña)
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
MAIL_FROM="CMS EMCO SALUD <no-reply@emcosalud.com>"

# Jobs
PGBOSS_SCHEMA=pgboss
WEBHOOK_DEBOUNCE_SECONDS=30
```

---

## 15. Deployment (punto 34)

VPS Linux (Ubuntu 22.04+). **Docker Compose** con tres servicios: `app` (Astro Node standalone),
`postgres:16`, `minio`. Nginx en el host como reverse proxy con TLS (Certbot). Alternativa
documentada sin Docker: Node 22 LTS + PostgreSQL 16 + MinIO como servicios systemd + **PM2** para la
app.

```bash
npm install
npm run build
npm run db:migrate        # drizzle-kit
npm run seed              # portales base, patrones de nombre, superadmin
npm run start             # node ./dist/server/entry.mjs   (o pm2 start)
```

`DEPLOYMENT.md` cubre: instalación de Node/PostgreSQL/MinIO, creación de bucket y política,
variables de entorno, bloque Nginx (proxy, `client_max_body_size`, headers), TLS, arranque con
PM2/Docker, ejecución de migraciones, cron de `pg_dump` + snapshot del bucket, y rotación de logs.

---

## 16. Plan de desarrollo por fases

Cada fase termina con código funcional end-to-end (sin mockups), migraciones, seed actualizado y
una nota de verificación. Se detiene para revisión al final de cada fase.

| Fase | Contenido | Entregable |
|---|---|---|
| **1** | *(este documento)* Arquitectura, stack, Design System, modelo de datos, explicaciones | Aprobación |
| **2** | Scaffolding Astro+React+Tailwind+Drizzle+Better Auth+pg-boss+MinIO; `schema.ts` completo; migraciones; `.env.example`; Docker Compose; seed base | Proyecto arranca, `db:migrate` ok |
| **3** | Design System (componentes `ui/`), `AdminLayout`, `Sidebar`, `Topbar` + selector de portal, Dashboard con stats reales | Dashboard navegable con datos |
| **4** | Autenticación (login, recordar, reset, logout), `middleware.ts`, RBAC, rate limit, auditoría de acceso | Login seguro, rutas protegidas |
| **5** | Módulo **Portales** (CRUD) + API keys | Portales gestionables |
| **6** | Módulo **Empresas** (CRUD) | Empresas gestionables |
| **7** | **Multimedia** (subida presigned, validación, biblioteca, `ImagePicker`) | Biblioteca operativa |
| **8** | `PortalSelector` + **Boletines** (CRUD, distribución, estados) | Boletín multiportal real |
| **9** | **Publicaciones de cartelera** (CRUD, distribución, validación de imagen) | Publicaciones multiportal |
| **10** | **Blog** (Tiptap, slug, tags, SEO/OG, 4 estados, programación, distribución) | Blog multiportal completo |
| **11** | **Capacitaciones** (CRUD, formatos amplios de archivo, distribución) | Capacitaciones multiportal |
| **12** | **Certificados** (CRUD) + **carga masiva** (multi-PDF/ZIP/CSV, worker pg-boss, progreso, reporte de errores, patrones de nombre) | Carga masiva de miles de PDFs |
| **13** | **Popups** (CRUD, portales + páginas, frecuencia, dispositivo, 5 estados, programación) | Popups multiportal |
| **14** | **API pública `/api/v1`** (auth por key, paginación, cache, CORS, resolución multiportal), webhooks de rebuild, SDK `@emcosalud/cms-client` | API consumible |
| **15** | **Usuarios y Configuración** (CRUD usuarios, ajustes, deploy hooks), vista de **Auditoría** | Administración completa |
| **16** | Endurecimiento de seguridad (headers, CSP, CSRF, `npm audit`), optimización (índices, cache de stats, cursores), **docs** (README, INSTALL, DEPLOYMENT, API, INTEGRATION), seed final, migración opcional del `export.xml` de clínica, tests E2E de flujos críticos | Listo para producción |

*(Se conservan los 14 hitos del enunciado; se separan Empresas/Multimedia/Usuarios en fases
propias para mantener cada entrega pequeña y verificable.)*

---

## 17. Verificación (cómo se prueba end-to-end)

- **Arranque**: `docker compose up` → `npm run db:migrate` → `npm run seed` → `http://localhost:4321/login`.
- **Auth**: login con el superadmin del seed; probar rate limit (6 intentos fallidos); flujo de
  reset con MailHog en el compose de desarrollo; verificar que `/admin` sin sesión redirige.
- **Multiportal (prueba dorada)**: crear artículo de blog `General` con Emcosalud+Clínica+Radio;
  `curl -H 'x-api-key: …' '/api/v1/blog?portal=emcosalud'` lo devuelve; `?portal=escuela` no.
  Cambiarlo a `Todos` → aparece también en escuela. Crear el portal Farmacia → el artículo `Todos`
  aparece sin tocar nada más.
- **Carga masiva**: subir un ZIP de 2.000 PDFs de prueba (nombres `123456789-cert.pdf` y
  `CC_123_2026.pdf`); verificar barra de progreso, que 5 archivos corruptos no detienen el job, y
  el CSV de errores.
- **Popups**: popup `general` en `/servicios`, device `mobile`; el endpoint lo devuelve solo con
  `path=/servicios&device=mobile` y no con `path=/contacto`.
- **RBAC**: usuario `editor` recibe 403 en `/api/admin/portales`.
- **Auditoría**: cada acción anterior aparece en `/admin/auditoria` con usuario, módulo, IP, fecha.
- **Tests**: `npm run test` (Vitest servicios: resolución multiportal, parser de nombres, permisos)
  y `npm run test:e2e` (Playwright: login, crear artículo multiportal, carga masiva).

---

## 18. Supuestos y puntos abiertos

- Zona horaria de todas las fechas mostradas/programadas: **America/Bogota**; almacenamiento en UTC.
- Idioma del panel: **español** únicamente (sin i18n en v1).
- Radio se trata como un portal más (mismo modelo de contenidos); si necesita campos propios de
  audio/podcast se añadirá un tipo de contenido dedicado en una fase posterior.
- Migración del `export.xml` de Clínica: **opcional**, al final (Fase 16), como script aparte.
- El SDK `@emcosalud/cms-client` se publica en un registro privado o se copia a cada sitio (a
  decidir en Fase 14).
- Los deploy hooks de cada portal dependen de dónde se alojen finalmente los sitios (hoy sin CI);
  el CMS solo necesita una URL por portal en Configuración.
