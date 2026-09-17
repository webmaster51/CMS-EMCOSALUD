import type { APIRoute } from 'astro';
import { db } from '@/lib/db/client';
import { banners, bannerPortals, media } from '@/lib/db/schema';
import { and, eq, isNull, asc } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { mediaUrl } from '@/server/repositories/portalRepository';

export const prerender = false;

const bannerMedia = alias(media, 'banner_media');
const mobileBannerMedia = alias(media, 'mobile_banner_media');

export const GET: APIRoute = async ({ url }) => {
  try {
    const portalIdParam = url.searchParams.get('portalId');
    
    // Si no mandan portalId, puedes retornar un array vacío o manejar un fallback
    if (!portalIdParam) {
      return new Response(
        JSON.stringify({ success: false, error: 'portalId es requerido' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const portalId = Number(portalIdParam);

    // Consultamos únicamente los banners activos, no eliminados Y que estén asociados a este portal específico
    const rows = await db
      .select({
        id: banners.id,
        title: banners.title,
        subtitle: banners.subtitle,
        description: banners.description,
        buttonText: banners.buttonText,
        url: banners.url,
        linkType: banners.linkType,
        sortOrder: banners.sortOrder,
        imgThumb: bannerMedia.thumbnailKey,
        imgKey: bannerMedia.storageKey,
        mobileThumb: mobileBannerMedia.thumbnailKey,
        mobileKey: mobileBannerMedia.storageKey,
      })
      .from(banners)
      .innerJoin(bannerPortals, eq(bannerPortals.bannerId, banners.id)) // <--- Obliga a que tenga relación con el portal
      .leftJoin(bannerMedia, eq(bannerMedia.id, banners.imageMediaId))
      .leftJoin(mobileBannerMedia, eq(mobileBannerMedia.id, banners.mobileImageMediaId))
      .where(
        and(
          eq(banners.status, 'active'),
          isNull(banners.deletedAt),
          eq(bannerPortals.portalId, portalId) // <--- Filtro estricto por portal
        )
      )
      .orderBy(asc(banners.sortOrder));

    const data = rows.map((r) => ({
      id: r.id,
      title: r.title,
      subtitle: r.subtitle,
      description: r.description,
      buttonText: r.buttonText,
      url: r.url,
      linkType: r.linkType,
      imageUrl: mediaUrl(r.imgThumb, r.imgKey),
      mobileImageUrl: mediaUrl(r.mobileThumb, r.mobileKey),
    }));

    return new Response(
      JSON.stringify({ success: true, data }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error al obtener los banners por portal:', error);
    return new Response(
      JSON.stringify({ success: false, error: 'Error interno' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};