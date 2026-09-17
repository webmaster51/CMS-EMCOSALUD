# Despliegue en producción — CMS EMCO SALUD

VPS Linux (Ubuntu 22.04+). Dos opciones: **Docker Compose** (recomendada) o
**Node + PM2** con servicios del sistema.

---

## Arquitectura del despliegue

```
Internet ─▶ Nginx (TLS, :443) ─▶ app (Node standalone, :4321)
                                   ├─▶ PostgreSQL 16
                                   └─▶ MinIO (S3)  ◀── files.<dominio>
```

---

## Opción A — Docker Compose

`docker-compose.yml` ya define `app`, `postgres`, `minio` y `minio-init`
(el `mailhog` es solo para desarrollo).

```bash
git clone <repo> cms && cd cms
cp .env.example .env
# Edita .env:
#   NODE_ENV=production
#   APP_URL=https://cms.emcosalud.com
#   AUTH_SECRET=<32+ bytes aleatorios>
#   DATABASE_URL=postgres://cms:<clave>@postgres:5432/cms
#   DB_DRIVER=pg
#   STORAGE_DRIVER=s3
#   STORAGE_ENDPOINT=http://minio:9000
#   STORAGE_PUBLIC_URL=https://files.emcosalud.com
#   STORAGE_ACCESS_KEY / STORAGE_SECRET_KEY  (cambia los de por defecto)
#   SMTP_* reales
#   SEED_SUPERADMIN_EMAIL / SEED_SUPERADMIN_PASSWORD

docker compose build
docker compose up -d postgres minio minio-init
docker compose run --rm app npm run db:migrate
docker compose run --rm app npm run seed
docker compose up -d app
```

La app arranca aplicando migraciones (`command` en el compose) y queda en
`127.0.0.1:4321`.

---

## Opción B — Node + PM2

```bash
# Node 22, PostgreSQL 16 y MinIO instalados como servicios systemd.
npm ci
npm run build
npm run db:migrate
npm run seed
pm2 start "node ./dist/server/entry.mjs" --name emcosalud-cms \
  --env NODE_ENV=production
pm2 save && pm2 startup
```

Las variables de entorno se toman del entorno del proceso (PM2 `--env` o un
`ecosystem.config.cjs`); en producción **no** se lee `.env` automáticamente para
el servidor (sí para los scripts).

---

## Nginx + TLS

```nginx
server {
  listen 80;
  server_name cms.emcosalud.com;
  return 301 https://$host$request_uri;
}

server {
  listen 443 ssl http2;
  server_name cms.emcosalud.com;

  ssl_certificate     /etc/letsencrypt/live/cms.emcosalud.com/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/cms.emcosalud.com/privkey.pem;

  client_max_body_size 250M;   # cargas masivas de certificados / ZIP

  location / {
    proxy_pass http://127.0.0.1:4321;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_read_timeout 120s;
  }
}
```

```bash
sudo certbot --nginx -d cms.emcosalud.com
```

Sirve MinIO en `files.emcosalud.com` con otro bloque `server` que haga
`proxy_pass http://127.0.0.1:9000;` (o usa Cloudflare R2 y ajusta
`STORAGE_PUBLIC_URL`).

> La app confía en `X-Forwarded-*` para la IP de auditoría y para las cookies
> `Secure`. `NODE_ENV=production` activa cookies `Secure` + HSTS + la CSP con
> hashes.

---

## Migraciones

- Cada despliegue: `npm run db:migrate` (o el `command` del contenedor lo hace).
- Genera migraciones incrementales en desarrollo: `npm run db:generate`, revisa
  el SQL en `./drizzle/`, commitea.

---

## Backups

```bash
# Base de datos — cron diario, retención 14 días
0 3 * * * docker compose exec -T postgres pg_dump -U cms cms | gzip > /backups/cms-$(date +\%F).sql.gz
find /backups -name 'cms-*.sql.gz' -mtime +14 -delete

# Storage — réplica del bucket
0 4 * * * mc mirror --overwrite local/cms-media /backups/media/
```

Restauración: `gunzip -c cms-YYYY-MM-DD.sql.gz | docker compose exec -T postgres psql -U cms cms`.

---

## Operación

- **Logs**: `pino` en JSON a stdout. Con Docker: `docker compose logs -f app`.
  Rota con `logrotate` (Docker) o `pm2-logrotate`.
- **Salud**: `curl -sf https://cms.emcosalud.com/login` debe devolver 200.
- **Planificador**: corre dentro del proceso de la app (publica contenido
  programado, activa/finaliza popups, refresca la caché del dashboard y reanuda
  cargas masivas interrumpidas). Con **varias instancias** conviene ejecutar una
  sola con el planificador activo, o migrar a pg-boss (dependencia ya incluida).
- **Deploy hooks**: configúralos por portal en el panel (Portales → editar →
  *Deploy hook*). Al publicar contenido, el CMS llama a cada hook con debounce.

---

## Checklist de puesta en producción

- [ ] `AUTH_SECRET` único y secreto (32+ bytes).
- [ ] Credenciales de PostgreSQL y MinIO cambiadas (no `minioadmin`).
- [ ] `NODE_ENV=production`, `APP_URL` con `https://`.
- [ ] SMTP real configurado y probado (recuperación de contraseña).
- [ ] TLS activo; `curl -I` muestra `Strict-Transport-Security` y
      `Content-Security-Policy` con hashes.
- [ ] `client_max_body_size` en Nginx ≥ 250M.
- [ ] Cron de `pg_dump` y réplica del bucket funcionando.
- [ ] Bucket `cms-media` con política de lectura pública (o CDN delante).
