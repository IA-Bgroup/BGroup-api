# BGroup API

IA-Bgroup のバックエンド API です。HalNagoyaRecTime の開発環境に合わせて、
Cloudflare Workers / Hono / TypeScript / D1 で構成しています。

登録ユーザー約500人を初期想定とし、常時稼働サーバーを各自で用意せずに開発できる
サーバーレス構成です。設計判断は [docs/architecture.md](docs/architecture.md) にまとめています。

## 必要環境

- Node.js 22（`nvm` 推奨）
- npm 10
- Cloudflare アカウント（共有開発環境・本番へのデプロイ担当者のみ）

ローカル開発だけなら、Cloudflare アカウントや共有データベースへの接続は不要です。

## ローカル開発

### 1. セットアップ

```bash
git clone https://github.com/IA-Bgroup/BGroup-api.git
cd BGroup-api
nvm use
npm install
cp .env.example .dev.vars
```

### 2. ローカルDBを作成

```bash
npm run db:migrate:local
```

各メンバーのPC内に独立したD1データベースが作られます。ほかのメンバーのデータや
共有環境を壊すことはありません。

### 3. APIを起動

```bash
npm run dev
```

`http://localhost:8787` で起動します。

```bash
curl http://localhost:8787/health
curl http://localhost:8787/ready
```

- `/health`: Worker自体が応答できるか確認
- `/ready`: D1を含めてリクエストを処理できるか確認

## 日常的に使うコマンド

| コマンド                   | 用途                               |
| -------------------------- | ---------------------------------- |
| `npm run dev`              | ローカルAPIを起動                  |
| `npm run db:migrate:local` | ローカルD1へマイグレーションを適用 |
| `npm test`                 | テストを実行                       |
| `npm run lint`             | ESLintを実行                       |
| `npm run format`           | Prettierで整形                     |
| `npm run type-check`       | TypeScriptの型検査                 |
| `npm run check`            | PR前の全チェックを実行             |

## 共有開発環境の準備（管理者向け）

最初の1回だけ、Cloudflareに開発用D1を作成します。

```bash
npx wrangler login
npx wrangler d1 create bgroup-api-dev
```

表示された `database_id` を `wrangler.jsonc` の `env.development.d1_databases` に設定し、
プレースホルダーを置き換えてください。その後、次のコマンドを実行します。

```bash
npm run db:migrate:remote:development
npm run deploy:development
```

本番は別のD1データベースを作成し、`env.production` の `database_id` を置き換えてから
同じ手順でデプロイしてください。開発環境と本番環境でデータベースを共有しないでください。

## ブランチ運用

- `main`: 常にデプロイ可能な状態
- `develop`: 開発内容の統合先
- `feature/<issue番号>-<概要>`: 各機能の作業ブランチ
- `fix/<issue番号>-<概要>`: 不具合修正ブランチ

作業開始時に `develop` からブランチを作り、Pull Requestで `develop` に取り込みます。
夏休み中も作業単位を小さく保ち、DB変更には必ず新しいマイグレーションを追加してください。

## Contributing / Security

Pull Requestを作成する前に [CONTRIBUTING.md](CONTRIBUTING.md) を確認してください。
秘密情報や個人情報はコミットせず、脆弱性は [SECURITY.md](SECURITY.md) の手順で報告してください。
