# Integración de un sitio con el CMS

Los sitios (Astro estáticos) consumen su contenido en el **build** y se reconstruyen
por webhook cuando se publica algo. Los popups se piden en **runtime**.

## 1. Variables de entorno del sitio

```
CMS_API_URL=https://cms.emcosalud.com/api/v1
CMS_API_KEY=emc_emcosalud_xxxxxxxxxxxx
```

(La clave se crea en el panel: Portales → Claves de API.)

## 2. Cliente

Copia `sdk/cms-client/` a `src/lib/cms-client/` en el sitio (o publícalo como
paquete privado `@emcosalud/cms-client`). Solo usa `fetch`, compatible con Astro 4/5.

```ts
// src/lib/cms.ts
import { createCmsClient } from '@emcosalud/cms-client';

export const cms = createCmsClient({
  baseUrl: import.meta.env.CMS_API_URL,
  apiKey: import.meta.env.CMS_API_KEY,
  portal: 'emcosalud', // el slug de este sitio
});
```

## 3. Contenido en build-time

```astro
---
// src/pages/noticias/index.astro
import { cms } from '@/lib/cms';
const { data: posts } = await cms.blog.list({ page: 1, limit: 12 });
---
{posts.map((p) => <a href={`/noticias/${p.slug}`}>{p.title}</a>)}
```

```astro
---
// src/pages/noticias/[slug].astro
import { cms } from '@/lib/cms';
export async function getStaticPaths() {
  const { data } = await cms.blog.list({ limit: 100 });
  return data.map((p) => ({ params: { slug: p.slug }, props: { post: p } }));
}
const { post } = Astro.props;
---
<article set:html={post.contentHtml} />
```

Boletines, publicaciones y capacitaciones se consumen igual
(`cms.boletines.list()`, etc.).

### Estados financieros (build-time)

```astro
---
// src/pages/estados-financieros.astro
import { cms } from '@/lib/cms';
const { data } = await cms.estadosFinancieros.list();   // opcional: { year: 2025 }
---
{data.map((ef) => (
  <section>
    <h2>{ef.title ?? `Estados Financieros ${ef.fiscalYear}`}</h2>
    <ul>
      {ef.files.map((f) => <li><a href={f.url}>{f.label}</a></li>)}
    </ul>
  </section>
))}
```

## 3b. Banners hero / slider (portada, build-time o runtime)

Los banners salen **fijos en la página de inicio** del portal. Ya vienen ordenados por
`sortOrder`; el visitante solo navega entre imágenes (no se cierran).

```astro
---
// src/pages/index.astro
import { cms } from '@/lib/cms';
const banners = await cms.banners.list();
---
<div class="hero-carousel">
  {banners.map((b) => (
    <a href={b.url ?? '#'}>
      <img src={b.imageUrl} alt={b.title ?? ''} />
    </a>
  ))}
</div>
```

Si se consume en build-time, un banner programado que aún no ha empezado no aparece hasta la
siguiente reconstrucción; para franjas sensibles al tiempo, pídelos en runtime como los popups
(`createCmsClient(...).banners.list()`).

## 4. Popups en runtime (client-side)

```ts
import { createCmsClient } from '@emcosalud/cms-client';

const cms = createCmsClient({
  baseUrl: 'https://cms.emcosalud.com/api/v1',
  apiKey: 'emc_emcosalud_xxxx', // clave pública de lectura del portal
  portal: 'emcosalud',
});

function device() {
  const w = window.innerWidth;
  return w < 768 ? 'mobile' : w < 1024 ? 'tablet' : 'desktop';
}

const popups = await cms.popups.forPage(location.pathname, device());
// Aplicar reglas de frecuencia con localStorage y mostrar el de mayor priority:
for (const p of popups) {
  const key = `popup:${p.id}`;
  if (p.frequency === 'once_session' && sessionStorage.getItem(key)) continue;
  if (p.frequency === 'once_user' && localStorage.getItem(key)) continue;
  if (p.frequency === 'every_x_days') {
    const last = Number(localStorage.getItem(key) ?? 0);
    if (Date.now() - last < (p.frequencyDays ?? 1) * 86400000) continue;
  }
  render(p);
  sessionStorage.setItem(key, '1');
  localStorage.setItem(key, String(Date.now()));
  break;
}
```

## 5. Reconstrucción automática

En el panel, **Portales → (portal) → Deploy hook**: pega la URL del build hook de tu
host (Netlify, Vercel, GitHub Actions `repository_dispatch`, o un script propio).
Al publicar contenido para ese portal, el CMS lo llama con *debounce* de 30 s.

## 6. Consulta de certificados

```ts
try {
  const cert = await cms.certificados.find('900123456-7', 2026, '123456789');
  // cert.pdfUrl
} catch (e) {
  // 404 si no existe
}
```
