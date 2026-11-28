# syntax=docker/dockerfile:1

# The web version of the client (the same renderer the desktop app uses), built with Vite and
# served by nginx. The desktop app itself is a Windows program and does not run in a container.
#
# VITE_API_URL is baked in at build time: the browser calls the backend at that address.

# ---- build
FROM node:22-alpine AS build
WORKDIR /app
# Electron is a dev dependency of the desktop app; the web build does not need its binary.
ENV ELECTRON_SKIP_BINARY_DOWNLOAD=1
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci
COPY . .
ARG VITE_API_URL=http://localhost:8080/api
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build:web

# ---- serve
FROM nginx:1.27-alpine
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/out/web /usr/share/nginx/html
EXPOSE 80
