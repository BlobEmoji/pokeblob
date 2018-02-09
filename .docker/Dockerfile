FROM node:9-alpine

RUN apk add --no-cache bash gettext git

RUN mkdir -p /app/depends/node_modules
RUN mkdir /app/repo

WORKDIR /app/depends
COPY package*.json .

RUN npm install

WORKDIR /app/repo

ENV NODE_PATH=/app/depends/node_modules

CMD ["bash", ".docker/startloop.sh"]
