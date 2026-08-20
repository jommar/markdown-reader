# syntax=docker/dockerfile:1
# markdown-reader — zero-host distribution image (GHCR)
# Build: docker build -t ghcr.io/jommar/markdown-reader:latest .
# Run:   docker run --rm -p 127.0.0.1:5180:5180 -v /path/to/docs:/docs ghcr.io/jommar/markdown-reader --root /docs

FROM node:22-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-slim AS runtime
RUN apt-get update \
  && apt-get install -y --no-install-recommends ripgrep \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=build /app/dist ./dist
COPY --from=build /app/server ./server
COPY --from=build /app/bin ./bin
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/package-lock.json ./package-lock.json
# Only production deps (tsx is now in dependencies, so it stays)
RUN npm ci --omit=dev && npm cache clean --force
EXPOSE 5180
ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=5180
# Keep guard strict: Host must be 127.0.0.1:<PORT> — publish as -p 127.0.0.1:5180:5180
ENTRYPOINT ["node", "./bin/markdown-reader.mjs"]
CMD ["--help"]
