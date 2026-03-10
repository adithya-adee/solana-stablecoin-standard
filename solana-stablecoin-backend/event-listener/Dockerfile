# Use a build stage to create the distributable files
FROM node:20-alpine AS builder

RUN corepack enable && corepack prepare pnpm@10.28.0 --activate
WORKDIR /app

# Copy all source code
COPY . .

# Install dependencies and build the SDK and the specific service
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @stbr/sss-token build
RUN pnpm --filter @sss/event-listener build

# Use a clean production stage
FROM node:20-alpine

RUN corepack enable && corepack prepare pnpm@10.28.0 --activate
WORKDIR /app

# Copy root manifests
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

# Copy package.json files for the service and its workspace dependencies
COPY solana-stablecoin-sdk/package.json ./solana-stablecoin-sdk/
COPY solana-stablecoin-backend/event-listener/package.json ./solana-stablecoin-backend/event-listener/

# Install ONLY production dependencies
RUN pnpm install --prod --frozen-lockfile

# Copy only the built artifacts from the builder stage
COPY --from=builder /app/solana-stablecoin-sdk/dist ./solana-stablecoin-sdk/dist
COPY --from=builder /app/solana-stablecoin-backend/event-listener/dist ./solana-stablecoin-backend/event-listener/dist

WORKDIR /app/solana-stablecoin-backend/event-listener

EXPOSE 3002
CMD ["node", "dist/index.js"]
