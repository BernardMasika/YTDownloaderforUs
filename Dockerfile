# Use Node.js LTS version
FROM node:18-slim

# Install ffmpeg, Python3, and link `python` to `python3`
RUN apt-get update && \
    apt-get install -y ffmpeg python3 python3-pip && \
    ln -s /usr/bin/python3 /usr/bin/python && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Create app directory
WORKDIR /usr/src/app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy app source
COPY . .

# Create downloads directory
RUN mkdir -p downloads

# Expose port
EXPOSE 3000

# Start the application
CMD ["node", "server.js"]

# Running as non-root user
USER node
