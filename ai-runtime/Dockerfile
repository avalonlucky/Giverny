FROM node:22-slim

WORKDIR /app

COPY package.json package-lock.json ./
COPY baml_src ./baml_src
COPY ai-runtime ./ai-runtime

RUN npm ci
RUN npm run baml:generate
RUN cd ai-runtime && npm ci --omit=dev

WORKDIR /app/ai-runtime

ENV PORT=8080
EXPOSE 8080

CMD ["npm", "start"]
