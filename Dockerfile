# syntax=docker/dockerfile:1

# Build context is the workspace root (~/work/olb), because @olb/contract is a
# `file:../olb-contract` dependency and must be visible next to this repository.
FROM node:22-alpine AS build
WORKDIR /app

# Public origin baked into the client bundle. The browser reaches the API
# through the published host port, not through the compose network.
ARG NEXT_PUBLIC_API_URL=http://localhost:3201
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL

COPY olb-contract ./olb-contract
RUN npm ci --prefix olb-contract

COPY olb-web/package.json olb-web/package-lock.json ./olb-web/
RUN npm ci --prefix olb-web

COPY olb-web ./olb-web
RUN npm run build --prefix olb-web

FROM node:22-alpine AS runtime
ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0
WORKDIR /app

COPY --from=build /app/olb-web/.next/standalone ./
COPY --from=build /app/olb-web/.next/static ./.next/static

USER node
EXPOSE 3000

HEALTHCHECK --interval=10s --timeout=3s --start-period=20s --retries=5 \
  CMD wget -qO- http://127.0.0.1:3000/ >/dev/null || exit 1

CMD ["node", "server.js"]
