# API pública `/api/v1` — CMS EMCO SALUD

Cada sitio consume **solo su propio contenido** usando una **clave de API por portal**.

## Autenticación

Todas las peticiones llevan la cabecera:

```
x-api-key: emc_<portal>_<secreto>
```

La clave se genera en el panel: **Portales → (portal) → Claves de API**. Se muestra
una única vez. Cada clave está ligada a un portal; el parámetro `?portal=<slug>` es
opcional y, si se envía, debe coincidir con el portal de la clave (si no, `403`).

- Sin clave o clave revocada → `401`.
- Límite: **120 solicitudes/minuto por clave** → `429`.
- CORS: la respuesta permite el origen igual a la `url` del portal.
- Caché: `Cache-Control: public, s-maxage=300, stale-while-revalidate=600` + `ETag`
  (soporta `If-None-Match` → `304`). Los popups usan `s-maxage=60`.

## Formato

Listados:

```json
{ "data": [ /* … */ ], "meta": { "page": 1, "limit": 20, "total": 42, "totalPages": 3 } }
```

Parámetros de listado comunes: `page`, `limit` (máx. 100), `category` (slug),
`search`, `since` (ISO 8601). El blog además acepta `tag` (slug).

## Endpoints

| Método | Ruta | Descripción |
| --- | --- | --- |
| GET | `/api/v1/portales/:slug` | Metadata pública del portal (solo el propio de la clave) |
| GET | `/api/v1/blog` | Artículos publicados y visibles para el portal |
| GET | `/api/v1/blog/:slug` | Un artículo por slug |
| GET | `/api/v1/boletines` | Boletines publicados |
| GET | `/api/v1/publicaciones` | Publicaciones de cartelera publicadas |
| GET | `/api/v1/capacitaciones` | Material de capacitación publicado |
| GET | `/api/v1/popups?path=/ruta&device=mobile` | Popups activos para esa página y dispositivo |
| GET | `/api/v1/banners` | Banners hero / slider activos de la página de inicio del portal, ordenados por `sortOrder` |
| GET | `/api/v1/estados-financieros?year=<n>&page=1` | Estados financieros publicados y visibles para el portal |
| GET | `/api/v1/certificados?company=<NIT>&year=<n>&document=<n>` | Consulta puntual de un certificado |

### Resolución multiportal

El contenido aparece para el portal si su `distribution_type` es `all`, **o** si el
portal está en su lista (`specific` / `general`). Un contenido `all` aparece también
en portales creados después, sin ningún cambio.

Para popups se aplican además: estado `active`, dentro del rango de fechas,
`device` compatible, y `page_mode = all_pages` o la ruta exacta en su lista.

Los **banners** salen fijos en la página de inicio del portal: se filtran por estado `active`,
rango de fechas y resolución multiportal (sin eje de páginas ni de dispositivo), y se devuelven
ordenados por `sortOrder` ascendente para montar el carrusel. El visitante solo navega entre
imágenes; no hay opción de cierre.

Los **estados financieros** se devuelven solo en estado `published`; `?year=` filtra por año
gravable. Cada elemento incluye `files: [{ label, url }]` con los documentos en su orden.

## Ejemplos

```bash
curl -H "x-api-key: $KEY" "https://cms.emcosalud.com/api/v1/blog?portal=emcosalud&page=1"
curl -H "x-api-key: $KEY" "https://cms.emcosalud.com/api/v1/blog/campana-de-prevencion?portal=emcosalud"
curl -H "x-api-key: $KEY" "https://cms.emcosalud.com/api/v1/popups?portal=emcosalud&path=/servicios&device=mobile"
curl -H "x-api-key: $KEY" "https://cms.emcosalud.com/api/v1/banners?portal=emcosalud"
curl -H "x-api-key: $KEY" "https://cms.emcosalud.com/api/v1/estados-financieros?portal=emcosalud&year=2025"
```

## Webhooks de reconstrucción

Al publicar/despublicar contenido, el CMS hace `POST` al **deploy hook** configurado
en cada portal afectado (con *debounce* y 3 reintentos):

```
POST <deployHookUrl>
{ "trigger": "emcosalud-cms", "reason": "blog.create" }
```
