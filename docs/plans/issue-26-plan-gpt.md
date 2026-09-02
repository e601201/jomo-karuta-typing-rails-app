# Issue #26「管理者用フィードバック閲覧ページを作る」実装計画

## 目的と前提

`/feedback` から保存された非公開の「フィードバック」を、許可された運営者だけが新しい順に閲覧できる Inertia ページとして追加する。Issue #7 の書き込み経路は変更せず、既存の Rails + Inertia + React 構成に合わせる。

本リポジトリは単一 VPS / PostgreSQL の構成（`config/deploy.yml:1-17`, `config/deploy.yml:63-80`）で、GitHub issue の運用主体も現状は単一 owner である。したがって、将来の組織的な権限管理を先取りせず、少人数運用で安全に閉じることを優先する。

## 1. 現状把握

### ドメインと先行 Issue

- 「フィードバック」は、バグ報告・機能リクエスト・使い方の質問・その他の4種類を持つ単一の非公開チャネルで、ゲストも送信できる。本文が主で、件名と返信先メールアドレスは任意である（`CONTEXT.md:84-89`）。
- Issue #7 とそのコメントでは、アプリ内 `/feedback` への配線、ゲスト送信、`Header` の不要な callback の除去までが決められた。実装済みのヘッダーはゲスト・ログインユーザーの両メニューから `/feedback` に遷移する（`app/frontend/components/layout/Header.tsx:137-163`, `app/frontend/components/layout/Header.tsx:320-328`）。
- ADR 0001〜0010 はすべて確認した。0001〜0003 はフロントのルート／配線テストの責務分割、0004〜0010 は設定、プレイ記録、永続化、バッジ、時刻表記、対戦の決定であり、本 Issue の認可・フィードバック閲覧に直接の決定はない。本計画は既存 ADR と衝突しない。

### Feedback のモデルと DB

- `Feedback` は `User` に optional で属し、ゲスト送信では `user_id` が `nil` になる（`app/models/feedback.rb:1-3`）。
- `category` は PostgreSQL native enum と対応する4値である（`app/models/feedback.rb:6-16`, `db/schema.rb:18-23`）。
- 本文は必須かつ最大1000文字、件名は任意かつ最大100文字、email は任意かつメール形式を検証する（`app/models/feedback.rb:4-5`, `app/models/feedback.rb:18-25`）。
- `feedbacks` は `body`, `category`, `email`, `subject`, timestamps, nullable `user_id` を持つ。現状の index は `user_id` のみで、既読・対応状態はない（`db/schema.rb:40-49`）。外部キーも設定済みである（`db/schema.rb:130-134`）。
- factory は最小の category/body/email を提供し（`spec/factories/feedbacks.rb:1-7`）、model spec は4カテゴリ、本文・件名・email の validation と optional user を既に検証している（`spec/models/feedback_spec.rb:3-73`, `spec/models/feedback_spec.rb:75-84`）。

### 書き込み経路

- 公開 `FeedbacksController` はゲストを許可し、`create` に 1分5回の rate limit と honeypot を設けている（`app/controllers/feedbacks_controller.rb:1-7`, `app/controllers/feedbacks_controller.rb:13-17`）。
- `user_id` は params から許可せず、セッションの `current_user` だけを関連付ける（`app/controllers/feedbacks_controller.rb:18-21`, `app/controllers/feedbacks_controller.rb:32-36`）。
- GET/POST は同じ `/feedback` で、現在は管理者ルートや `admin` namespace がない（`config/routes.rb:21-25`）。
- request spec はゲストのフォーム閲覧、正常／異常保存、ゲストとログインユーザーの関連付け、`user_id` 改ざん拒否、honeypot をカバーする（`spec/requests/feedbacks_spec.rb:16-24`, `spec/requests/feedbacks_spec.rb:26-120`）。

### 認証

- 認証状態は cookie session の `session[:user_id]` から `current_user` を引く方式である（`app/controllers/application_controller.rb:19-25`）。通常のログイン必須ページは、未ログイン時に `/auth/login` へ redirect するだけで、管理者認可は存在しない（`app/controllers/application_controller.rb:27-29`）。
- OAuth callback は `User.from_omniauth` でユーザーを解決し、session fixation 対策として `reset_session` 後に `user_id` を保存する（`app/controllers/sessions_controller.rb:11-18`）。
- Google / GitHub OmniAuth を利用し、GitHub は `user:email` scope を要求する（`config/initializers/omniauth.rb:1-6`）。ユーザー解決は既存 identity、同一 email の user、新規 user の順である（`app/models/user.rb:39-55`）。
- Inertia の全ページには `auth.user` が shared props として渡る（`app/controllers/application_controller.rb:7-16`）。管理者か否かを shared props に追加する必要はなく、管理者ページへの公開メニューも現状ない。

### View / CSS の規約

- Rails ERB view は共通 layout だけで、ページ本体は `app/frontend/pages/` の Inertia React/TypeScript である。layout は Vite の CSS と `inertia.tsx` を読み込む（`app/views/layouts/application.html.erb:21-26`）。
- Inertia は `app/frontend/pages` を resolver root とし、共有設定をページ遷移時に適用する（`app/frontend/entrypoints/inertia.tsx:5-17`）。
- ページは `<Head>`、共通 `<Header>`、背景画像、Tailwind utility class、Noto Serif / Sans と既存の紺・金・赤の配色を使う（例: `app/frontend/pages/Feedback.tsx:147-170`）。グローバル CSS は Tailwind と forms / typography plugin のみである（`app/frontend/entrypoints/application.css:1-4`）。
- 一覧表の既存例は、横 overflow、見出し行、罫線、空状態をページ内 Tailwind class で構成する（`app/frontend/pages/History.tsx:214-280`）。日時整形は `Intl` 相当のブラウザ API を使う（`app/frontend/pages/History.tsx:55-63`）。
- フォーム側のカテゴリ表示名は React 内の定数で enum 値と対応付けている（`app/frontend/pages/Feedback.tsx:26-33`）。

### テスト規約

- backend は RSpec + FactoryBot + inertia_rails matcher で、request spec が HTTP status、component、props、並び順、属性 whitelist を検証する（`spec/rails_helper.rb:10-12`, `spec/rails_helper.rb:38-59`, `spec/requests/rankings_spec.rb:4-47`）。
- OAuth の外部通信は suite 全体で test mode にし、各 example 後に mock auth を消す（`spec/rails_helper.rb:42-49`）。
- frontend は Vitest + Testing Library、型検査は `tsc`、format / lint は Prettier + ESLint である（`package.json:2-27`, `package.json:29-35`）。
- 現状 `spec/system` はなく、Capybara / Selenium 依存もない。また generator の system test 生成は無効化されている（`config/application.rb:39-40`, `Gemfile:39-50`）。ただしこれは手書き system spec の実行禁止ではない。
- CI の backend job は PostgreSQL と事前ビルド済み Vite assets を使い、全 RSpec を実行する（`.github/workflows/ci.yml:52-97`）。system spec を加える場合は headless browser が CI で安定して起動することを最初に確認する必要がある。

## 2. 要判断3点への推奨案

### 2.1 認可モデル

#### 選択肢

1. **既存 OAuth ログイン + email 許可リスト**
   - 長所: DB migration、新しいログイン方式、権限編集 UI が不要。既存の session / `current_user` を再利用でき、少人数運用に合う。許可リストを Rails encrypted credentials に置けばリポジトリへ平文 PII を置かずに済む。
   - 短所: 管理者の追加・削除には credentials の更新と deploy が必要。email 変更時に追随が必要で、権限監査や委譲には向かない。既存 OAuth の email 同一性を信頼境界にする。
2. **`users` に `role` enum または `admin` boolean を追加**
   - 長所: 権限が DB に永続化され、複数管理者、権限変更、将来の管理 UI や監査へ発展させやすい。
   - 短所: migration、初期管理者の bootstrap、権限変更手段、誤昇格対策が必要。本 Issue の「一覧を読む」だけに対して管理機能全体の入口を作ることになりやすい。
3. **HTTP Basic 認証**
   - 長所: アプリの user / OAuth と独立し、単一共有アカウントなら実装量が少ない。
   - 短所: 認証情報が二系統になり、個人単位の識別ができない。共有 password の配布・rotation が必要で、ブラウザ標準 UI も既存体験と分断する。

#### 推奨

**1 の「既存 OAuth + encrypted credentials の email 許可リスト」**を推奨する。`Rails.application.credentials.dig(:admin, :emails)` を配列で持ち、trim + lowercase した完全一致だけを許可する。設定が欠落／空なら誰も通さない fail-closed とする。

`Admin::BaseController` に `before_action :require_admin` を置き、今後の `Admin::*Controller` は必ず継承させる。未ログイン・ログイン済み非管理者の双方へ **404 Not Found** を返し、管理 URL とデータの存在を不要に開示しない。通常ページの `require_login` redirect は使用しない。

### 2.2 ページネーション・カテゴリ絞り込み

#### 選択肢

1. **全件表示、絞り込みなし**
   - 長所: 最小実装。
   - 短所: 件数増加とともに DB、JSON、DOM が無制限に増える。公開投稿経路があるため、少人数アプリでも安全な上限がないのは避けるべき。
2. **50件単位の offset pagination、絞り込みなし**
   - 長所: 依存 gem なしでレスポンスを有界にできる。運営者は全ページを辿れる。初期の閲覧用途に必要十分。
   - 短所: 深い page では offset が遅くなり、閲覧中の新規投稿でページ境界がずれる可能性がある。カテゴリ別作業には向かない。
3. **pagination + category の server-side filter**
   - 長所: 件数が多いときに目的の種類を探しやすい。filter 中の総件数と pagination を正しく保てる。
   - 短所: query params、validation、状態保持、空状態、テストの組合せが増える。利用実績のない初期画面には先取りになりやすい。
4. **cursor pagination または pagination gem**
   - 長所: cursor は新規投稿中も境界が安定し、gem は汎用 helper を提供する。
   - 短所: この1画面には API / UI や依存追加が重い。前後・総ページ表示の要件も未提示である。

#### 推奨

**2 の「50件単位の依存なし offset pagination、カテゴリ絞り込みは見送る」**を推奨する。`created_at DESC, id DESC` で同時刻も決定的に並べ、`page` は正の整数へ正規化し、総ページ範囲へ clamp する。props は現在 page、1ページ件数、総件数、総ページ数に限定する。

初期量では feedbacks 全体の count / sort コストは小さいため index migration は行わない。実測で増えたら `(created_at, id)` 複合 index、category filter、keyset pagination を同時に検討する。クライアントだけで現在 page をカテゴリ絞り込みすると「全件を絞った」ように誤認させるため採用しない。

### 2.3 既読／対応済みフラグ

#### 選択肢

1. **状態を持たない**
   - 長所: 読み取り専用の目的に集中でき、migration、更新 endpoint、CSRF、競合、状態定義が不要。
   - 短所: 見逃しや二重対応をアプリ内では防げない。
2. **`read_at` または `handled_at` timestamp を1つ持つ**
   - 長所: boolean より「いつ」を残せ、未読／既読または未対応／対応済みを単純に表現できる。
   - 短所: 「開いたら既読」か手動か、「読んだ」と「対応した」のどちらを表すかが未決定。更新 UI と endpoint が必要。
3. **`status` enum（new / in_progress / resolved 等）**
   - 長所: 複数運営者の対応 workflow に発展できる。
   - 短所: 担当者、履歴、再オープンなど追加要件を呼び、単一運営者・初回一覧には過剰。

#### 推奨

**1 の「状態を持たない」**を推奨する。本 Issue はまず読み取り経路を成立させる。実運用で見逃しが残ると確認できた時点で、「既読」ではなく運営上意味のある `handled_at` または status workflow を別 Issue で定義する。この判断により **DB migration は不要**である。

## 3. 実装計画

### ルーティング

- `config/routes.rb`
  - `namespace :admin do; resources :feedbacks, only: :index; end` を追加する。
  - URL は **`GET /admin/feedbacks`**、helper は `admin_feedbacks_path` とする。
  - 公開の `GET/POST /feedback` と controller を共用しない。読み取りと書き込みで認可境界が異なるため、`admin` namespace を明示する。

### 認可

- `app/controllers/admin/base_controller.rb`（追加）
  - `ApplicationController` を継承し、全 action の前に credentials allowlist と `current_user.email` を照合する。
  - 未設定、未ログイン、非許可 email はすべて `head :not_found`。
  - `expires_now` に加えて `Cache-Control: no-store` を設定し、PII を含む管理画面レスポンスを共有 cache / browser cache に残しにくくする。
- `config/credentials.yml.enc`（運用設定）
  - `admin.emails` に初期管理者 email の配列を追加する。値そのものを通常の設定ファイルや plan に書かない。
  - アプリコンテナは既に `RAILS_MASTER_KEY` を受け取るため（`config/deploy.yml:26-33`）、新しい deploy 用 secret 変数は不要。

### 一覧取得

- `app/controllers/admin/feedbacks_controller.rb`（追加）
  - `Admin::BaseController` を継承する。
  - `PER_PAGE = 50` とし、`Feedback.includes(:user).order(created_at: :desc, id: :desc)` から対象 page だけを取得する。`includes(:user)` で送信者表示の N+1 を防ぐ。
  - `as_json` の安易な展開ではなく、明示的 serializer/hash で `id`, `category`, `subject`, `body`, `email`, `created_at`, `sender` のみ返す。`sender` は user があれば `{ id, nickname }`、なければ `nil` とする。
  - account email は sender props に含めない。送信者がフォームの返信先 email を空にした意思を、account email の露出で迂回しないためである。
  - pagination props として `page`, `perPage`, `totalCount`, `totalPages` を返す。
  - `subject` は Issue #26 の列挙にはないが既存 Feedback の構成要素なので、空でなければ本文の前に表示する案とする（最終確認事項を参照）。

### Inertia React 画面

- `app/frontend/pages/admin/Feedbacks.tsx`（追加）
  - `<Head title="フィードバック管理 - 上毛かるたタイピング">`、共通 `Header`、既存背景・配色・font 定数を使う。
  - 4カテゴリを日本語 label / chip に対応付ける。
  - desktop は既存 History に倣った横スクロール可能な table、狭幅では内容が欠落しない最小幅を持たせる。
  - 各行に category、任意 subject、body、任意返信先 email、送信者（`ユーザー #ID` と nickname、または `ゲスト`）、送信日時を表示する。空 email は `—` とする。
  - body / subject は通常の React text node で描画し、改行は `whitespace-pre-wrap`、長い文字列は `break-words` で表示する。HTML / Markdown 化や `dangerouslySetInnerHTML` は使わない。
  - 日時は `Intl.DateTimeFormat` で `Asia/Tokyo` を明示し、画面にも JST と分かる表記を置く。
  - 0件の空状態、前へ／次へと page 番号を Inertia `Link` で提供する。`page` 以外の不明な query param は引き回さない。
  - 管理者リンクは一般ユーザーの `Header` に追加しない。初期運用では管理者が URL を直接開く。

### ログ保護

- `config/initializers/filter_parameter_logging.rb`
  - 既存の `:email` に加え、フィードバック本文・件名が POST request log に残らないよう `:body`, `:subject` を filter 対象に加える。
  - controller / frontend から feedback データを `Rails.logger` / `console.log` へ出さない。

### DB migration

- **追加しない。** 既読・role・index のいずれも今回追加しないため、schema 変更はない。

### テストとテスト基盤

- `spec/requests/admin/feedbacks_spec.rb`（追加）: 認可、props、並び順、ページングを検証する。
- `app/frontend/pages/admin/Feedbacks.spec.tsx`（追加）: 表示分岐と Inertia link の配線を検証する。
- `spec/system/admin_feedbacks_spec.rb`（追加）: 管理者の閲覧、XSS escaping、次ページ遷移の最小 smoke test とする。
- `Gemfile`, `Gemfile.lock`（変更）: system spec 用の Capybara / Selenium を test dependency として追加する。
- `.github/workflows/ci.yml`（条件付き変更）: Ubuntu runner の既存 Chrome で安定しない場合に限り browser setup を明示する。まず変更なしで system spec を実行する。

## 4. コミット分割案

親エージェントが実装する際は、次の小さい単位を推奨する。

1. **「管理者名前空間の認可境界を追加する」**
   - routes、`Admin::BaseController`、credentials 設定、認可 request spec。
   - 未ログイン／非管理者が404、許可 email の user だけが index action へ到達できる状態で該当 request spec を緑にする。
2. **「フィードバック一覧データとページングを返す」**
   - `Admin::FeedbacksController`、一覧・並び順・sender・whitelist・50件 pagination の request spec、parameter log filtering。
   - view が未完成でも Inertia component 名と props 契約が request spec で緑になる。
3. **「管理者用フィードバック一覧画面を追加する」**
   - `app/frontend/pages/admin/Feedbacks.tsx` と必要な frontend page spec。
   - `bun run check`, `bun run lint`, `bun run test` を緑にする。
4. **「管理者フィードバック画面の system spec を追加する」**
   - Capybara / Selenium の最小依存と headless 設定、admin UI smoke system spec、必要なら CI の browser setup。
   - system spec 単体と全 RSpec を緑にする。CI runner で browser 起動が不安定なら、製品コードと混ぜずこのコミット内だけで設定を調整できる。
5. **「管理者フィードバック閲覧機能を統合検証する」**
   - 原則コード変更なし。RuboCop、Brakeman、全 RSpec、frontend lint / typecheck / test を実行し、必要な修正があれば関心ごと別の小コミットにする。

## 5. テスト計画

### Request spec

- `spec/requests/admin/feedbacks_spec.rb`（追加）
  - credentials の `admin.emails` を example ごとに stub し、実値へ依存させない。
  - 未ログインは **404**。
  - ログイン済みだが許可リスト外の user は **404**（必須の認可負テスト）。
  - allowlist 未設定／空でも404となる fail-closed。
  - 許可された user は200で `admin/Feedbacks` component を受け取る。
  - admin email 比較が前後空白・大文字小文字の正規化後に完全一致し、部分一致しない。
  - 新しい順、同じ `created_at` では大きい `id` 順。
  - user 付き feedback と guest feedback の sender props が正しく、別 user の account email、`updated_at` 等の非許可属性を返さない。
  - 50件上限、総件数、総ページ数、2 page 目、0件、0／負数／文字列／過大な page の正規化。
  - Inertia partial request header を付けても同じ認可 before_action を通り、非管理者が props を取得できない。

### System spec

- 現状は system spec 基盤がないため、`Gemfile` / `Gemfile.lock` に test 用 `capybara` と `selenium-webdriver`、`spec/system/admin_feedbacks_spec.rb` に `selenium_chrome_headless` の最小設定を追加する。`config.generators.system_tests = nil` は generator 設定にすぎないため変更不要。
- UI を通した smoke test は絞って次を検証する。
  - mock OAuth で許可された管理者としてログインし、`/admin/feedbacks` でカテゴリ、日本語本文、任意 email、user / ゲスト、JST 日時が見える。
  - body に `<script>` や event handler 風文字列を含む fixture を置き、文字列として表示され、要素／script として解釈されない。
  - 51件以上で「次へ」を押すと page 2 へ移動し、重複しない古い行が見える。
- 認可の権威は browser ではなく controller なので、未ログイン／非管理者404の組合せは request spec を主とし、system spec で重複網羅しない。

### Frontend page spec

- `app/frontend/pages/admin/Feedbacks.spec.tsx`（追加）
  - Inertia `Link` / `Head` 等の末端だけを mock し、カテゴリ label、空状態、任意値の `—`、sender 表示、pagination link の配線を確認する。
  - React の text escaping 自体を再実装してテストせず、危険文字列が text として渡され `dangerouslySetInnerHTML` を使わないことを system smoke と code review で担保する。

### Model spec

- 今回は model/schema を変更せず、並び順と pagination は controller の取得契約なので、**新しい model spec は追加しない**。spec のためだけに `Feedback.recent` の薄い scope を作らない。
- 既存 `spec/models/feedback_spec.rb` を全実行し、4カテゴリ、optional user、本文／件名／email validation が引き続き緑であることを確認する。将来 `handled_at` や status を追加する別 Issue では、その時点で model spec を追加する。

### 全体検証

- `bundle exec rspec`
- `bundle exec rubocop`
- `bundle exec brakeman --no-pager`
- `bun run check`
- `bun run lint`
- `bun run test`

## 6. セキュリティ上の注意点

- **XSS:** feedback の body / subject は攻撃者入力である。React text node 以外で描画せず、HTML、Markdown、リンク自動変換、`dangerouslySetInnerHTML` を禁止する。改行表示は CSS だけで行う。
- **PII:** email、本文、件名は PII／センシティブ情報を含み得る。管理 endpoint の props 以外へ載せず、shared props、analytics、localStorage、client-side store に入れない。account email は sender 表示に流用しない。
- **cache:** 管理画面へ `Cache-Control: no-store` を付ける。運営者は共有端末を避け、作業後にログアウトする。
- **認可バイパス:** 公開 `FeedbacksController` に index を足さず、`Admin::BaseController` 継承を唯一の入口にする。frontend の表示／非表示を認可に使わない。通常 request、Inertia partial request、query 改ざんのすべてで server-side before_action が先に走ることを request spec で固定する。
- **allowlist:** email は trim + lowercase の完全一致、空設定は拒否とする。allowlist の内容を response や log に出さない。OAuth identity の email 信頼性は人間確認事項とする。
- **ログ:** Rails の parameter filtering に body / subject / email を含め、例外メッセージや手動 logger に record inspection を載せない。production log は STDOUT に集約されるため（`config/environments/production.rb:35-42`）、アプリ内だけでなく収集先の保持・アクセス権も運用確認する。
- **最小データ:** serializer の whitelist で `User` 全体や不要な timestamps を返さない。email はリンク化せず plain text とし、意図しない外部 navigation を発生させない。

## 7. スコープ外

- フィードバック詳細ページ、編集、削除、返信、export。
- 既読／未読、対応済み、status、担当者、対応履歴。
- category 絞り込み、全文検索、並び替え。
- メール／Slack 等への新着通知。
- `users.role`、権限管理 UI、複数 role、監査 log。
- 一般ユーザー向け Header への管理メニュー追加。
- feedback の保存仕様、rate limit、honeypot、validation の変更。
- 保存期間、匿名化、削除依頼対応などのデータ retention 機能。
- 大量データ向け keyset pagination、複合 index、専用 pagination gem。

## 8. 未解決の疑問（人間への確認）

1. 初期 allowlist に登録する管理者 email はどれか。Google / GitHub のどちらでログインするか、および provider が返す email が verified であることを運用上確認できるか。
2. 非管理者への応答は本計画の **404** でよいか。権限不足を明示する運用上の必要があるなら403へ変更するが、情報露出は増える。
3. Issue #26 の表示項目にない任意 `subject` も表示してよいか。本計画は保存済み情報を埋もれさせないため表示を推奨する。
4. `created_at` は日本の運営者向けに JST 固定表示でよいか。既存 History は browser locale 依存なので、統一を優先するなら別判断が必要。
5. system spec 基盤（Capybara / Selenium）を本 Issue で初導入してよいか。本計画は PII 管理画面の最小 smoke test として導入を推奨するが、CI の browser 保守を受け入れない場合は frontend page spec + request spec に縮退する。
6. feedback の保存期間、閲覧担当、確認頻度はどうするか。画面追加だけでは「誰も見に行かない」運用リスク自体は解消しないため、少なくとも確認頻度を運用手順として決める必要がある。
