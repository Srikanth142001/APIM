# ── NexGen APIM Backend ──────────────────────────────────────────────────────
FROM node:18-alpine

LABEL maintainer="NexGen APIM Team"
LABEL description="NexGen APIM Monitoring Backend"

WORKDIR /usr/src/app

# Install dependencies first (layer cache)
COPY package*.json ./
RUN npm ci --only=production

# Copy source
COPY . .

# Remove .env — all config via runtime env vars
RUN rm -f .env

# Non-root user for security
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser

ENV PORT=5000
ENV NODE_ENV=production

EXPOSE ${PORT}

HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD wget -qO- http://localhost:${PORT}/api/overview?range=1h || exit 1

CMD ["node", "index.js"]
