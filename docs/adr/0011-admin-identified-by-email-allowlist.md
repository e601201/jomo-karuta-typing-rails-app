# 運営の識別は許可リスト方式にし、ロール列を持たない

運営（フィードバック一覧を読める人）は `users` にロール列を足さず、環境変数 `ADMIN_EMAILS`（カンマ区切りメール）の許可リストで判定する。アプリは credentials を直読みせず ENV だけを見る。本番は Kamal が credentials の `admin.emails` から ENV へ注入する（OAuth と同じ経路）。未設定・空は fail-closed（誰も運営にならない）。判定の述語は `User#admin?` の 1 箇所に閉じ、呼び出し側は `current_user&.admin?` だけを知る。運営以外（未ログインも含む）には常に 404 を返し、ページの存在を伏せる。導線は Header のドロップダウンに運営だけ出す。

**理由**: 運営は当面 1 人想定で、ロール付与 UI も作らない。列を足しても結局コンソールでフラグを立てることになり、ドメインに「ロール」を増やすコストの方が大きい。credentials 直読みは `config/master.key` の無い開発クローンと CI を壊す。ログインへ飛ばす 302 や「権限がありません」は管理 URL の存在を教える。`Admin::BaseController` や独立モジュール（AdminAccess 等）は、保護対象が 1 ページの時点では過剰で、既存の `require_login` パターンともずれる。

## Considered Options

- **(却下) `users.admin` / `role` 列** — デプロイなしで運営を増やせるが、付与 UI が無いのでコンソール依存は消えない。将来必要なら `User#admin?` の中身だけ差し替える。
- **(却下) credentials 直読み** — master.key の無い環境で起動や CI が落ちる。アプリの読み口は ENV に統一する。
- **(却下) HTTP Basic 認証** — OAuth と並ぶ第 2 の認証機構になり、`current_user` が立たず Header がゲスト表示になる。
- **(却下) 未ログインをログインへ 302 + flash** — URL の存在漏洩。未ログインもログイン済み非運営も同じ 404 にする。
- **(却下) `Admin::BaseController` / `AdminAccess` PORO** — サブクラスが 1 つ、述語が 1 つ。運営ページが 2 つ目になったら抽出する。`User#admin?` は既存の `require_login` と置き場所を揃える。
- **(却下) ActiveAdmin / Avo / pundit 等** — 読み取り専用のテーブル 1 枚に対して依存が重い。

## Consequences

- **運営の追加・削除は許可リストの更新（開発は `.env`、本番は credentials → デプロイ）が必要。** credentials に `admin.emails` を入れる前に Kamal の `ADMIN_EMAILS` 配線をデプロイすると `credentials:fetch` でデプロイが落ちる。
- **許可リスト未設定の環境では運営自身も 404 になる（fail-closed）。**
- **監査ログは持たない。** 誰が一覧を開いたかは残らない。
- **将来ロール列へ移すときは `User#admin?` だけを差し替える。** 呼び出し側と Header の `auth.is_admin` は変えなくてよい。
