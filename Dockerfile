FROM node:24-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm test && npm run build

FROM node:24-alpine AS api

ENV NODE_ENV=production
ENV PORT=3000
WORKDIR /app

COPY package.json ./
COPY --chown=node:node server/server.mjs ./server/server.mjs
COPY --chown=node:node src/lib/boxPlanner.js ./src/lib/boxPlanner.js
COPY --chown=node:node src/data/pokemon.json ./src/data/pokemon.json

RUN mkdir -p /data && chown node:node /data

USER node
EXPOSE 3000
HEALTHCHECK --interval=10s --timeout=3s --start-period=5s --retries=5 \
  CMD wget -q -O /dev/null http://127.0.0.1:3000/api/health || exit 1

CMD ["node", "server/server.mjs"]

FROM nginx:1.28-alpine AS web

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80
