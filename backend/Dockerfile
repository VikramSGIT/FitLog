FROM golang:1.23-alpine AS builder
WORKDIR /app
RUN apk add --no-cache build-base ca-certificates && update-ca-certificates
COPY backend/go.mod backend/go.sum ./
RUN go mod download
COPY backend/ ./
ARG TARGETOS=linux
ARG TARGETARCH
ENV CGO_ENABLED=0 GOOS=${TARGETOS} GOARCH=${TARGETARCH:-amd64}
RUN go build -o /out/server ./cmd/server

FROM gcr.io/distroless/static:nonroot
COPY --from=builder /out/server /server
USER nonroot:nonroot
EXPOSE 8080
ENTRYPOINT ["/server"]


