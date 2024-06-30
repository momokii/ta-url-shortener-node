# Gunakan ARG untuk memungkinkan fleksibilitas dalam menentukan versi Node.js
ARG NODE_VERSION=21-alpine
FROM node:${NODE_VERSION}

# Set working directory
WORKDIR /usr/src/app

# Copy package.json dan package-lock.json dan install dependencies
COPY --chown=node:node package*.json ./

# Install dependencies
RUN npm ci --only=production --silent

# Copy seluruh source code aplikasi
COPY --chown=node:node . .

# Expose port 3000
EXPOSE 8889

# Change ownership to the 'node' user and use non-root user for security
USER node

# Command to run the application
CMD ["npm", "start"]
