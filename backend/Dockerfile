# WiFi AR API. One image: Node 22 + the compiled Prisma client + tsx runtime.
# Debian slim (not Alpine) because Prisma's query engine wants glibc + OpenSSL 3.
FROM node:22-bookworm-slim

RUN apt-get update \
 && apt-get install -y --no-install-recommends openssl ca-certificates \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app
ENV NODE_ENV=production

# Dependencies first, so source edits don't re-run npm ci.
# --include=dev keeps prisma/tsx: the server runs TypeScript directly via tsx.
COPY package.json package-lock.json ./
RUN npm ci --include=dev

COPY prisma ./prisma
RUN npx prisma generate

COPY tsconfig.json ./
COPY src ./src
COPY docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh

EXPOSE 4000
ENTRYPOINT ["./docker-entrypoint.sh"]
