#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

if [ ! -f .env ]; then
  cp .env.example .env
  echo "Created .env from .env.example"
fi

if ! grep -q '^AUTH_SECRET=.\+' .env; then
  SECRET=$(openssl rand -base64 32 2>/dev/null || head -c 32 /dev/urandom | base64)
  if grep -q '^AUTH_SECRET=' .env; then
    sed -i "s|^AUTH_SECRET=.*|AUTH_SECRET=${SECRET}|" .env
  else
    echo "AUTH_SECRET=${SECRET}" >> .env
  fi
  echo "Generated AUTH_SECRET in .env"
fi

if ! grep -q '^DATABASE_URL=.\+' .env; then
  echo "DATABASE_URL=postgresql://likepass:likepass@localhost:5432/likepass" >> .env
fi

echo "Starting PostgreSQL (Docker)..."
docker compose up -d postgres

echo "Waiting for database..."
until docker compose exec -T postgres pg_isready -U likepass >/dev/null 2>&1; do
  sleep 1
done

npm install
npx prisma migrate deploy
npm run db:seed

echo ""
echo "============================================"
echo "  LIKEPASS local dev ready"
echo "  Open: http://localhost:3000"
echo "============================================"
echo ""
echo "Run in another terminal for background jobs:"
echo "  npm run worker"
echo ""

npm run dev
