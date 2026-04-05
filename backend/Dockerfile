# Build stage
FROM golang:alpine AS builder

WORKDIR /app

# Install dependencies required for CGO or some Go modules if needed
RUN apk add --no-cache git build-base

# Copy go mod and sum files
COPY go.mod go.sum ./
RUN go mod download

# Copy source code
COPY . .

# Build the main API server
RUN CGO_ENABLED=0 GOOS=linux go build -a -installsuffix cgo -o main ./cmd/api

# Build the reset_demo_data command
RUN CGO_ENABLED=0 GOOS=linux go build -a -installsuffix cgo -o reset_demo_data ./cmd/reset_demo_data

# Final stage
FROM alpine:latest

WORKDIR /app

# Install ca-certificates for HTTPS (e.g., calling Groq API)
RUN apk --no-cache add ca-certificates tzdata

# Copy binaries
COPY --from=builder /app/main .
COPY --from=builder /app/reset_demo_data .
COPY --from=builder /app/schema.sql .

# Expose port
EXPOSE 8900

# Run the backend
CMD ["./main"]
