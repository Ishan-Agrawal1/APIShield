FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install

COPY tsconfig.json ./
COPY src/ ./src/

RUN npm run compile

FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install --omit=dev

COPY --from=builder /app/dist ./dist
COPY openapi.yaml ./openapi.yaml

EXPOSE 5001

ENV PORT=5001
ENV NODE_ENV=development
ENV JWT_SECRET=lab-only-not-a-real-secret
ENV JWT_EXPIRES_IN=24h
ENV LOG_FILE=logs/http-events.jsonl

CMD ["node", "dist/server.js"]
