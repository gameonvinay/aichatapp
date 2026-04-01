# Backend Fastify Dockerfile

FROM node:18-alpine

# Install git and build tools needed by some packages
RUN apk add --no-cache git python3 make g++

WORKDIR /app

# Copy package files first for better caching
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY src/ ./src/
COPY .dockerignore .dockerignore

EXPOSE 8080

CMD ["npm", "start"]