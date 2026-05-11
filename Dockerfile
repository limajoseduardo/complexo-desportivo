FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev=false
COPY . .
ARG GEMINI_API_KEY
ARG VITE_BASE_URL=/
ENV GEMINI_API_KEY=$GEMINI_API_KEY
ENV VITE_BASE_URL=$VITE_BASE_URL
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
