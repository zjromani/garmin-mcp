FROM node:20-slim
WORKDIR /app

RUN apt-get update && apt-get install -y curl && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json* ./
RUN npm ci

COPY tsconfig.json ./
COPY src ./src
RUN npx tsc -p tsconfig.json
RUN npm prune --omit=dev

EXPOSE 8080
CMD ["node", "dist/server.js"]
