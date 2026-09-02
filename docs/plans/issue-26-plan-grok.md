# Issue #26 実装計画: 管理者用フィードバック閲覧ページ

対象: [GitHub issue #26](https://github.com/e601201/jomo-karuta-typing-rails-app/issues/26)「管理者用フィードバック閲覧ページを作る」

本計画は調査と方針の固定のみ。コード実装は含まない。

用語は `CONTEXT.md` に従う。**フィードバック**はプレイヤーが運営へ送る単一チャネル（バグ報告 / 機能リクエスト / 使い方の質問 / その他）であり、公開されず他のプレイヤーからは見えない。送信者は**ユーザー**または**ゲスト**。本ページは運営がそれを読むための非公開画面であり、プレイヤー向けメニューには出さない。

先行決定（PR #27 / issue #7）: 書き込み側は保存のみ。mailer・通知なし。DB を読む管理者ページは見逃しリスクを承知の上で切り出し → 本 issue。

既存 ADR（0001〜0010）との衝突は無い。0001〜0003 は旧フロントのルート統合テスト方針、0004〜0010 は設定同期・プレイ記録・バッジ・対戦であり、管理者認可には触れていない。実装時に「管理者は email 許可リスト」を ADR 0011 として残すことを推奨する（本計画のファイル追加には含めない）。

---

## 1. 現状把握

### 1.1 フィードバック（書き込み側・#7）

| 対象 | 場所 | 要点 |
| --- | --- | --- |
| モデル | `app/models/feedback.rb` L1–24 | `belongs_to :user, optional: true`。enum 4 カテゴリ（`bug_report` / `feature_request` / `usage_question` / `other`）。`body` 必須・最大 1000、`subject` 任意・最大 100、`email` 任意（記入時のみ形式検証） |
| コントローラ | `app/controllers/feedbacks_controller.rb` L1–38 | `new` / `create` のみ。`require_login` なし（ゲスト可）。`rate_limit` 5/分、honeypot `website`、`user_id` は session からのみ |
| ルート | `config/routes.rb` L21–24 | `GET/POST /feedback`。管理者用ルートは無い |
| テーブル | `db/schema.rb` L41–50 | `body`, `category`（native enum `feedback_category`）, `email`, `subject`, `user_id`（nullable）, timestamps。既読・対応済み列は無い |
| フロント | `app/frontend/pages/Feedback.tsx` | Inertia ページ。カテゴリは日本語ラベル付き 4 ボタン。成功時は flash.notice で同ページに留まる |
| モデル spec | `spec/models/feedback_spec.rb` | validations + ゲスト（user なし）が valid |
| request spec | `spec/requests/feedbacks_spec.rb` | GET は未ログインで 200、POST の保存・任意項目・honeypot・不正 category |
| factory | `spec/factories/feedbacks.rb` | `category: "other"`, body あり, email nil |

`User` は `has_many :feedbacks` を持たない（`app/models/user.rb` L1–57）。FK は `add_foreign_key "feedbacks", "users"`（`db/schema.rb` L131）のため、フィードバックを残したユーザーを `destroy` すると制約違反になる。一覧で `includes(:user)` するなら、`has_many :feedbacks, dependent: :nullify` を同じ変更に含める（退会後も行は残し、送信者はゲスト相当として表示）。

`subject` は issue 本文の表示項目に無いが、#7 で追加済みの任意件名なので一覧に含める。

### 1.2 認証

| 対象 | 場所 | 要点 |
| --- | --- | --- |
| `current_user` | `app/controllers/application_controller.rb` L21–25 | `session[:user_id]` → `User.find_by`。ロール列は無い |
| `require_login` | 同 L27–29 | 未ログインは `redirect_to "/auth/login"`。403/404 は使わない |
| ログイン | `app/controllers/sessions_controller.rb` L12–17 | OmniAuth（Google / GitHub）。`reset_session` 後に `session[:user_id]` |
| User | `app/models/user.rb` L13, L42–57 / `db/schema.rb` L120–127 | `email` 必須・unique。OAuth の email がアカウント識別子 |
| 共有 props | `ApplicationController` L7–16 | `auth.user` に `id email nickname avatar_url created_at` を全 Inertia ページへ配る。管理者フラグは無い |

管理者・ロール・Basic 認証・許可リストはコードベースにゼロ（`admin` のヒットなし）。

### 1.3 一覧 UI の既存流儀

プレイヤー向け一覧の手本はプレイ履歴。

- `HistoriesController`（`app/controllers/histories_controller.rb` L1–24）: `require_login`、`order(created_at: :desc).limit(RECENT_LIMIT)`（50）、`as_json(only: …)` でホワイトリスト、件数超過は `recentLimit` で前端に伝える。
- `History.tsx`（`app/frontend/pages/History.tsx`）: 背景画像 + 金枠紺パネル、ヒーロー見出し、テーブル、空状態、モードタブは**クライアント側**で絞る。日付は `toLocaleString('ja-JP')`。
- ページネーション gem（pagy / kaminari）は未導入（`Gemfile` に無し）。
- デザインカンプ `docs/design/design.pen` に管理者画面は無い。プレイヤー向け「Feedback Screen」（ノード `wNwWp`）と History のテーブルを流用する。

### 1.4 フロント / Inertia

- ページ解決: `app/frontend/entrypoints/inertia.tsx` L14–15 の `pages: '../pages'`。`render inertia: "auth/Login"` → `app/frontend/pages/auth/Login.tsx`。管理者ページは `admin/Feedbacks` → `app/frontend/pages/admin/Feedbacks.tsx`。
- レイアウトは ERB 1 枚（`app/views/layouts/application.html.erb`）。プレイヤー画面と同じ Header を載せてよいが、メニュー項目は増やさない。
- ページ単位の vitest は無い（spec があるのはゲーム部品・ストア）。ADR 0001〜0003 は本画面には適用しない。
- `dangerouslySetInnerHTML` の使用箇所はゼロ。本文はテキストとして出す。

### 1.5 テスト規約

- RSpec request spec が画面契約の主戦場。`require "inertia_rails/rspec"`（`spec/rails_helper.rb` L12）。`expect_inertia.to render_component("History")` と props のキー/並びを断言する（例: `spec/requests/histories_spec.rb` L14–78）。
- ログインヘルパは各 spec 内の OmniAuth mock（共有 support は未使用）。
- **system spec は無い。** `config/application.rb` L39–40 で `config.generators.system_tests = nil`。Capybara / Playwright の自動テストも Gemfile に無い。CI の backend_test は Vite ビルド + `bundle exec rspec` のみ（`.github/workflows/ci.yml` L82–97）。
- テスト環境は `allow_forgery_protection = false`（`config/environments/test.rb` L28–29）、`show_exceptions = :rescuable`（L25–26）。

### 1.6 運用・秘密情報

- 本番は Kamal 1 台（`config/deploy.yml`）。秘密は `config/credentials.yml.enc` に集約し、`.kamal/secrets` が `credentials:fetch` で ENV 注入（`docs/deployment.md` L34–45）。
- 開発/テストの OAuth は dotenv。`ADMIN_*` は未定義。
- `filter_parameters` に `:email` 済み（`config/initializers/filter_parameter_logging.rb` L6–8）。`:body` は未フィルタ（既存の POST `/feedback` ログに本文が載り得る。本 issue の GET 一覧では params に本文は来ない）。

---

## 2. 要判断 3 点 — 選択肢と推奨

運用前提: メンテナは少人数（実質 1 人）、同時接続は少なく、フィードバック件数も当面は数十〜数百の見込み（公開フォームだが honeypot + 5 件/分）。プレイヤー向け機能に管理者 UI を混ぜない。

### 2.1 認可モデル — 誰を管理者とするか

**A. OAuth 済みユーザーの email 許可リスト（推奨）**

- `User#admin?` が `Rails.application.config.x.admin_emails`（小文字化・trim 済み）に自分の `email` が含まれるか見る。
- 値の出所は既存の秘密情報の流儀に合わせる: credentials の `admin.emails`（カンマ区切り）→ `.kamal/secrets` で `ADMIN_EMAILS` に fetch → initializer が ENV を読む。開発は `.env` の `ADMIN_EMAILS`。
- 未ログイン → 既存どおり `/auth/login` へ 302。ログイン済み非管理者 → **404**（`head :not_found`）。空リストは誰も管理者にしない（fail closed）。

長所: マイグレーション不要、ロール UI 不要、既存の Google/GitHub セッションをそのまま使う、許可メールの追加は credentials 編集 + 再デプロイだけ、テストで config を差し替えやすい。  
短所: メール変更時はリスト更新が必要（本アプリは email がアカウントキーなので頻度は低い）、人数が増えるとリスト運用が雑になる。

**B. `users.role`（または `admin` boolean）列**

長所: DB で昇格でき、再デプロイなし。  
短所: マイグレーション + 最初の 1 人を console で立てる作業が必ず残る、誤昇格の攻撃面、今の規模では使う UI も API も無い。ADR 0007 が「今いらないテーブルを持たない」方向であることとも逆行する。

**C. HTTP Basic 認証（セッションと独立）**

長所: User モデルを触らない。  
短所: OAuth と別の共有パスワード、Inertia との相性が悪い、総当たり、誰が読んだかの監査ができない。既存認証を捨てる理由が無い。

**推奨: A。** 管理者は「許可リストに載った email でログインしたユーザー」と定義する。ロール列も Basic も今は作らない。

404 を 403 にしない理由: プレイヤー向けに管理者 URL の存在を教えない。未ログインはログイン誘導（運営者本人がログアウト状態でブックマークを開く経路）を残す。

### 2.2 ページネーション・カテゴリ絞り込み

**A. ページネーション gem なし。新しい順で全件（または History 同様の件数上限）+ 任意でクライアント側カテゴリタブ（推奨）**

- コントローラは `Feedback.includes(:user).order(created_at: :desc)`。件数保険として `limit(200)` + 総件数を props に載せる（`HistoriesController::RECENT_LIMIT` と同じパターン）。
- 絞り込みが欲しければ History のモードタブ（`History.tsx` L193–212, クライアント `useState`）をコピーし、4 カテゴリ + 「すべて」にする。サーバ query は足さない。

長所: gem 追加なし、#20 の履歴と同じ認知負荷、この件数では JSON も小さい。  
短所: 上限を超えると古い行は見えない（そのときは別 issue で pagy 等）。クライアント絞り込みは「いま載っている行」にしか効かない。

**B. pagy 等でサーバページネーション + `?category=`**

長所: 将来の件数増に強い。  
短所: 依存追加、Inertia の `router.get` 配線、テスト増。今の見込み件数に対して過剰。

**推奨: A。** 初期実装は上限付き新しい順一覧で十分。カテゴリタブは History 流儀なら安いので入れてよい（必須ではない）。サーバ側フィルタと gem は件数が見えてから。

### 2.3 既読 / 対応済みフラグ

**A. 持たない（推奨）**

issue の「やること」は一覧して読むこと。`created_at` 降順で新しいものが上に来る。運用者は 1 人なので、ブラウザで上から読めば足りる。

長所: マイグレーションなし、PATCH も状態機械もなし、書き込み側（#7）のスキーマを変えない。  
短所: 「未対応だけ」は絞れない。対応漏れは運用で吸収する（#7 が既に受け入れた見逃しリスクの延長）。

**B. `read_at` または `status` enum を追加**

長所: チケット管理に近づく。  
短所: トグル UI、認可付き更新、テスト、未使用カラム。対応ワークフローは issue に無い。

**推奨: A。** フラグが必要になったら、その時点の運用（本当に未読管理が痛いか）を見てマイグレーションする。今回は閲覧専用。

---

## 3. 実装計画

マイグレーション: **不要**（既読フラグを持たないため）。`schema.rb` は触らない。

ルーティング: **`namespace :admin` を使う。**

```ruby
namespace :admin do
  resources :feedbacks, only: [:index]
end
# GET /admin/feedbacks  → admin_feedbacks_path
```

プレイヤーの `GET/POST /feedback` は変更しない。`/admin/feedback`（単数）にはしない。`resources` の index に合わせ、将来 show を足す余地を残す。

プレイヤー向け Header / サイトマップにはリンクを出さない。URL は運営がブックマークする。

### 3.1 変更・追加ファイル

**追加**

| ファイル | 役割 |
| --- | --- |
| `config/initializers/admin.rb` | `ENV["ADMIN_EMAILS"]` を split/strip/downcase して `config.x.admin_emails` に格納。未設定は `[]` |
| `app/controllers/admin/base_controller.rb` | `Admin::BaseController < ApplicationController`。`require_login` のあと `require_admin`（非管理者は `head :not_found`） |
| `app/controllers/admin/feedbacks_controller.rb` | `index`。`includes(:user).order(created_at: :desc).limit(LIMIT)`。props はホワイトリスト（下記） |
| `app/frontend/pages/admin/Feedbacks.tsx` | 一覧 UI。History のテーブル + Feedback の色・フォント。空状態。本文は `whitespace-pre-wrap` のテキスト（HTML 解釈しない） |
| `spec/requests/admin/feedbacks_spec.rb` | 認可マトリクス + props 契約 |

**変更**

| ファイル | 役割 |
| --- | --- |
| `app/models/user.rb` | `def admin?`。`has_many :feedbacks, dependent: :nullify` |
| `config/routes.rb` | 上記 namespace |
| `spec/models/user_spec.rb` | `#admin?`（リスト一致 / 不一致 / 大文字小文字 / 空リスト）と `dependent: :nullify` |
| `spec/factories/users.rb` | 必要なら `:admin` trait（email をテスト用許可アドレスに固定）。trait が config に依存しすぎるなら spec 側で email を合わせるだけでもよい |
| `config/deploy.yml` | `env.secret` に `ADMIN_EMAILS` |
| `.kamal/secrets` | `ADMIN_EMAILS=$(bin/rails credentials:fetch admin.emails)` |
| `docs/deployment.md` | `admin.emails` の書き方（カンマ区切り、OAuth の email と一致させる） |

**フロント型**

`app/frontend/types/index.ts` に管理者ページ専用の props 型を足してもよいが、`History.tsx` と同様ページ内 interface でもよい。共有 `SharedProps` に `admin` フラグは足さない（ページを知っている必要がプレイヤー側に無い）。

**意図的に触らないもの**

- `FeedbacksController` / `Feedback.tsx` / プレイヤー向け `Header.tsx`
- `feedbacks` テーブル
- mailer、通知、詳細ページ、削除、返信 UI

### 3.2 コントローラが渡す props（契約）

各要素は issue の表示項目 + #7 の件名。

```text
feedbacks: [
  {
    id, category, subject, body, email, created_at,
    sender: null | { id, nickname, email }   # user が居るときだけ。ゲストは null
  }
]
totalCount: number
recentLimit: number   # 上限定数。History と同じく前端の「N 件表示中」用
```

- `sender == null` → 表示は「ゲスト」。`email` 列はフィードバック行の任意返信先。
- `sender` あり → 「ユーザー」（nickname 優先、なければ sender.email）。行の `email` はフォームの返信先（アカウント email と違うことがある）。
- `user.as_json` 丸写しはしない（`avatar_url` 等を管理者画面に出さない）。
- 並びは `created_at desc, id desc`（同時刻の安定ソート）。

カテゴリの日本語ラベルは `Feedback.tsx` L28–33 と同じ 4 語を管理者ページに重複定義してよい（4 件だけ、フォームと管理画面を結合しない）。

### 3.3 `User#admin?` の置き場所

認可の縫い目（seam）は HTTP ではなく `User#admin?` 1 メソッド。コントローラは `current_user.admin?` だけ見る。許可リストのパースは initializer に閉じる。テストは model spec でリストの境界、request spec で HTTP の分岐、の二層にする。

### 3.4 UI の最低限

- タイトル「フィードバック」（運営向けであることが分かるサブコピーは可。プレイヤー向け文言「ご意見・ご要望を…」は使わない）
- テーブル列: 日時 / 種類 / 件名 / 本文 / 返信先 email / 送信者
- 本文が長い場合は行内で折る（`pre-wrap`）。詳細ページは作らない
- 0 件の空状態
- Header は既存の `{ user }` のみ。管理者リンクを足さない

開発中の確認: `.env` に自分の OAuth email を `ADMIN_EMAILS` で入れ、ログインして `/admin/feedbacks` を直接開く。

---

## 4. コミット分割案

各コミットのあと `bundle exec rspec`（該当 spec）が緑であること。フロントを含むコミットでは `bun run check` / `bun run lint` も緑。

1. **認可の土台**  
   `config/initializers/admin.rb`、`User#admin?`、`has_many :feedbacks, dependent: :nullify`、`spec/models/user_spec.rb`。  
   緑: user model spec。HTTP はまだ無い。

2. **管理者一覧のサーバ契約**  
   `Admin::BaseController`、`Admin::FeedbacksController#index`、routes、`spec/requests/admin/feedbacks_spec.rb`。Inertia コンポーネント名 `admin/Feedbacks` を render するが、ページファイルが無いと開発サーバでは壊れるため、**同じコミットで空に近いページ stub**（見出しと件数だけ）を置いてもよい。  
   緑: request spec 一式（未ログイン 302、非管理者 404、管理者 200、並び、ゲスト/ユーザー、props キー、他ユーザー分も含む全件、上限）。

3. **一覧 UI**  
   `app/frontend/pages/admin/Feedbacks.tsx` を History 流儀で埋める。カテゴリタブを入れるならここ。  
   緑: `bun run check` / `lint`。RSpec はページの存在以外は 2 と同じ。

4. **本番の許可リスト配線**  
   `config/deploy.yml`、`.kamal/secrets`、`docs/deployment.md`。credentials 本体（`admin.emails`）は `credentials:edit` が人間作業。コミットに平文 email を書かない。  
   緑: 既存テストに影響なし。

コミットメッセージ例: `管理者の email 許可リストを User#admin? で判定する` / `管理者向けフィードバック一覧のサーバ契約を追加する` / `管理者向けフィードバック一覧ページを追加する` / `本番に ADMIN_EMAILS を注入する手順を追加する`。

---

## 5. テスト計画

### 5.1 model spec（`spec/models/user_spec.rb`）

- `admin?` は許可リストに含まれる email で true、含まれなければ false
- 大文字小文字を無視する
- リストが空なら常に false
- ユーザー削除時、紐づく feedbacks の `user_id` が nil になり行は残る

`Feedback` モデル自体の変更は無いので `spec/models/feedback_spec.rb` の追加は必須ではない。association を書くなら「user なしで valid」は既存のまま。

### 5.2 request spec（`spec/requests/admin/feedbacks_spec.rb`）— 認可の主戦場

ログインは既存どおり OmniAuth mock。各 example の前後で `Rails.application.config.x.admin_emails` を差し替え、漏れなく空配列に戻す。

**負テスト（必須）**

| 主体 | 期待 |
| --- | --- |
| 未ログイン | `GET /admin/feedbacks` → 302 `/auth/login`。Inertia の管理者コンポーネントを render しない |
| ログイン済み・許可リスト外 | **404**。本文にフィードバック本文・他者 email が出ない。`Feedback` が 1 件あっても props を渡さない |
| 許可リスト外が直接 URL を叩く（上記の繰り返しに見えるが、これが issue 指定の「非管理者は 403/404」） | 404 で統一。403 は使わない |

**正テスト**

- 許可リスト内 → 200、`expect_inertia.to render_component("admin/Feedbacks")`
- 新しい順（`created_at` が新しい行が先頭）
- ゲスト行: `sender` が nil、行の `email` が任意値のまま
- ログイン送信行: `sender.id/nickname/email` がホワイトリストどおり。`avatar_url` を含まない
- 他人のフィードバックも見える（履歴の「他ユーザー分は見えない」テストの逆。管理者は全件）
- `only` キーが契約どおり（余分なカラムを出さない）
- 上限を超えたら `feedbacks.size == recentLimit` かつ `totalCount` は全件

公開側 `GET/POST /feedback` の既存 spec が落ちないこと（回帰）。

### 5.3 system spec

**この issue では追加しない。**

根拠: `config.generators.system_tests = nil`、`spec/system` 不在、Capybara 未導入。Inertia の system spec は Vite 起動とセッション Cookie が要り、CI の backend_test も RSpec request 前提。認可の分岐は DOM ではなくステータスコードと props が本体なので、request spec の方が既存規約に合う。

ブラウザ確認は実装時に開発サーバで行う（許可ユーザーで一覧、別アカウントで 404、未ログインでログイン画面）。自動の system spec は別 issue で基盤を入れるまで持たない。

ページの vitest も、History / Feedback に page spec が無いので必須にしない。描画の退行は「テーブル列を落とす」程度で、契約は request spec の props キーで抑える。

---

## 6. セキュリティ上の注意点

### XSS

- フィードバック本文・件名・email・nickname はすべてユーザー入力。React のテキストノードで出す（既存どおり `dangerouslySetInnerHTML` 禁止）。
- `whitespace-pre-wrap` は改行表示用であり、HTML を有効化しない。
- カテゴリはサーバの enum 値だけをラベル表に通す。未知値は生文字列を出さず「不明」等にする。

### PII

- 一覧は他者の email・本文・アカウント識別子を含む。許可リスト外に JSON が渡った時点で漏えい。
- props は必要列だけ。`auth.user` の共有は全ページ既存なので追加漏えいにはならないが、**管理者ページの `feedbacks` 配列**が新しい機微データ。
- `InertiaRails` は `encrypt_history = true`（`config/initializers/inertia_rails.rb` L5）。戻る操作で history.state から生 props を拾いづらくなっている。この設定を外さない。
- ログ: 一覧 GET の params に本文は無い。`Rails.logger` に feedback を dump しない。`:email` は既にフィルタ済み。本文を params フィルタに足すのは POST `/feedback` の別改善（本 issue のスコープ外、ただし実装中に `p feedbacks` しないこと）。
- 本番 `config.log_level` は info（`production.rb` L40–41）。debug にすると PII が増えるので運用で上げない。

### 認可バイパス

- 判定はサーバの `current_user.admin?` のみ。クライアントの申告・共有 props のフラグ・hidden field は使わない（`FeedbacksController` が `user_id` を permit しないのと同じ思想）。
- 許可リストは email 文字列比較。OAuth が email を変えない前提（`User.from_omniauth` は既存 email で紐付け）。リストは credentials に置き、リポジトリに本番アドレスを書かない。
- `namespace :admin` の全アクションを `Admin::BaseController` 配下に置く。今後 show/update を足すとき `FeedbacksController`（公開）に index を足して認可漏れ、という事故を防ぐ。
- 未ログイン 302 は「管理者 URL の存在」をわずかに示唆する。許容する（運営者の利便）。存在隠しを徹底するなら未ログインも 404 だが、`require_login` と不揃いになり、ブックマーク運用が苦くなる。
- 公開フォーム側の honeypot / rate_limit は維持。管理者 GET に rate_limit は不要。

### その他

- CSP は現状コメントアウト（`config/initializers/content_security_policy.rb`）。本 issue で有効化しない。
- Header に管理者リンクを足すと全ログインユーザーが URL を知る。出さない。
- 開発環境で `ADMIN_EMAILS` を空のままにする（デフォルト fail closed）。実装者の `.env` にだけ自分のアドレスを書く。

---

## 7. スコープ外

- メール通知・Slack・webhook（#7 で「保存のみ」と決めた続き）
- 返信・チケット化・担当者
- 既読 / 対応済みフラグとそれを更新する UI
- 詳細ページ、編集、削除
- ページネーション gem、全文検索、CSV エクスポート
- `users.role` / Devise / Basic 認証
- プレイヤー向け Header・フッターへの管理者リンク
- 公開フィードバックフォームの変更（honeypot、字数、カテゴリ）
- POST `/feedback` のログから本文をフィルタする改善
- ユーザー退会フローの UI（association の `nullify` だけ入れる）
- デザインカンプ新規ノード
- system spec / Capybara 基盤
- CONTEXT.md の用語追加は任意（「管理者」を足すなら実装 PR で。本計画の必須ではない）

---

## 8. 未解決の疑問（人間確認）

実装に入る前に決まっていると安全な点。推奨で進めてよいものはその旨を書いた。

1. **許可する OAuth email は何か。** 本番 credentials の `admin.emails` に入れる値。実装 PR ではプレースホルダ手順だけ書き、実際の値はメンテナが `credentials:edit` する想定。複数人ならカンマ区切りで足せる。
2. **未ログイン時 302 vs 404。** 本計画は既存 `require_login` に合わせ 302。存在隠しを優先するなら未ログインも 404 にできる。
3. **カテゴリタブを初回から入れるか。** 本計画は「入れてよいが必須ではない」。サーバフィルタは初回やらない。
4. **件数上限 200 でよいか。** History は 50。フィードバックは本文があるので 200 でもペイロードは小さい。全件無制限でも当面は困らない。
5. **ADR 0011 を同時に書くか。** 認可モデルは一度決めると後から変えにくいので、実装 PR で短い ADR を残すことを勧める。
6. **`subject` を列に出すか。** issue 箇条書きに無いが #7 で追加済みのため出す想定。列を最小にするなら本文と種類と送信者だけでも要件は満たす。

---

## 付録: 実装時のチェックリスト（人間 / 次のエージェント向け）

- [ ] `User#admin?` が ENV 由来の許可リストだけを見る
- [ ] `GET /admin/feedbacks` が namespace `admin` 配下
- [ ] 未ログイン 302、非管理者 404、管理者 200 の request spec
- [ ] props が新しい順・ホワイトリスト・ゲスト null sender
- [ ] マイグレーションを増やしていない
- [ ] Header に管理者リンクが無い
- [ ] 本文を HTML として出していない
- [ ] 本番手順（credentials / kamal）がドキュメントにある
- [ ] 既存 `spec/requests/feedbacks_spec.rb` が緑のまま
