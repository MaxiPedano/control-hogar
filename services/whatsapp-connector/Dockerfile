FROM node:22-alpine

WORKDIR /app
COPY package.json pnpm-lock.yaml* ./
RUN corepack enable && pnpm install --no-frozen-lockfile

COPY tsconfig.json .env.example ./
COPY src ./src
RUN pnpm run build

ENV NODE_ENV=production
VOLUME ["/data"]
EXPOSE 8787
CMD ["node", "dist/index.js"]
