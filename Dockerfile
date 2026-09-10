# syntax=docker/dockerfile:1

# ---- Builder -----------------------------------------------------------
FROM node:20-alpine AS builder

WORKDIR /app

# Copy manifests first so dependency layers cache across source changes.
COPY package.json package-lock.json ./
RUN npm ci

COPY . .

ARG VITE_API_URL=http://localhost:8000
ENV VITE_API_URL=$VITE_API_URL

RUN npm run build

# ---- Runtime -----------------------------------------------------------
FROM node:20-alpine AS runtime

ENV NODE_ENV=production
WORKDIR /app

RUN addgroup -g 1001 propiq && adduser -u 1001 -G propiq -s /bin/sh -D propiq

COPY --from=builder --chown=propiq:propiq /app/dist ./dist
COPY --from=builder --chown=propiq:propiq /app/package.json ./

RUN npm install -g serve@14 && npm cache clean --force

USER propiq

EXPOSE 5173

CMD ["serve", "-s", "dist/client", "-l", "5173"]
