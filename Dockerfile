FROM node:24.22.1-alpine AS base
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci
COPY . .
RUN npm run db:generate && npm run build && npm prune --omit=dev
EXPOSE 3000
CMD ["sh", "-c", "npx prisma migrate deploy && npm run start"]
