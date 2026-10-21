# ── build ──────────────────────────────────────────────
FROM node:22-slim AS build
WORKDIR /app
ENV NODE_ENV=development
COPY package*.json ./
RUN npm install --include=dev --ignore-scripts
COPY . .
RUN npm run build

# ── runtime ────────────────────────────────────────────
FROM node:22-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=4321

COPY package*.json ./
RUN npm install --omit=dev --ignore-scripts && npm cache clean --force

# Copiamos solo lo estrictamente necesario para producción
COPY --from=build /app/public ./public
COPY --from=build /app/dist ./dist
COPY --from=build /app/drizzle ./drizzle
COPY --from=build /app/scripts ./scripts

EXPOSE 4321
CMD ["node", "./dist/server/entry.mjs"]
