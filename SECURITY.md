# Security Policy

## Reporting a vulnerability

脆弱性を発見した場合は、公開 Issue や Pull Request では報告しないでください。

GitHub の Security Advisories から非公開で報告するか、リポジトリ管理者へ連絡してください。報告には、再現手順、影響範囲、可能であれば修正案を含めてください。

## Handling secrets

- API キー、パスワード、トークンをリポジトリに保存しない
- ローカルの秘密情報は `.env` に保存し、`.env.example` にはキー名だけを記載する
- 漏えいした可能性がある認証情報は、直ちに無効化・ローテーションする
