ARG NODE_VERSION=22.18.0

FROM node:${NODE_VERSION}-alpine

# Use production node environment by default.
ENV NODE_ENV production


WORKDIR /usr/src/app

# Copy package files
COPY package*.json ./

# Copy .env.example to .env
COPY .env.example .env

# Download dependencies as a separate step to take advantage of Docker's caching.
RUN npm ci --omit=dev

# Copy the rest of the source files into the image.
COPY . .

# Change ownership of the files to the node user
RUN chown -R node:node /usr/src/app

# Run the application as a non-root user.
USER node

# Expose the port that the application listens on.
EXPOSE 3000

# Run the application.
CMD ["node", "server.js"]
