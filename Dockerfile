FROM node:18-bullseye-slim

RUN apt-get update && apt-get install -y \
    chromium \
    chromium-sandbox \
    tzdata \
    fonts-ipafont-gothic fonts-wqy-zenhei fonts-thai-tlwg fonts-kacst fonts-freefont-ttf \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
RUN npm install

COPY . .

ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
ENV TZ=Asia/Jakarta
ENV NODE_ENV=production

EXPOSE 3000

CMD ["node", "src/server.js"]
