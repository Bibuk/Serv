FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
ARG VITE_PORTAL=internal
ENV VITE_PORTAL=$VITE_PORTAL
# Production images talk to the real backend through the nginx /api proxy.
# Vite resolves env vars at build time: if VITE_API_MOCK is left unset the
# bundle is baked in mock mode (USE_MOCK = VITE_API_MOCK !== 'false' → true),
# so the app renders but never calls the backend. Default to real-API mode.
ARG VITE_API_MOCK=false
ENV VITE_API_MOCK=$VITE_API_MOCK
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
