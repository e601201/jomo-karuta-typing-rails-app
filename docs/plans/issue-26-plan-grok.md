---
issue: 26
author_model: cursor-grok-4.6-xhigh
kind: implementation-plan
---

# Issue #26 実装プラン: 管理者用フィードバック閲覧ページ

対象: [e601201/jomo-karuta-typing-rails-app#26](https://github.com/e601201/jomo-karuta-typing-rails-app/issues/26)
ラベル: `enhancement`（コメントなし。要判断 3 項は未決のまま）
先行: #7（書き込み経路。`Feedback` / `FeedbacksController` / `/feedback` / 4 カテゴリ enum）

このプランは **読み取り側だけ** を閉じる。実装時は本ドキュメントの「決めたこと」を前提にしてよく、issue 本文のチェックボックスを実装 PR で埋める。

---

## 1. 問題定義

### 何が壊れているか / 誰が困るか

#7 でプレイヤー（**ゲスト**含む）はアプリ内フォームから **フィードバック** を送れる。保存先は `feedbacks` テーブルだけであり、運営が中身を見る手段は `rails console`（または `bin/kamal console` / `dbc`）に限る。

ユーザー影響はプレイヤー側には出ない。影響を受けるのは運営だけである。ただし CONTEXT.md の定義どおりフィードバックは「送信内容は公開されず、他のプレイヤーからは見えない」私信なので、**見られないこと自体が運営の見逃し**になり、送った側には「届いたのか分からない」状態が続く。#7 の時点でこのリスクは承知のうえで書き込みを先行しており、本 issue がその受け皿。

### 受け入れ条件

1. 運営だけが、保存済みフィードバックを **新しい順** で一覧できるページがある。
2. 各件に少なくとも次を出す。
   - `category`（4 種: バグ報告 / 機能リクエスト / 使い方の質問 / その他）
   - `body`（本文。途中で切らない）
   - `email`（任意の返信先。空なら空と分かる）
   - 送信者（紐付いた **ユーザー** か **ゲスト** か）
   - `created_at`
   - （スキーマに既にある）任意の `subject`。issue 本文は列挙していないが、#7 後続のマイグレーションで追加済み。出さないと運営がコンソールに戻る。
3. **ゲスト**・一般のログイン **ユーザー** からは中身が見えない（公開チャネルにしない）。
4. 既存の `GET/POST /feedback`（誰でも送れる書き込み経路）は変えない。

### スコープ外

- 既読 / 対応済みフラグ、ステータス更新、返信メール送信、通知（Slack 等）。
- ページネーション gem、サーバ側カテゴリ絞り込み、検索、CSV エクスポート。
- プレイヤー向けメニュー（`Header`）へのリンク追加。運営は URL を直接開く。
- `users` への role 列、Devise/Pundit、HTTP Basic。
- CONTEXT.md への「管理者」用語追加（後述）。
- フィードバック送信フォーム・バリデーション・ハニーポット・rate_limit の変更。
- 退会 UI（まだ無い）。ただし `has_many :feedbacks` を足すなら `dependent: :nullify` を先に正しく置く。

---

## 2. ドメイン用語との対応

CONTEXT.md の語彙だけを使う。シノニムは使わない。

| 画面・実装で扱うもの     | 使う語                                                                                                            | 使わない語                                                      |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| プレイヤーが送った 1 件  | **フィードバック**                                                                                                | お問い合わせ、問い合わせ、バグ報告（4 種の 1 つとしてだけ使う） |
| 未ログインの送信者       | **ゲスト**                                                                                                        | 匿名ユーザー、非会員                                            |
| ログインして送った送信者 | **ユーザー**（アカウントの nickname / email）                                                                     | 会員                                                            |
| 任意の返信先             | フィードバックの `email`（ゲストが書く返信先。アカウントの email とは別）                                         | —                                                               |
| 4 種                     | バグ報告 / 機能リクエスト / 使い方の質問 / その他（enum `bug_report` `feature_request` `usage_question` `other`） | —                                                               |

**「管理者」は用語集に無い。** 本プランではプレイヤー領域の概念にしない。認可は「この OAuth アカウントの email が運営の許可リストにあるか」という **運用設定** であり、ロールや権限モデルをドメインに導入しない。CONTEXT.md は更新しない。将来、運営向け画面が複数になり「管理者」がユビキタス言語として必要になったら `/domain-modeling` で足す。

ADR との関係:

- ADR 0001 / 0002 / 0003 は旧 Svelte ルートテスト方針。現行の Inertia 一覧（`History` / `Ranking` / `Feedback`）は **request spec が契約**で、ページの Vitest は持たない。本画面もそれに合わせる。
- ADR 0008（タイム表記）はゲームの秒数の話であり、`created_at` には適用しない。履歴画面と同じ `ja-JP` の日時表記でよい。
- 既存 ADR と矛盾する決定は無い。認可の「なぜ role 列を足さないか」は実装時に短い ADR を 1 本足してよい（§8）。

現状コードとの対応:

- 書き込み: `FeedbacksController`（`require_login` なし、ゲスト可、`user_id` は session からのみ）。
- 読み取りは **別モジュール**。公開コントローラに `index` を足さない。

---

## 3. 推奨アプローチ

### 要約

1. **認可**: email 許可リストを隠す深いモジュール `AdminAccess`（インターフェースは `granted?(user) -> bool`）。空リストは誰も通さない（fail closed）。
2. **HTTP**: `GET /admin/feedbacks` を `Admin::FeedbacksController#index` だけが持つ。未ログインは `/auth/login` へ（`/history` と同じ）。ログイン済みだが許可リスト外は **404**（403 で「運営ページがある」と教えない）。
3. **データ**: マイグレーションで列は足さない。`Feedback.includes(:user).order(created_at: :desc, id: :desc)` を全件返す。件数上限もページネーションも付けない（上限は「古い件がまたコンソール行き」になる）。
4. **UI**: Inertia ページ `admin/Feedbacks`。履歴に近い金枠ダークのカード縦積み。カテゴリの見た目フィルタだけクライアント側（履歴のモードタブと同じ深さ）。
5. **ナビ**: `Header` も `inertia_share` も触らない。

### 認可モジュールのインターフェース（Design it twice）

呼び出し側はコントローラとテストだけ。プレイヤー向けコードは知らない。

**採用: 設計 A — 判定だけを返す深いモジュール**

```
AdminAccess.granted?(user)  # -> true | false
```

呼び出し側が知らなくてよいこと: 許可リストの出典（`ENV["ADMIN_EMAILS"]` を優先し、無ければ `Rails.application.credentials.dig(:admin, :emails)`）、カンマ/空白分割、大小文字無視、空なら全員拒否、`user.nil?` は false。

深さ: 出典・パース・fail closed がこの 1 メソッドの向こうにあり、コントローラは「通らなければ 404」だけ。テストも同じ seam を叩く。アダプタはまだ 1 つ（ENV/credentials をモジュール内部で読む）なので、ソース切替用の第二アダプタは作らない。

出典を二重にする理由: 本番は既存どおり credentials + `RAILS_MASTER_KEY`（Kamal が既に注入。OAuth 用 ENV を増やさなくてよい）。開発/テストは `.env` と RSpec の `ENV` 差し替えで足りる。`dotenv-rails` は development/test のみ。`.gitignore` が `/.env*` なので `.env.example` には頼らず、`docs/deployment.md` に書く。

**却下: 設計 B — `User#admin?`**

`User` に運営判定を載せる。呼び出しは短いが、プレイヤー集約に運用フラグが混ざる。許可リスト変更が「ユーザーの属性」に見え、用語集にも無い概念がモデルに固定される。許可リストを ENV に置いても、問い合わせ窓口が `User` だと「ロールがある」と読まれる。

**却下: 設計 C — コントローラが ENV を直接読む / `Admin::BaseController` を先に切る**

判定と HTTP 応答が 1 箇所に溶けると、request spec 以外で fail closed や大小文字を試せない。逆に `Admin::BaseController` を今切るのは、アダプタが 1 つの仮 seam になる（次の運営画面が出来てから抽出する）。v1 は `Admin::FeedbacksController` の private `require_admin` で足りる。

### HTTP 応答

- ゲスト → `redirect_to "/auth/login"`（運営が未ログインで URL を開いたときにログインへ誘導する。`HistoriesController` と同じ）。
- ログイン済み・非許可 → `head :not_found`（Inertia 専用 404 ページは作らない）。
- 許可 → `200` + Inertia `admin/Feedbacks`。

ゲストにも 404 を返す案は、運営が「先にログインが必要」と知っている前提になり、初回運用で詰まりやすいので採らない。ゲスト 302 / 非許可 404 の差でパスの存在は推測できるが、中身は出ない。本アプリの脅威モデル（個人運営のタイピングゲーム、フィードバックは非公開）では十分。

### 一覧の形

`HistoriesController` が `as_json(only: ...)` で列を閉じているのと同じ契約。ネストした送信者だけは AR の `as_json(include:)` だと `type: "guest"` が出せないので、コントローラ（または `Feedback` の 1 メソッド）で明示する。

Inertia props 契約:

```
{
  feedbacks: [
    {
      id: number,
      category: "bug_report" | "feature_request" | "usage_question" | "other",
      subject: string | null,
      body: string,
      email: string | null,          // 返信先（任意）。アカウント email ではない
      created_at: string,
      sender:
        { type: "user", id: number, nickname: string | null, email: string }
        | { type: "guest" }
    }
  ]
}
```

- `sender.type: "user"` の `email` は `users.email`（OAuth アカウント）。
- 行の `email` はフィードバックの返信先。ログイン送信でもゲスト送信でも入りうる。両方出す。
- `avatar_url` や `user_id` 単体は出さない。
- コントローラ発明のキーは履歴に合わせて camelCase でもよいが、v1 は配列 1 本だけなので `feedbacks` で足りる。`recentLimit` は上限を設けないので不要。

本文は最大 1000 字で件数も少ない想定（作成は 1 分 5 通 + ハニーポット）。全件 + 全文を 1 レスポンスで返す。カードで折り畳まず全文を出す。

クライアント側カテゴリタブ（すべて / 4 種）は履歴のモードタブと同じ「表示だけ」のフィルタ。クエリパラメータもサーバ分岐も持たない。

`created_at` 用インデックスは任意だが、`ORDER BY created_at DESC` の意図を schema に残すなら 1 本足してよい。機能の前提ではない。

### `User` 側の関連

`belongs_to :user, optional: true` の逆を足す。

```
has_many :feedbacks, dependent: :nullify
```

`scores` と同じ（公開ランキングを消さない）理由に近い: フィードバックは運営の私信であり、将来ユーザーを消しても本文は残したい。FK は既に null 可。関連を足すだけでマイグレーションは不要。`dependent` 無しだと `user.destroy` が FK 違反になる。

---

## 4. 却下した代替案

### 認可

- **`users.role` / boolean `admin`** — マイグレーションと用語が要る。最初の 1 人をコンソールで立てるブートストラップが残るので、結局許可リスト相当が要る。運営画面がフィードバック一覧だけの今は YAGNI。
- **HTTP Basic（Inertia の外）** — 既存の OAuth セッションと二重になり、ブラウザが Basic をキャッシュする。誰が開いたかの監査も `current_user` と繋がらない。issue の例としては挙がっているが、ログイン済みユーザーモデルと食い違う。
- **user id の許可リスト** — email より安定だが、credentials に数字が並び運用者が読めない。OAuth email は `User` で unique 必須。
- **Pundit / Action Policy** — ポリシーがこの 1 アクションしかない。浅いラッパになる。
- **秘密 URL（トークンパス）** — 漏洩したら取り消しが難しく、OAuth と別に秘密を配ることになる。

### 一覧機能

- **ページネーション（pagy 等）** — gem もクエリも画面も増える。件数は個人運営では小さい。今付けると受け入れ条件の「埋もれを解消」より「ページを跨ぐ」が先に来る。
- **History 式の `LIMIT 50/200`** — 履歴は「最近の自分のプレイ」で足りる。フィードバックは古いバグ報告ほど残したい。上限は問題の再発。
- **サーバ側 `?category=`** — クライアントタブで足りる。Ranking のように URL と同期する価値は、共有・リロード固定が要るときだけ。運営の個人ブックマーク用途では不要。
- **既読フラグを今のマイグレーションで足す** — 列だけ足して更新 UI が無いと未完成。対応ワークフローは別 issue。
- **公開コントローラに `FeedbacksController#index`** — 書き込み（公開・ゲスト可）と読み取り（運営のみ）が同じクラスに載り、`require_login` を付けてはならない #7 の回帰テストと衝突しやすい。
- **`Header` に運営だけリンク** — `inertia_share` に `isAdmin` を毎ページ載せる必要がある。design.pen に項目が無く、一般ユーザーの DOM にも出し分ける分岐が入る。v1 は URL 直打ち。

---

## 5. モジュール / ファイルと責務の境界

新しい **モジュール** は 2 つ。既存の書き込みモジュールは触らない（関連 1 行を除く）。

### `AdminAccess`（新規）

- ファイル: `app/models/admin_access.rb`（このリポジトリの非 AR PORO は `Badge` と同様 `app/models` に置いている。`lib/` は `assets` / `tasks` のみ）
- インターフェース: `AdminAccess.granted?(user)`
- 実装: 許可リストの解決と比較。HTTP も ActiveRecord も知らない。
- テスト: `spec/models/admin_access_spec.rb`（同じインターフェース）

### `Admin::FeedbacksController`（新規）

- ファイル: `app/controllers/admin/feedbacks_controller.rb`
- インターフェース: `GET /admin/feedbacks` → Inertia ページ名 `admin/Feedbacks` と上記 props。認可失敗の応答。
- 実装: `require_admin`、`includes(:user)`、props 組み立て。
- `FeedbacksController`（公開）とは名前空間もクラスも分ける。

### 既存への小さな穴

| ファイル                                         | 責務の変化                                                                                                          |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------- |
| `config/routes.rb`                               | `namespace :admin { resources :feedbacks, only: [:index] }` → `/admin/feedbacks`。公開 `get/post "feedback"` は維持 |
| `app/models/user.rb`                             | `has_many :feedbacks, dependent: :nullify` のみ                                                                     |
| `app/models/feedback.rb`                         | 一覧用の明示シリアライズを置くならここ（コントローラに書いてもよい。二重にしない）                                  |
| `spec/factories/feedbacks.rb`                    | `:with_user` / 件名あり、など一覧 spec が読みやすい trait                                                           |
| `app/frontend/pages/admin/Feedbacks.tsx`         | 運営向け一覧。`pages: '../pages'`（`entrypoints/inertia.tsx`）で自動解決                                            |
| `docs/deployment.md`                             | 許可リストの置き方（credentials の `admin.emails` と開発用 `ADMIN_EMAILS`）                                         |
| `config/credentials.yml.enc`                     | 本番の許可リスト。値は PR に生で書かない                                                                            |
| `docs/adr/0011-admin-email-allowlist.md`（任意） | role 列を置かない理由                                                                                               |

触らないもの: `FeedbacksController` の create ロジック、`Header.tsx`、`ApplicationController#inertia_share`、`SharedProps` への admin フラグ、プレイヤー向け `pages/Feedback.tsx`（カテゴリラベル 4 つは管理画面側に同じ文言を持ってよい。共有定数への抽出は必須にしない）。

フロントのカテゴリラベルは CONTEXT.md の 4 種と `Feedback.tsx` の `CATEGORIES` に一致させる。

---

## 6. 小さな実装ステップ（コミット単位）

各コミットのあとテストは緑、アプリは起動可能。

### コミット 1: `AdminAccess` だけ

- `granted?(nil)` は false。
- `ADMIN_EMAILS` 空 / 未設定、credentials も空 → false（fail closed）。
- 大小文字無視、カンマ区切り複数、余分な空白。
- ENV が空のとき credentials の配列（またはカンマ区切り文字列）を読む。テストは ENV を優先して差し替え、credentials 分岐は 1 例でよい。
- ルーティングも画面もまだ無い。

### コミット 2: 空の一覧でも認可だけ通す

- `config/routes.rb` に `namespace :admin`。
- `Admin::FeedbacksController#index` が `feedbacks: []` で `admin/Feedbacks` を描く。
- 最小の `app/frontend/pages/admin/Feedbacks.tsx`（型が通る見出しだけでも可）。
- request spec `spec/requests/admin/feedbacks_spec.rb`:
  - 未ログイン → `/auth/login`
  - ログイン・許可リスト外 → 404、Inertia 本文に他者のフィードバックが無い
  - 許可リスト内 → 200 かつ `admin/Feedbacks`
- ログインヘルパは `spec/requests/histories_spec.rb` / `feedbacks_spec.rb` の OmniAuth mock を踏襲。許可リストは example 前後で `ENV["ADMIN_EMAILS"]` を戻す。

### コミット 3: 読み取り契約

- 新しい順（同秒は `id` DESC）。
- ゲスト行: `sender.type == "guest"`、`user_id` をクライアントに出さない。
- ユーザー行: nickname とアカウント email。
- 返信先 `email` と `subject` の有無。
- props のキー白名单（余分なカラムが漏れていない）。
- `includes(:user)`（N+1 を避ける。bullet は入っていないので spec で `user` を使う行を複数件作れば足りる）。
- `User has_many :feedbacks, dependent: :nullify` と、既存 `user_spec` の scores に倣った destroy 時 nullify 例。
- factory trait。

任意: `add_index :feedbacks, :created_at` をこのコミットに含めてよい。

### コミット 4: 運営が読める UI

- `History` / `Feedback` と同じ背景・金枠・Header（`auth.user` は共有 props）。
- 空状態（0 件のときコンソールに頼らなくてよい一文）。
- カード（または折り畳まない行）にカテゴリチップ・件名・本文・返信先・送信者・日時。
- 日時は `History` の `toLocaleString('ja-JP')` と同じ粒度。
- カテゴリタブは `useState` のみ。`router.get` しない。
- 本文は React のテキストノードのまま（`dangerouslySetInnerHTML` 禁止。プレイヤー入力）。

### コミット 5: 運用ドキュメント（と任意 ADR）

- `docs/deployment.md` の日常運用に「フィードバックを見る: 許可リストの email で OAuth ログインして `/admin/feedbacks`」と credentials キー名。
- ADR を書くなら「許可リストであり role ではない」「空は全員拒否」「第二の運営画面が出来たら `Admin::BaseController` に `require_admin` を上げる」。

本番 credentials の実 email は人間が `bin/rails credentials:edit` する。エージェントはプレースホルダのキー構造だけ示し、他人のメールを推測して書き込まない。

---

## 7. テスト計画

層はこのリポジトリの既存の分け方に合わせる。

### 足す

**`spec/models/admin_access_spec.rb`**
外部行為は `granted?` の真偽だけ。ENV の復元を `around` / `ensure` で必ずやる（スイート汚染が最大の回帰源）。

**`spec/requests/admin/feedbacks_spec.rb`**（主契約。`histories_spec` / `feedbacks_spec` が手本）

- 認可マトリクス（ゲスト / 一般ユーザー / 許可ユーザー）。
- 許可ユーザーに Inertia コンポーネント名と props 形状。
- 新しい順、ゲストとユーザーの `sender`、件名・返信先の任意。
- 他ユーザーのフィードバックも **運営には見える**（ここは履歴と逆。履歴は「他人のプレイ記録を無視」、本画面は「全件が運営の対象」）。逆の spec を書いて取り違えを防ぐ。
- 非許可ユーザーの 404 レスポンスに本文・email が含まれないこと。

**`spec/models/user_spec.rb`**
`dependent: :nullify` の 1 例。

**factory**
一覧用に `user` 付き、`subject` 付き。

### 直す / 触らない

- `spec/requests/feedbacks_spec.rb` は公開 GET が未認証のまま 200 であることを既に守っている。回帰として残す。本 issue で壊してはならない。
- `spec/models/feedback_spec.rb` のバリデーションは変更しない。
- フロント: `History.tsx` に page spec が無いのと同じく、`admin/Feedbacks.tsx` の Vitest は必須にしない。ADR 0001 的なルート統合テストも、現行 Inertia ページ群に無いので新設しない。
- `bun run check` が新しいページの props 型を見る。`SharedProps` を広げないならページローカルの props 型でよい。

### セキュリティ系

- CI の Brakeman が admin の全件クエリを警告したら、認可が `before_action` にあることを前提に、必要なときだけ fingerprint を検討（先に警告内容を読む）。
- コントローラの strong params は GET だけなので新規の mass assignment は無い。

---

## 8. リスク、回帰、検証

### リスク

1. **本番で許可リスト未設定** → 運営自身も 404。fail closed は正しい。デプロイ手順に書かないと「ページが無い」ように見える。
2. **許可リストの email と OAuth の `users.email` 不一致**（別 Google アカウント、GitHub の noreply）。`User.from_omniauth` は email 必須。リストはログイン後に `/profile` で見える email と一致させる。
3. **公開 `/feedback` に `require_login` や admin 判定が混線** → ゲストが送れなくなる。既存 request spec が検知する。
4. **props の出しすぎ**（`avatar_url`、内部 id 以外の個人情報）。白名单の spec で固定する。
5. **XSS** — 本文を HTML として出さない。
6. **Inertia ページ名** — `render inertia: "admin/Feedbacks"` とファイル `pages/admin/Feedbacks.tsx` の不一致は request spec の `render_component` と Vite 解決の両方で落ちる。
7. **`allow_browser versions: :modern`** — 運営も現行ブラウザが必要。既存画面と同じ制約。

### 回帰ポイント

- `GET /feedback` 未認証 200、`POST /feedback` ゲスト保存、`user_id` の session 決定。
- `GET /history` など他の `require_login` ページが admin 判定の影響を受けない（`ApplicationController` に `require_admin` を上げない）。
- Header の「フィードバック」が今までどおり `/feedback`（送信フォーム）。

### 検証方法（実装時）

テスト:

```
bundle exec rspec spec/models/admin_access_spec.rb spec/requests/admin/feedbacks_spec.rb spec/requests/feedbacks_spec.rb spec/models/user_spec.rb
bun run check
```

ブラウザ（UI を入れたあと必須。スクリーンショットだけは不可）:

1. `ADMIN_EMAILS` に自分の開発用 OAuth email を入れてログイン。
2. ゲストとユーザーのそれぞれで `/feedback` から 1 件ずつ送る（既存経路の回帰）。
3. `/admin/feedbacks` で新しい順・送信者の区別・件名・本文・返信先を目で確認。カテゴリタブで表示が絞れること。
4. 別 email のユーザーでログインし直して `/admin/feedbacks` が 404 であること。
5. ログアウトして同 URL がログインへ飛ぶこと。
6. Header から送信用 `/feedback` が開けること（運営リンクが混ざっていないこと）。

curl（認可だけ先に見るとき）:

```
# 未ログイン
curl -s -o /dev/null -w "%{http_code} %{redirect_url}\n" http://localhost:3000/admin/feedbacks
```

セッション付きの 200/404 は request spec の方が安定。ブラウザで Cookie を持った確認を優先する。

---

## 9. 未決事項と仮定

issue 本文の 3 つの要判断は、本プランでは次で **閉じた** ものとして実装してよい。実装中に覆すなら PR で明記する。

| 要判断                             | このプランの決定                                             |
| ---------------------------------- | ------------------------------------------------------------ |
| 認可モデル                         | email 許可リスト（`AdminAccess`）。role 列も Basic も無し    |
| ページネーション・カテゴリ絞り込み | ページネーション無し・全件。カテゴリはクライアント側タブのみ |
| 既読/対応済み                      | 持たない。マイグレーションで列を足さない                     |

仮定:

- 運営者は少数（事実上 1 アカウント）で、OAuth 済みの `users.email` を知っている。
- フィードバック件数は個人運営の規模で、全件 1 ページが実用的。増えたら別 issue でページネーションを足す。
- 「管理者」を CONTEXT.md に足さない。
- プレイヤーに運営 URL を案内しない。
- 件名を一覧に含める（現行スキーマを正とする）。
- 第二の運営画面が出来るまで `Admin::BaseController` は作らない。
- 本番の実 email は人間が credentials に入れる。コードと docs はキー名だけ。

実装者が判断してよい細部（プロダクトの分岐ではない）:

- シリアライズを `Feedback#as_admin_row` にするかコントローラの private メソッドにするか（どちらか一方）。
- `created_at` インデックスを今足すか。
- ADR 0011 を同時に書くか（書くなら短い「なぜ role ではないか」に限定）。

残る人間作業（コードでは代替できない）:

- 本番 `admin.emails`（またはデプロイ後の `ADMIN_EMAILS`）に運営の OAuth email を入れること。これを忘れると受け入れ条件 1 が本番で満たされない。
