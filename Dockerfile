FROM node:24.22.1-alpine AS base
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci
COPY . .
RUN npm run db:generate && NODE_OPTIONS=--max-old-space-size=1536 npm run build && npm prune --omit=dev
RUN mkdir -p /app/data && chown -R node:node /app/data /app/.next
USER node
ENV NODE_OPTIONS=--require=/app/scripts/runtime-config.cjs
EXPOSE 3000
CMD ["sh", "-c", "npx prisma migrate deploy && exec npm run start"]
