# Frontend Next.js Dockerfile

FROM node:18-alpine AS base
WORKDIR /app

# Install dependencies only when needed
COPY package*.json ./
RUN npm ci

# Copy source code
COPY . .

# Build the application
RUN npm run build

EXPOSE 3000

CMD ["npm", "start"]
