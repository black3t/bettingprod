#!/bin/bash

echo "🎰 Starting Casino Mock Platform..."

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker Desktop first."
    exit 1
fi

# Start PostgreSQL and Redis
echo "📦 Starting PostgreSQL and Redis..."
docker run -d --name casino_postgres \
  -e POSTGRES_DB=casino_mock \
  -e POSTGRES_USER=casino_admin \
  -e POSTGRES_PASSWORD=casino_pass_2024 \
  -p 5433:5432 \
  postgres:15-alpine 2>/dev/null || echo "PostgreSQL container already exists"

docker run -d --name casino_redis \
  -p 6380:6379 \
  redis:7-alpine 2>/dev/null || echo "Redis container already exists"

# Wait for PostgreSQL to be ready
echo "⏳ Waiting for PostgreSQL to be ready..."
sleep 5

# Initialize database
echo "🗄️ Initializing database..."
PGPASSWORD=casino_pass_2024 psql -h localhost -p 5433 -U casino_admin -d casino_mock -f database/init.sql 2>/dev/null || echo "Database already initialized"

# Build TypeScript
echo "🔨 Building TypeScript..."
npm run build

# Start the Casino server
echo "🎮 Starting Casino server on port 3001..."
npm run dev