# syntax=docker/dockerfile:1

# Build context is the parent directory of this repository (~/work/olb), because
# @olb/contract is consumed as a file: dependency.
FROM node:24-alpine AS build
WORKDIR /app

# Inlined into the client bundle at build time. The browser reaches the API
# through the host port, not through the compose network.
ARG NEXT_PUBLIC_API_URL=http://localhost:3001
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL

COPY olb-contract ./olb-contract
COPY olb-web/package.json olb-web/package-lock.json ./olb-web/
RUN npm ci --prefix olb-web

COPY olb-web ./olb-web
RUN npm run build --prefix olb-web

FROM node:24-alpine AS runtime
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
