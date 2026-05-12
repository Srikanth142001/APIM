# ── NexGen APIM Frontend ─────────────────────────────────────────────────────
# Stage 1: Build React app
FROM node:18-alpine AS build

LABEL maintainer="NexGen APIM Team"

WORKDIR /usr/src/app

COPY package*.json ./
RUN npm ci

COPY . .

# Build-time args (baked into JS bundle)
ARG REACT_APP_REGION_NAME=SAN Region
ARG REACT_APP_API_PROTOCOL=http
ARG REACT_APP_API_HOSTNAME=172.30.38.193
ARG REACT_APP_API_PORT=5005

ENV REACT_APP_REGION_NAME=$REACT_APP_REGION_NAME
ENV REACT_APP_API_PROTOCOL=$REACT_APP_API_PROTOCOL
ENV REACT_APP_API_HOSTNAME=$REACT_APP_API_HOSTNAME
ENV REACT_APP_API_PORT=$REACT_APP_API_PORT

RUN npm run build

# ── Stage 2: Serve with Nginx ─────────────────────────────────────────────────
FROM nginx:1.25-alpine

RUN apk add --no-cache gettext

# Remove default config
RUN rm /etc/nginx/conf.d/default.conf

COPY nginx.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /usr/src/app/build /usr/share/nginx/html
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

ENV PORT=80
ENV NODE_ENV=production

EXPOSE ${PORT}

HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:${PORT}/health || exit 1

ENTRYPOINT ["/docker-entrypoint.sh"]
CMD ["nginx", "-g", "daemon off;"]
