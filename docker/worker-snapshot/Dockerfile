# stage 1 - base

ARG NODE_IMAGE=node:20-bookworm

FROM $NODE_IMAGE AS base
RUN apt-get update && apt-get install -y dumb-init && rm -rf /var/lib/apt/lists/*
RUN mkdir -p /home/node/app && chown node:node /home/node/app
WORKDIR /home/node/app
RUN npx -y playwright@1.45.1 install --with-deps
USER node
RUN mkdir tmp

# stage 2 - dependencies

FROM base AS dependencies
COPY --chown=node:node ./package*.json ./
RUN npm ci
COPY --chown=node:node . .
RUN npx playwright install

# stage 3 - build

FROM dependencies AS build
RUN node ace build --production

# stage 4 - production

FROM base AS production
ENV NODE_ENV=production
# ENV PORT=$PORT
# ENV HOST=0.0.0.0
COPY --chown=node:node ./package*.json ./
RUN npm ci --production
COPY --chown=node:node --from=build /home/node/app/build .

# EXPOSE $PORT
CMD [ "dumb-init", "node", "server.js" ]