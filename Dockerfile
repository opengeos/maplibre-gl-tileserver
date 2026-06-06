# Build stage
FROM node:22-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

RUN npm test
RUN npm run build && npm run build:examples

FROM nginx:alpine

COPY --from=builder /app/dist-examples /usr/share/nginx/html/maplibre-gl-raster

RUN echo 'server { \
    listen 80; \
    server_name localhost; \
    root /usr/share/nginx/html; \
    index index.html; \
    location /maplibre-gl-raster/ { \
        try_files $uri $uri/ /maplibre-gl-raster/index.html; \
    } \
    location = / { \
        return 302 /maplibre-gl-raster/; \
    } \
}' > /etc/nginx/conf.d/default.conf

EXPOSE 80

RUN printf '#!/bin/sh\n\
echo "maplibre-gl-raster examples: http://localhost:8080/maplibre-gl-raster/"\n\
exec nginx -g "daemon off;"\n' > /start.sh && chmod +x /start.sh

CMD ["/start.sh"]
