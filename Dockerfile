# Zero-dependency image. No npm install step, because there is nothing to install.
FROM node:20-alpine

RUN addgroup -S agent && adduser -S agent -G agent
WORKDIR /app

COPY package.json ./
COPY packages ./packages
COPY apps ./apps

RUN mkdir -p /app/.data && chown -R agent:agent /app/.data
USER agent

ENV PORT=8787 \
    DEVICE_AGENT_DATA=/app/.data \
    DEVICE_AGENT_ROOT=/app/.data/workspace \
    DEVICE_AGENT_ALLOW_SHELL=false

EXPOSE 8787
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:8787/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

# Runs unprivileged, with the ledger on a mounted volume so `--verify` works after
# the container is gone. No shell tool available: allow_shell is false by default.
CMD ["node", "apps/server/index.js"]