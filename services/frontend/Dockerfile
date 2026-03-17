FROM node:20-alpine

WORKDIR /app

COPY package.json ./
RUN npm install --omit=dev

COPY pages ./pages
COPY styles ./styles
COPY next.config.js ./next.config.js

RUN npm run build

EXPOSE 3000
CMD ["npm", "start"]
