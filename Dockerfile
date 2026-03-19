FROM node:20-bookworm-slim

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

# Ensure runtime directories exist
RUN mkdir -p public/uploads/avatars data \
  && chown -R node:node /app

USER node

EXPOSE 3000

# Provide secrets via environment variables (recommended) or mount an `.env` file.
HEALTHCHECK --interval=30s --timeout=3s --retries=3 \
  CMD node -e "require('http').get('http://127.0.0.1:3000/api/health',r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1));"

CMD ["node", "server.js"]

