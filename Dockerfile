# ── build ──────────────────────────────────────────────
FROM node:22-slim AS build
WORKDIR /app
ENV NODE_ENV=development
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# ── runtime ────────────────────────────────────────────
FROM node:22-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=4321

COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=build /app/dist ./dist
COPY --from=build /app/drizzle ./drizzle
COPY --from=build /app/scripts ./scripts
# Copiamos todo el src por si las migraciones importan los esquemas directamente desde ahí
COPY --from=build /app/src ./src
COPY drizzle.config.ts ./

EXPOSE 4321
CMD ["node", "./dist/server/entry.mjs"]
