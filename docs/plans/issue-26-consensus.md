---
issue: 26
kind: consensus-plan
sources:
  - issue-26-plan-opus.md
  - issue-26-plan-gpt.md
  - issue-26-plan-grok.md
  - issue-26-review-sonnet.md
  - issue-26-review-gpt-sol.md
  - issue-26-review-composer.md
---

# issue #26 合意プラン

3 プラン（Opus / GPT / Grok）と 3 レビュー（Sonnet / GPT-sol / Composer）の一致点だけを固定する。骨格は Opus。実装はしない。未決は決めない。

## 採用

- メール許可リストは ENV `ADMIN_EMAILS`。本番は Kamal が credentials から注入する（OAuth と同じ経路）。アプリは credentials を直読みしない。
- 認可の述語は `User#admin?`。許可リスト未設定・空は fail-closed（誰も運営にならない）。
- `/admin/feedbacks` は読み取り専用。新着順（`created_at DESC, id DESC`）。サーバ側ページング（50 件）とカテゴリ絞り込みを両立させる。
- `users` にロール列は足さない。`Admin::BaseController` は v1 で作らない（運営ページが 2 つ目になったら抽出する）。
- 運営向けレスポンスに `Cache-Control: no-store` を付ける。
- 用語は `CONTEXT.md` の「運営」を正典にする。コード識別子の `admin` / `Admin::` は許容する。
- 公開 `/feedback`（書き込み経路）には手を入れない。

## 未決（実装前に決める。この文書では決めない）

レビュー間で分かれた。勝手に採用しない。

1. **未ログイン時の HTTP 応答**: 常に 404 か、未ログインはログインへ・ログイン済み非運営は 404 か。
2. **Header 導線を今足すか**: `inertia_share` の `auth.is_admin` とドロップダウンリンクを今入れるか、URL 直打ち運用にするか。
3. **`has_many :feedbacks, dependent: :nullify`**: 今入れるか、退会機能と合わせて別 issue にするか。
4. **認可の置き場所**: `User#admin?` だけにするか、独立モジュール（例: `AdminAccess.granted?(user)`）にするか。

## 却下

- credentials 直読み（`config/application.rb` 等で `Rails.application.credentials` を読む）
- 非運営への 302 + flash（存在漏洩。権限不足メッセージで管理 URL の存在を教える）
- 全件返却 + クライアント側タブのみ（サーバ側ページングと矛盾する）
- `users` への role 列

## 次の実装ステップ

未決 4 点を実装前に決めること。特にステップ 2・3b・6 は未決の影響を受ける。

Opus プランのコミット分割をベースにする。各コミットは単体で CI が緑・公開 `/feedback` を壊さない状態を保つ。

1. （任意）日時表記を `format-datetime.ts` に切り出す。カテゴリ型・ラベルを `feedback-categories.ts` に切り出す。
2. `CONTEXT.md` に「運営」「フィードバック一覧」を追記し、ADR-0011（許可リスト方式・ロール列を持たない）を書く。
3. 認可述語を追加する（fail-closed・大小文字無視）。置き場所は未決 4 に従う。
4. `admin/Feedbacks.tsx` をルート無しで追加する（一覧テーブル / 空状態）。
5. `/admin/feedbacks` を新設し、運営だけに見せる。未ログイン時の応答は未決 1 に従う。成功時は `Cache-Control: no-store`。
6. カテゴリ絞り込み（サーバ側 `?category=`）を付ける。
7. ページ送り（50 件 / ページ、絞り込みと併用）を付ける。
8. Header 導線は未決 2 が「今足す」なら入れる。足さないならこのステップは落とす。
9. `ADMIN_EMAILS` の設定手順を書き、Kamal に配線する。credentials 投入を Kamal 変更より先にする。
