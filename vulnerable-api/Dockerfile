# ─────────────────────────────────────────────────────────────
# Vulnerable API Laboratory — Dockerfile
# ⚠️  FOR TESTING PURPOSES ONLY — Contains intentional vulnerabilities
# ─────────────────────────────────────────────────────────────

# Stage 1: Build
FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install

COPY tsconfig.json ./
COPY src/ ./src/

RUN npm run build

# Stage 2: Production
FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install --omit=dev

COPY --from=builder /app/dist ./dist
COPY .env* ./

EXPOSE 5001

ENV PORT=5001
ENV NODE_ENV=development
ENV JWT_SECRET=super-insecure-secret-key-12345

CMD ["node", "dist/server.js"]
