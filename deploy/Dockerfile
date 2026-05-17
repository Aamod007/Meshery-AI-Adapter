# Stage 1: Build React
FROM node:20-alpine AS web-builder
WORKDIR /app/web
COPY web/package*.json ./
RUN npm ci
COPY web/ .
RUN npm run build

# Stage 2: Build Go binary
FROM golang:1.22-alpine AS go-builder
WORKDIR /app
COPY go.mod go.sum* ./
RUN go mod download || true
COPY . .
COPY --from=web-builder /app/web/dist ./web/dist
RUN go mod tidy
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o server ./cmd/server

# Stage 3: Minimal final image
FROM gcr.io/distroless/static-debian12
COPY --from=go-builder /app/server /server
EXPOSE 8080
ENTRYPOINT ["/server"]
