FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --production
COPY . .
# Data directory for SQLite DB — mount a volume here to persist environments
RUN mkdir -p /app/data
EXPOSE 5001
CMD ["node", "index.js"]
