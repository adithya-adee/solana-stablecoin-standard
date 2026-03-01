FROM node:22-alpine AS builder
WORKDIR /app

# Copy workspace-level files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY solana-stablecoin-sdk/package.json solana-stablecoin-sdk/
COPY solana-stablecoin-backend/package.json solana-stablecoin-backend/

# Install dependencies
RUN corepack enable && pnpm install --frozen-lockfile

# Copy source code
COPY solana-stablecoin-sdk/ solana-stablecoin-sdk/
COPY solana-stablecoin-backend/ solana-stablecoin-backend/

# Copy IDL artifacts required by SDK
COPY target/idl/ target/idl/
COPY target/types/ target/types/

# Build SDK first (backend depends on it), then backend
RUN pnpm --filter @stbr/sss-token build
RUN pnpm --filter sss-backend build

# Production stage
FROM node:22-alpine
WORKDIR /app

COPY --from=builder /app/solana-stablecoin-backend/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/solana-stablecoin-backend/node_modules ./solana-stablecoin-backend/node_modules
COPY --from=builder /app/solana-stablecoin-sdk/dist ./solana-stablecoin-sdk/dist

RUN addgroup -S sss && adduser -S sss -G sss
USER sss

EXPOSE 3000

CMD ["node", "dist/main.js"]
