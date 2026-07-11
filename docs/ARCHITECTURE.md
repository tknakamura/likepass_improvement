# LIKEPASS Architecture

## Overview

LIKEPASS is a Next.js full-stack application deployed on Render with PostgreSQL, Cloudflare R2, and a background worker.

## Components

- **Web Service** (`likepass-web`): Next.js App Router, API routes, Auth.js
- **Worker** (`likepass-worker`): pg-boss jobs for image processing, AI tagging, ranking
- **PostgreSQL**: Primary data store + job queue (pg-boss)
- **Cloudflare R2**: Image storage with presigned uploads

## Key Flows

1. **Auth**: Google OAuth → Auth.js → Prisma User/Account/Session
2. **Upload**: Presign → R2 PUT → Complete → Worker processes image
3. **Evaluate**: Queue API → LIKE/PASS vote → Aggregate update → Ranking recalc
4. **Ranking**: Wilson lower bound score, masked until user votes

## Directory Layout

See repository root `src/` for feature modules, `src/server/services/` for domain logic.
