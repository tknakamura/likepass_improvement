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

## セットアップ

```bash
cp .env.example .env
# .env に DATABASE_URL, AUTH_SECRET, Google OAuth 等を設定

npm install
npx prisma migrate dev
npm run db:seed
npm run dev
```

別ターミナルでワーカー:

```bash
npm run worker
```

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
2. Blueprint をデプロイ
3. 環境変数（Google OAuth, R2 等）を Dashboard で設定

## ライセンス

Private
