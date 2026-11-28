# syntax=docker/dockerfile:1

# using alpine base image to avoid `sharp` memory leaks.
# @see https://sharp.pixelplumbing.com/install#linux-memory-allocator

ARG NODE_VERSION
ARG PNPM_VERSION

# build
FROM node:${NODE_VERSION:?required}-alpine AS build

ARG PNPM_VERSION
RUN npm install --global --no-audit --no-fund "pnpm@${PNPM_VERSION:?build arg is required}"

RUN mkdir /app && chown -R node:node /app
WORKDIR /app

USER node

COPY --chown=node:node package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY ./patches ./patches

ENV CI=true
ENV PNPM_CONFIG_RUNTIME=false

RUN pnpm fetch

COPY --chown=node:node ./ ./

RUN pnpm install --frozen-lockfile --offline

ENV BUILD_MODE=standalone
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

ARG NEXT_PUBLIC_APP_BASE_URL
ARG NEXT_PUBLIC_BOTS
ARG NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION
ARG NEXT_PUBLIC_IMPRINT_SERVICE_BASE_URL
ARG NEXT_PUBLIC_MATOMO_BASE_URL
ARG NEXT_PUBLIC_MATOMO_ID
ARG NEXT_PUBLIC_REDMINE_ID
ARG NEXT_PUBLIC_TYPESENSE_COLLECTION_PREFIX
ARG NEXT_PUBLIC_TYPESENSE_COLLECTIONS
ARG NEXT_PUBLIC_TYPESENSE_HOST
ARG NEXT_PUBLIC_TYPESENSE_PORT
ARG NEXT_PUBLIC_TYPESENSE_PROTOCOL
ARG NEXT_PUBLIC_TYPESENSE_SEARCH_API_KEY

# enables version skew protection.
# @see https://nextjs.org/docs/app/guides/self-hosting#version-skew
ARG NEXT_DEPLOYMENT_ID
ENV NEXT_DEPLOYMENT_ID="${NEXT_DEPLOYMENT_ID}"

# disable validation for runtime environment variables
ENV ENV_VALIDATION=public

# to mount secrets which need to be available at build time
# @see https://docs.docker.com/build/building/secrets/
RUN pnpm run build

# serve
FROM node:${NODE_VERSION}-alpine AS serve

# the server only needs `node`.
RUN rm -rf /usr/local/lib/node_modules/npm /usr/local/bin/npm /usr/local/bin/npx

RUN mkdir /app && chown -R node:node /app
WORKDIR /app

USER node

COPY --from=build --chown=node:node /app/public ./public
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static

# ensure folder is owned by node:node when mounted as volume
RUN mkdir -p /app/.next/cache/images

ENV HOSTNAME=0.0.0.0
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000

EXPOSE 3000

CMD ["node", "server.js"]
