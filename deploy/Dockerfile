FROM node:20-alpine

WORKDIR /app

# Backend
COPY backend/package.json backend/package-lock.json* ./backend/
RUN cd backend && npm install --omit=dev

COPY backend/ ./backend/

# Frontend
COPY frontend/ ./frontend/

# Scripts
COPY scripts/ ./scripts/

ENV NODE_ENV=production
ENV PORT=3000
ENV PUBLIC_BASE_URL=http://localhost:3000
ENV PAYMENTS_MODE=mock

EXPOSE 3000

WORKDIR /app/backend

CMD ["node", "src/server.js"]