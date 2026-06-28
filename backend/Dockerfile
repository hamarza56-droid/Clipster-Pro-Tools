FROM node:20-slim

# Install a system ffmpeg as a safety net in case the bundled ffmpeg-static
# binary is missing a codec (e.g. libx264) on this platform.
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install --omit=dev

COPY . .

RUN mkdir -p uploads/tmp exports data

EXPOSE 4000

CMD ["npm", "start"]
