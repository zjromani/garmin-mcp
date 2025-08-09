# Node 20 base
FROM node:20-slim
WORKDIR /app

# Copy package files
COPY package.json package-lock.json* ./

# Install all dependencies (including dev dependencies for TypeScript compilation)
RUN npm ci

# Copy source files
COPY tsconfig.json ./
COPY src ./src

# Build TypeScript
RUN npx tsc -p tsconfig.json

# Remove dev dependencies to reduce image size
RUN npm prune --omit=dev

EXPOSE 8080
CMD ["node", "dist/server.js"]
