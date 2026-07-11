# BGroup API

IA-Bgroup の API サービス用リポジトリです。

## Status

開発初期段階です。実装や利用方法が追加されたら、この README を更新してください。

## Getting started

### 1. Clone

```bash
git clone https://github.com/IA-Bgroup/BGroup-api.git
cd BGroup-api
```

### 2. Configure environment variables

```bash
cp .env.example .env
```

`.env` にはローカル開発用の値だけを設定し、Git にコミットしないでください。

### 3. Run locally

実装する言語・フレームワークが決まり次第、セットアップ手順と起動コマンドをここに追記します。

## Repository conventions

- `main` は常に動作可能な状態を保つ
- 変更は小さな単位でブランチを作成し、Pull Request 経由で取り込む
- API の仕様変更時は、関連するドキュメントとテストを同時に更新する
- 秘密情報や個人情報をコミットしない

## Development

実装追加時は、少なくとも次の情報を README に反映してください。

- 必要なランタイムとバージョン
- 依存関係のインストール方法
- ローカル起動方法
- テスト・Lint の実行方法
- API 仕様書の場所（OpenAPI など）

## Contributing

Issue や Pull Request を作成する前に [CONTRIBUTING.md](CONTRIBUTING.md) を確認してください。

## Security

脆弱性を公開 Issue に投稿せず、[SECURITY.md](SECURITY.md) の手順で報告してください。
