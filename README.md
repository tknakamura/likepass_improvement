# LIKEPASS

写真評価サービス「LIKEPASS」のMVPアプリケーションです。

> 素敵な画像を、みんなの審美眼で見つける。

## 技術スタック

- **Frontend/Backend**: Next.js 15, TypeScript, Tailwind CSS
- **Auth**: Auth.js (Google OAuth)
- **Database**: PostgreSQL + Prisma
- **Storage**: Cloudflare R2
- **Jobs**: pg-boss (Background Worker)
- **Hosting**: Render

## セットアップ（自分のPCで見る場合）

**重要:** Cloud Agent 上で起動したサーバーは、あなたのPCの `localhost` からは見えません。
自分のPCで見るには、以下をローカルで実行してください。

### いちばん簡単な方法（Docker あり）

```bash
git clone https://github.com/tknakamura/likepass_improvement.git
cd likepass_improvement
git checkout main

chmod +x scripts/dev-local.sh
./scripts/dev-local.sh
```

ブラウザで **http://localhost:3000** を開く。

### 手動セットアップ

```bash
cp .env.example .env
# DATABASE_URL と AUTH_SECRET を設定（Google OAuth は後からでも可）

docker compose up -d postgres   # または手元の PostgreSQL
npm install
npx prisma migrate deploy
npm run db:seed
npm run dev
```

別ターミナルでワーカー:

```bash
npm run worker
```

### うまく見えないとき

| 症状 | 対処 |
|------|------|
| 接続できない | `npm run dev` が動いているか確認（`0.0.0.0:3000` で待受） |
| DB エラー | `docker compose up -d postgres` または PostgreSQL 起動 |
| ログインできない | `.env` に Google OAuth の ID/Secret を設定 |
| Cloud Agent の作業を見たい | Cursor の **Ports** タブで 3000 番の転送 URL を開く |

## 主要コマンド

| コマンド | 説明 |
|---------|------|
| `npm run dev` | 開発サーバー |
| `npm run build` | 本番ビルド |
| `npm run test` | ユニットテスト |
| `npm run test:e2e` | E2Eテスト |
| `npm run worker` | バックグラウンドワーカー |

## ドキュメント

- [プロダクト仕様](docs/PRODUCT_SPEC.md)
- [ビジネス文書（旧プロジェクト）](docs/business/)

## デプロイ

Render Blueprint (`render.yaml`) を使用:

1. GitHub リポジトリを Render に接続
2. [New Blueprint](https://dashboard.render.com/blueprints) から `render.yaml` をデプロイ
3. 環境変数を Dashboard で設定:
   - `IMAGE_AI_API_KEY`（Web + Worker 両方）
   - `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET`
   - R2 関連（任意）
4. `npm run reprocess:stuck` で PROCESSING 止まりの投稿を再処理（本番は Worker 上で実行）

Blueprint 適用後のサービス: `likepass-web` / `likepass-worker` / `likepass-db`

## Cloudflare R2 設定（本番の画像保存）

Render のディスクは一時的なため、**本番の写真アップロードには R2 が必要**です。

### 1. Cloudflare で R2 バケットを作成

1. [Cloudflare Dashboard](https://dash.cloudflare.com/) → **R2 Object Storage**
2. **Create bucket** → 名前例: `likepass-images`
3. リージョンは任意（Automatic で可）

### 2. API トークン（S3 互換キー）を発行

1. R2 → **Manage R2 API Tokens** → **Create API token**
2. 権限: 対象バケットに **Object Read & Write**
3. 発行後に控える:
   - Access Key ID → `R2_ACCESS_KEY_ID`
   - Secret Access Key → `R2_SECRET_ACCESS_KEY`

### 3. Account ID を控える

Dashboard 右サイドバーまたは R2 概要の **Account ID** → `R2_ACCOUNT_ID`

### 4. CORS を設定（ブラウザからの直接アップロードに必須）

バケット → **Settings** → **CORS policy** → 例は `docs/r2-cors.example.json`

本番 URL（`https://likepass-web.onrender.com`）とローカル（`http://localhost:3000`）を `AllowedOrigins` に含めてください。

### 5. Render に環境変数を設定（Web + Worker 両方）

| 変数名 | 値の例 |
|--------|--------|
| `R2_ACCOUNT_ID` | Cloudflare Account ID |
| `R2_ACCESS_KEY_ID` | API トークンの Access Key |
| `R2_SECRET_ACCESS_KEY` | API トークンの Secret |
| `R2_BUCKET_NAME` | `likepass-images` |
| `R2_PUBLIC_BASE_URL` | 任意（下記参照） |

`R2_PUBLIC_BASE_URL` の選択肢:

- **空欄でも可** — 画像は `https://likepass-web.onrender.com/api/images/...` 経由で配信
- **R2 公開 URL / カスタムドメイン** — R2 の Public access または CDN ドメインを設定した場合にそのベース URL

設定後、**likepass-web** と **likepass-worker** を再デプロイしてください。

### 6. 動作確認

1. ログイン → `/upload` から写真を投稿
2. 処理完了後、画像が表示されること
3. Worker ログに画像処理・AIタグのログが出ること

R2 未設定時は `mockMode` でローカル保存にフォールバックしますが、**Render 本番では再起動で消える**ため R2 設定を推奨します。

## ライセンス

Private
