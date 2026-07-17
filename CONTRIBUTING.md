# Contributing to BGroup API

## Before you start

- 既存の Issue や Pull Request と重複していないか確認してください。
- 大きな変更は、実装前に Issue で方針を共有してください。
- 秘密情報、認証情報、個人情報をコミットしないでください。

## Branches

通常の開発は最新の `develop` から作業ブランチを作成します。ブランチ名は変更内容が分かる形式にしてください。

```text
feature/add-user-endpoint
fix/invalid-request-response
docs/update-setup-guide
```

```bash
git switch develop
git pull --ff-only
git switch -c feature/<issue番号>-<概要>
```

## Pull Requests

Pull Request には次の内容を含めてください。

- 変更の概要と目的
- 動作確認した内容
- API 仕様・データベース・設定への影響
- 関連する Issue

レビューで指摘された内容は、必要に応じてコミットを追加して対応してください。

Pull Requestを作成する前に、ローカルで全チェックを実行してください。

```bash
npm run check
```

## Commits

コミットメッセージは、変更内容が分かる短い命令形で書いてください。

```text
Add user endpoint
Fix validation for email
Update local setup guide
```
