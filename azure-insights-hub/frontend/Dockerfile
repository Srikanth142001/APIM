FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
# Build with placeholder values — real values injected at runtime via entrypoint
ENV REACT_APP_API_PROTOCOL=http
ENV REACT_APP_API_HOSTNAME=__API_HOSTNAME__
ENV REACT_APP_API_PORT=__API_PORT__
ENV GENERATE_SOURCEMAP=false
ENV CI=false
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/build /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh
EXPOSE 80
ENTRYPOINT ["/docker-entrypoint.sh"]
