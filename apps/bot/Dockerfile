FROM node:20-alpine AS builder

WORKDIR /app

# Dépendances système pour better-sqlite3
RUN apk add --no-cache python3 make g++

COPY package.json tsconfig.base.json ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/bot/package.json ./apps/bot/

RUN npm install

COPY packages/shared ./packages/shared
COPY apps/bot ./apps/bot

RUN npm run build --workspace=@sciclub/shared
RUN npm run build --workspace=@sciclub/bot

FROM node:20-alpine AS runner

WORKDIR /app

RUN apk add --no-cache sqlite-libs

ENV NODE_ENV=production

COPY --from=builder /app/package.json ./
COPY --from=builder /app/packages/shared/package.json ./packages/shared/
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/apps/bot/package.json ./apps/bot/
COPY --from=builder /app/apps/bot/dist ./apps/bot/dist
COPY --from=builder /app/apps/bot/src/database/schema.sql ./apps/bot/dist/database/schema.sql
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/bot/node_modules ./apps/bot/node_modules

CMD ["node", "apps/bot/dist/index.js"]
