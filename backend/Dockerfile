# Stage 1: Build stage
FROM node:24-alpine AS builder
WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN npx prisma generate
RUN npm run build

# Stage 2: Production runner stage
FROM node:24-alpine AS runner
WORKDIR /app

# Kopiere package.json, falls Skripte benötigt werden
COPY package*.json ./

# Statt npm ci im Runner zu machen, kopieren wir alle production-ready node_modules direkt aus dem Builder!
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist

EXPOSE 3000
CMD ["node", "dist/main.js"]