FROM node:22-alpine AS builder

WORKDIR /app

COPY package*.json ./

RUN npm ci

COPY . .

RUN npm run build

FROM node:22-alpine

ARG ENV=production
ARG DB_HOST
ARG DB_USER
ARG DB_PASSWORD
ARG DB_NAME
ARG WA_NUMBER
ARG DB_AUTO_ALTER=false

ENV ENV=${ENV}
ENV DB_HOST=${DB_HOST}
ENV DB_USER=${DB_USER}
ENV DB_PASSWORD=${DB_PASSWORD}
ENV DB_NAME=${DB_NAME}
ENV WA_NUMBER=${WA_NUMBER}
ENV DB_AUTO_ALTER=${DB_AUTO_ALTER}
ENV PORT=18080

WORKDIR /app

COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist

VOLUME ["/app/auth_info_baileys"]

EXPOSE 18080

CMD [ "node", "dist/index.js" ]