# BGroup API architecture

## 方針

初期の登録ユーザー約500人を対象に、Cloudflare Workers、Hono、D1で構成します。
参照元のRecTime APIと同じ技術スタックにすることで、チーム間で知見と開発手順を共有できます。

Workersはリクエスト単位で実行されるため、各メンバーが常時稼働サーバーを管理する必要はありません。
ローカルではWranglerがWorkerとD1を再現し、開発者ごとに完全に独立したDBを持ちます。

## 500ユーザー向けの初期構成

- API: Cloudflare Workers 1サービス
- Database: 開発用D1と本番用D1を1つずつ
- Runtime: Node.js 22互換 / TypeScript / Hono
- CI: Format、Lint、型検査、テストをPull Requestごとに実行
- Observability: `X-Request-Id` を全応答へ付与し、エラー時のログ追跡に使用
- Security: CORS許可リスト、セキュリティヘッダー、秘密情報のGit除外

500ユーザー規模では、最初から複数DBへの分割や常駐コンテナ群を用意しません。運用データを確認し、
単一D1で問題が確認された時点で読み取りキャッシュや処理の分離を検討します。

## データ設計の基準

- 一覧APIはカーソルまたはページングを必須とし、既定20件、最大100件を目安にする
- 絞り込み・並び替えに使う列へインデックスを作る
- N+1クエリを避け、1リクエストのDB往復回数を抑える
- DB変更は既存SQLを書き換えず、新しいマイグレーションとして追加する
- 一括通知、集計、外部API連携は同期APIから切り離せる形で実装する

## 環境分離

| 環境        | Worker             | D1                   | 用途             |
| ----------- | ------------------ | -------------------- | ---------------- |
| Local       | 各開発者のWrangler | 各開発者のローカルD1 | 日常開発・テスト |
| Development | `bgroup-api-dev`   | `bgroup-api-dev`     | 結合確認         |
| Production  | `bgroup-api`       | `bgroup-api`         | 利用者向け       |

開発環境と本番環境でWorker名、D1、設定値を分離します。本番データをローカルへコピーしません。

## 機能追加時の配置

機能が増えたら、次の単位で分離します。

```text
src/
  features/
    users/
      route.ts
      service.ts
      repository.ts
      schema.ts
  middleware/
  types/
```

小規模なうちはルート、業務処理、DB処理の3層を基本にし、不要な抽象化は増やしません。
