# Production image for the ZINU API. Build from the repository root:
#   docker build -f apps/api/Dockerfile -t zinu-api .
FROM node:22-bookworm-slim AS build
WORKDIR /repo
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
RUN pnpm install --frozen-lockfile --filter @zinu/api... --ignore-scripts && pnpm rebuild argon2
COPY packages/shared packages/shared
COPY apps/api apps/api
RUN pnpm --filter @zinu/shared build && pnpm --filter @zinu/api build \
 && pnpm --filter @zinu/api deploy --legacy --prod /out

FROM node:22-bookworm-slim
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build --chown=node:node /out .
USER node
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s CMD node -e "fetch('http://localhost:4000/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
# Run migrations as a separate one-off task on deploy: node dist/db/migrate.js
CMD ["node", "dist/main.js"]
