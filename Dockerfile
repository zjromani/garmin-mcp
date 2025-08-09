# Node 20 base
FROM node:20-slim
WORKDIR /app

ENV NODE_ENV=production
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev

COPY tsconfig.json ./
COPY src ./src
RUN npx tsc -p tsconfig.json

EXPOSE 8080
CMD ["node", "dist/server.js"]
