FROM node:25-slim AS build
WORKDIR /app

COPY package.json package-lock.json* tsconfig.base.json ./
COPY apps ./apps
COPY packages ./packages

RUN npm install
RUN npm run build

FROM node:25-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3088
ENV LINK_STEWARD_DATA_DIR=/data
ENV LINK_STEWARD_WEB_DIST_DIR=/app/apps/web/dist

COPY package.json package-lock.json* ./
COPY apps/server/package.json ./apps/server/package.json
RUN npm install --omit=dev --workspace @link-steward/server

COPY --from=build /app/apps/server/dist ./apps/server/dist
COPY --from=build /app/apps/web/dist ./apps/web/dist

EXPOSE 3088
CMD ["npm", "--workspace", "@link-steward/server", "run", "start"]
