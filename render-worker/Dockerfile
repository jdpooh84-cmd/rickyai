FROM node:20-slim
RUN apt-get update && apt-get install -y ffmpeg fonts-dejavu-core curl && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json ./
RUN npm install
COPY src/ ./src/
EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=10s CMD curl -f http://localhost:3001/health || exit 1
CMD ["node", "src/index.js"]
