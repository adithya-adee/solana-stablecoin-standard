# Use a build stage to create the distributable files
FROM node:20-alpine AS builder

RUN corepack enable && corepack prepare pnpm@10.28.0 --activate
WORKDIR /app

# Copy all source code
COPY . .

# Install dependencies and build the specific service
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @sss/webhook-service build

# Use a clean production stage
FROM node:20-alpine

RUN corepack enable && corepack prepare pnpm@10.28.0 --activate
WORKDIR /app

# Copy manifests
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY solana-stablecoin-backend/webhook-service/package.json ./solana-stablecoin-backend/webhook-service/

# Install ONLY production dependencies
RUN pnpm install --prod --frozen-lockfile

# Copy only the built application from the builder stage
COPY --from=builder /app/solana-stablecoin-backend/webhook-service/dist ./solana-stablecoin-backend/webhook-service/dist

WORKDIR /app/solana-stablecoin-backend/webhook-service

EXPOSE 3004
CMD ["node", "dist/index.js"]
