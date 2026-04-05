#!/usr/bin/env bash
set -euo pipefail

echo "======================================"
echo " Starting deployment of AICM on VM..."
echo "======================================"

# Check for Docker
if ! command -v docker > /dev/null 2>&1; then
  echo "Docker is not installed. Please install Docker and Docker Compose first."
  echo "Run: curl -fsSL https://get.docker.com -o get-docker.sh && sudo sh get-docker.sh"
  exit 1
fi

if docker compose version > /dev/null 2>&1; then
  COMPOSE_CMD=(docker compose)
elif command -v docker-compose > /dev/null 2>&1; then
  COMPOSE_CMD=(docker-compose)
else
  echo "Docker Compose is not installed. Please install docker compose plugin or docker-compose."
  exit 1
fi

# Ensure we have a .env file
if [ ! -f .env ]; then
  echo "Error: .env file not found!"
  echo "Create .env from .env.example and set DB_PASSWORD, JWT_SECRET, and GROQ_API_KEY before deploying."
  exit 1
fi

RUN_DEMO_SEED="${RUN_DEMO_SEED:-false}"

echo "Pulling latest Docker images and starting containers..."
"${COMPOSE_CMD[@]}" -f docker-compose.prod.yml pull
"${COMPOSE_CMD[@]}" -f docker-compose.prod.yml up -d

if [ "$RUN_DEMO_SEED" = "true" ]; then
  echo "Running reset_demo_data to seed the database with demo content..."
  docker exec aicm_backend ./reset_demo_data
else
  echo "Skipping demo data seed. Set RUN_DEMO_SEED=true to enable it."
fi

echo "Images pulled and containers updated successfully."

echo "======================================"
echo "Deployment complete!"
echo "The application is now accessible via http://YOUR_VM_IP/"
echo "======================================"
