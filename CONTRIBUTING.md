# Contributing to BGroup API

作業は **Issue → 依存関係とゲートの確認 → 作業ブランチ → PR → レビュー → 統合** の順で進めます。
段階ごとの完了条件と変更管理は [開発運用](docs/development-workflow.md) を参照してください。

## 着手条件

- 実装前に所定のフォームで Issue を作成し、WBS 参照、担当者、別の確認者、依存 Issue、完了条件、検証方法を記載します。
- 依存 Issue の完了証跡と、統合先 `develop` の `.github/core-gate.json` を確認します。Issue の作成や担当の割当だけでは着手可能になりません。
- この運用の導入時点は G0（環境再現）の整備段階です。WBS No.17 は **API コアの G0 → G1 → G2 → G3 → Web 共通部品 → No.17 全体の完了確認** の順で進め、その後に No.18 の画面機能を開始します。
- G0 は No.17 の前提となる開発環境の再現です。出展時の環境整備である No.34 と混同しません。
- API の G3 完了と API 側の `featureDevelopmentAllowed: true` は、Web 共通部品へ進む条件です。No.17 全体の完了とは区別します。
- No.18 へ進むには、Web 側 `.github/web-gate.json` の `sharedComponentsComplete: true` と `featureDevelopmentAllowed: true`、No.17 全体の完了条件、各機能の依存 Issue も確認します。
- 先生承認済みの ER 図が DB 設計の基準です。既存モックの構成を正式仕様として流用せず、承認版との一致を確認します。
- 公開リポジトリの本文・ファイルには資料リンク、個人名、日程を記載せず、チーム管理資料 ID と版 ID で参照します。担当と確認者は GitHub アカウントを使用します。
- 秘密情報、認証情報、個人情報、実データ、私有資料の内容をコミットしません。脆弱性報告は [SECURITY.md](SECURITY.md) に従います。

## ブランチ

`main` はリリース対象、`develop` は確認済みの開発内容の統合先です。両方への直接 push を行わず、PR を経由します。
通常は最新の `develop` から、Issue ごとに短い作業ブランチを作成します。

```bash
git fetch origin
git switch develop
git pull --ff-only origin develop
git switch -c chore/<issue番号>-<概要>
```

| 作業           | ブランチ名                   |
| -------------- | ---------------------------- |
| 基盤・開発環境 | `chore/<issue番号>-<概要>`   |
| 機能実装       | `feature/<issue番号>-<概要>` |
| 不具合修正     | `fix/<issue番号>-<概要>`     |
| 仕様・文書     | `docs/<issue番号>-<概要>`    |

通常の PR は `develop` 向けです。`main` への反映は、リリース範囲と検証結果を記載した `develop` → `main` の PR で行います。
他の作業ブランチを勝手に取り込まず、必要な変更は先行 PR の統合後に取り込みます。

## Issue と PR

Issue と PR は一つのレビュー可能な成果物に絞り、関連のない整理や機能を混ぜません。
関連 Issue は `Closes #番号`、先行する依存 Issue は各行 `Depends on #番号` と記載します。番号は同じリポジトリの Issue を指します。
依存がなければ `None` の行と理由を記載し、PR と関連 Issue の依存一覧を一致させます。
変更区分は `foundation`、`feature`、`change`、`bug` のいずれか、対象ゲートは `G0`、`G1`、`G2`、`G3`、`FEATURE` のいずれかを選びます。
後段の作業を `foundation` と呼び替えて、ゲートを通過させてはいけません。

PR テンプレートの見出しを保持し、各項目に具体的な内容を記載してください。PR を作成する前に全チェックを実行します。

```bash
npm run check
```

必要な動作確認、migration、権限・状態遷移の確認は、このコマンドの成功だけで代替できません。
実行コマンド、環境、期待結果、実際の結果、対象 commit と証跡の管理 ID を PR に記録します。

マージには、関連 Issue の完了条件、必須チェックの成功、作者以外のレビュー承認、指摘の解決が必要です。
レビュー後に仕様や動作へ影響する変更を追加した場合は、再確認を依頼します。自分だけの判断で承認を省略しません。

API の `main` と `develop` は、初期の保護対象を `Quality checks` の成功と作者以外 1 名の承認とします。
`PR policy` は、この基盤導入 PR が統合されて信頼する base に検査が存在するようになってから、別の activation Issue で動作を確認して必須化します。
文書や workflow を追加しただけで、必須化が有効になったとは扱いません。

`Closes #番号` を記載しても、既定ブランチ以外への PR では自動的に Issue が閉じない場合があります。
マージ後に完了条件・証跡・統合 commit を確認して Issue を閉じます。PR が存在するだけ、または Issue を閉じただけでは完了しません。

## 仕様変更と例外

DB、API、認証・権限、業務状態・状態遷移を変える場合は、先に `change` の Issue で差分、理由、依存先、移行・復旧方法を整理します。
既存の適用済み migration を書き換えず、新しい migration を追加します。影響する仕様とテストも同じ変更に追従させます。

未解決の依存関係や検証失敗があれば作業を保留し、Issue に理由と再開条件を記録してください。
緊急修正でも Issue・PR・検証・レビューを省略せず、機能解禁前の修正は現在の基盤を直す範囲に限定します。
ゲート解除や保護ルールの変更を、通常の機能 PR に混ぜてはいけません。

共通運用と API コアの完了判定は API リポジトリが正本です。`BGroup-web` は API コア完了後に、合意した契約を使う Web 共通部品を作成します。
Web の共通部品は `foundation` / `G3` で扱い、運用保守だけの `foundation` / `G0` と区別します。
Web 共通部品の完成と No.17 全体の完了を確認してから、No.18 の機能画面を実装・接続します。
現構成の `BGroup-web` は Private / Organization Free のため、サーバー側のブランチ保護を利用できません。workflow の検査結果は確認材料であり、直接 push や条件未達のマージを必ず阻止できるものではありません。
Web 側でも同じ Issue・PR・レビュー手順で進め、マージ担当者が結果と依存条件を確認します。API 側の保護設定と Web 側の運用上の確認を区別します。

## コミット

変更内容が分かる短いメッセージにします。レビューで必要な修正は同じ PR に追加し、統合方法はリポジトリの設定に従います。

```text
Add local database setup checks
Fix validation for email
Document API error contract
```
