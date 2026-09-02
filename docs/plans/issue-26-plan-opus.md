# issue #26 実装計画: 管理者用フィードバック閲覧ページを作る

対象 issue: [#26 管理者用フィードバック閲覧ページを作る](https://github.com/e601201/jomo-karuta-typing-rails-app/issues/26)（label: `enhancement` / コメントなし）
先行 issue: [#7 ヘッダーの「フィードバック」メニュー項目の遷移先を実装する](https://github.com/e601201/jomo-karuta-typing-rails-app/issues/7)

---

## 1. 現状把握

### 1.1 このアプリの構成（issue 本文の前提とズレている点）

issue には「`app/views/feedbacks/`」とあるが、**このアプリに ERB のフィードバック View は存在しない**。Rails + Inertia + React（TSX）+ Tailwind v4 の構成で、`app/views/` には `layouts` と `pwa` しか無い（`app/views/`）。画面は `app/frontend/pages/*.tsx` にあり、コントローラは `render inertia: "Feedback"` のようにページ名を返すだけ。計画はこの前提で立てる。

- ビルド: Vite（`vite_rails`）+ bun。フロントのテストは Vitest + Testing Library。
- **system spec（Capybara）はこのリポジトリに存在しない。** `Gemfile` に capybara / selenium が無く、`spec/` 配下も `channels` / `factories` / `models` / `requests` のみ（`spec/`）。したがって「ブラウザで画面を触るテスト」の役割は **Vitest のコンポーネント spec** が担っている（例: `app/frontend/components/battle/BattleResult.spec.tsx`）。テスト計画はこの構成に合わせる（§5 で明記）。

### 1.2 認証・認可

- `app/controllers/application_controller.rb:21-25` — `current_user` は `session[:user_id]` から `User.find_by` するだけ。
- `app/controllers/application_controller.rb:27-29` — `require_login` は未ログインなら `/auth/login` へ **リダイレクト**（403/404 は返さない）。
- `app/controllers/application_controller.rb:7-17` — `inertia_share` が全ページへ `auth.user`（`id / email / nickname / avatar_url / created_at` のみ）、`settings`、`best_scores`、`csrf_token`、`flash` を配る。
- `app/controllers/sessions_controller.rb:12-20` — ログインは OmniAuth コールバックのみ。パスワード認証は無い（`bcrypt` も入っていない）。
- `app/models/user.rb:42-57` — `User.from_omniauth`。**(b) の経路で「メールアドレス一致の既存ユーザーに新しい Identity を紐付ける」**。つまりメールアドレスが実質のアカウント識別子になっている（§6 で再掲）。
- **ロール／管理者の概念はコードにもスキーマにも一切無い。** `rg -ni "admin|role"` のヒットは ARIA の `role=` 属性と `docs/agents/triage-labels.md` だけ。
- `db/schema.rb:120-127` — `users` は `avatar_url / created_at / email / nickname / updated_at` のみ。
- 認可の負テストの既存パターンは 2 通り: `redirect_to root_path, alert:`（`app/controllers/battles_controller.rb:8-10`）と `status: :not_found`（`app/controllers/api/battle_rooms_controller.rb:34`）。

### 1.3 Feedback モデル・書き込み経路（#7 の成果物）

- `app/models/feedback.rb:3` — `belongs_to :user, optional: true`（ゲスト送信は `user_id` が nil）。
- `app/models/feedback.rb:11-16` — `enum :category`（`bug_report` / `feature_request` / `usage_question` / `other`）。DB 側は PG native enum。
- `app/models/feedback.rb:18-23` — `category`・`body` 必須、`subject`（100字）と `email` は任意。
- `db/schema.rb:41-50` — `feedbacks` は `body / category / created_at / email / subject / updated_at / user_id` と `index_feedbacks_on_user_id` のみ。**既読・対応済みに相当する列は無い。**
- `db/schema.rb:21` — `create_enum "feedback_category"`。`db/schema.rb:131` — `add_foreign_key "feedbacks", "users"`。
- `app/controllers/feedbacks_controller.rb:6-8` — 公開 POST なので `rate_limit to: 5, within: 1.minute`。`:13-16` — ハニーポット。`:20` — `user_id` は session からのみ決める。
- `config/routes.rb:22-24` — `get "feedback"` / `post "feedback"`。ゲストも送れるため `require_login` は付けない。
- **読み取り経路は存在しない**（`Feedback` を参照するのは `feedbacks_controller` と spec のみ）。issue の主張どおり `rails console` しか手段が無い。

### 1.4 View / レイアウトの流儀

- Tailwind v4（`@tailwindcss/vite`）+ インラインの 16 進カラー。デザインカンプ `docs/design/design.pen` 由来の色を直書きする流儀（`app/frontend/pages/Feedback.tsx:54-56` の `FIELD_LABEL` / `TEXT_INPUT` 定数など）。
- フォント指定は各ページ冒頭の `SERIF` / `SANS` / `MONO` 定数（`app/frontend/pages/History.tsx:9-10`）。
- 全ページ共通で `<Head title>` + `<Header user={auth?.user ?? null} />` + 背景画像（`app/frontend/pages/History.tsx:121-128`）。
- **一覧ページの手本は `app/frontend/pages/History.tsx` がそのまま使える**:
  - サーバは「新しい順・上限 N 件」だけ返す（`app/controllers/histories_controller.rb:5, 18-21`、`RECENT_LIMIT = 50`）。
  - 絞り込みタブは**クライアント側の `useState` フィルタ**（`app/frontend/pages/History.tsx:49-53, 114, 117-118, 193-212`）。
  - 打ち切り表示（`app/frontend/pages/History.tsx:119, 216-220`）と空状態（`:144-156`, `:234-239`）を持つ。
- ページのサブディレクトリは前例あり: `render inertia: "auth/Login"`（`app/controllers/sessions_controller.rb:9`）→ `app/frontend/pages/auth/Login.tsx`。**`admin/Feedbacks` という置き方は既存の流儀に乗る。**
- ヘッダーのメニュー項目は `MenuItem`（`app/frontend/components/layout/Header.tsx:46-88`）。`href` があれば Inertia `Link` を描く。フィードバックへの導線は既に両ドロップダウンにある（`:159-163`, `:322-327`）。

### 1.5 テスト規約

- `spec/rails_helper.rb:40` — FactoryBot の `create/build` を素で使える。`:44` — OmniAuth はテストモード。`:59` — トランザクショナルフィクスチャ。
- `spec/rails_helper.rb:27-28` — `spec/support/**` の自動 require は**コメントアウトされたまま**（support ディレクトリも無い）。共有ヘルパを足すならこの行を有効にするか、spec 内にローカル定義する。
- request spec のログインは各 spec ファイル内に `log_in` ヘルパをベタ書きし、OmniAuth モックでコールバックを叩く（`spec/requests/histories_spec.rb:4-12`、`spec/requests/feedbacks_spec.rb:7-14`）。
- 認可の負テストの型: `spec/requests/histories_spec.rb:15-18`（未ログイン → `/auth/login` へリダイレクト）、`spec/requests/api_battle_rooms_spec.rb:113-118`（他人の部屋 → 404）。
- Inertia のアサートは `expect_inertia.to render_component("History")` と `inertia.props[:...]`（`spec/requests/histories_spec.rb:25-32`）。props のキー**ホワイトリストそのもの**を検証する例もある（`:50-52`）。
- `config/environments/test.rb:26` — `show_exceptions = :rescuable`。**`ActionController::RoutingError` を raise すれば request spec で 404 レスポンスとして観測できる**（例外が spec に漏れない）。
- `config/environments/test.rb:52` — `raise_on_missing_callback_actions = true`。`before_action` に `only:` を書くならアクション名の綴りに注意。
- Vitest のコンポーネント spec は `render()` + `screen.getByText` で日本語の可視テキストを直接見る（`app/frontend/components/battle/BattleResult.spec.tsx:27-46`）。
- `spec/factories/feedbacks.rb` は 3 行のみ（`category` / `body` / `email`）。トレイトは無い。

### 1.6 秘密情報・運用

- 秘密情報は Rails credentials に集約し、`.kamal/secrets` が `credentials:fetch` で取り出して **ENV としてコンテナに注入**する（`.kamal/secrets:15-19`、`config/deploy.yml:26-33`）。アプリ側は `ENV["GOOGLE_CLIENT_ID"]` のように素の ENV を読む（`config/initializers/omniauth.rb:4-5`）。
- 開発・テストは `dotenv-rails` + `.env`（`Gemfile` の dev/test グループ）。`.gitignore:11` が `/.env*` を丸ごと無視するため `.env.example` はリポジトリに入っていない（README:20 の記述は既存の齟齬）。
- `config/initializers/filter_parameter_logging.rb:6-8` — **`:email` は既にログのフィルタ対象**。
- `docs/deployment.md` — VPS 1 台に Kamal で単一サーバ運用。バックアップは crontab、コンソールは `bin/kamal console`。**実質 1 人運用**であることが読み取れる。

### 1.7 ADR との突き合わせ

`docs/adr/0001`〜`0010` を通読した。**本計画と正面から衝突する ADR は無い**（0001-0003 は Svelte 時代のフロントテスト方針、0004-0008 はスコア・設定・バッジ、0009-0010 は対戦）。ただし次の 2 点は本計画の判断の根拠として引く:

- **ADR 0004 Consequences**「UI にない設定フィールドを DB スキーマへ先取りしない」→ 既読フラグ・ロール列を先取りしない根拠（§2.1 / §2.3）。
- **ADR 0007**「バッジは解除テーブルを持たず導出する」→ 「保存された状態」と「計算した状態」が食い違う経路を構造的に排除する、というこのリポジトリの一貫した志向。ただし**既読は導出不可能**なので 0007 をそのまま適用はできない（§2.3 で明示）。

CONTEXT.md には「フィードバック」の定義はあるが（`CONTEXT.md:87-89`）、**「管理者」は用語集に無い**。`docs/agents/domain.md` の指示どおり、これは「新語を持ち込んでいる」シグナルなので用語追加を計画に含める（§3.3）。

---

## 2. 要判断 3 点への推奨案

### 2.1 認可モデル — **推奨: ENV の管理者メール許可リスト（`User#admin?`）**

| 案                                                          | 内容                                                                                            | トレードオフ                                                                                                                                                                                                                                                                                                    |
| ----------------------------------------------------------- | ----------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **A. 許可リスト（推奨）**                                   | `ENV["ADMIN_EMAILS"]`（カンマ区切り）に載るメールでログイン中なら管理者。`User#admin?` 1 箇所で判定 | ＋ 既存の OAuth ログインをそのまま再利用でき、**新しい認証経路＝新しい攻撃面を作らない**。＋ 秘密情報の置き場も既存パターン（credentials → `.kamal/secrets` → ENV）に完全に乗る。＋ マイグレーション不要。− 管理者の付け外しにデプロイ（または ENV 更新 + 再起動）が要る。− OAuth プロバイダのメールに依存する（§6 参照） |
| B. `users` にロール列を追加                                 | `users.admin`（boolean）または `users.role`（enum）を追加                                       | ＋ 管理者の付け外しがデータ操作だけで済む。− だが**任命 UI が無い以上、実際の操作は `rails console` か dbconsole** になり、運用手順は A と変わらない。− マイグレーション + スキーマ変更 + factory 更新が要り、ADR 0004 の「UI にないフィールドを先取りしない」に反する                                          |
| C. HTTP Basic 認証                                          | `authenticate_or_request_with_http_basic` で `/admin` 配下を保護                                | ＋ 最速で、ログイン機構と完全に独立。− **資格情報の系統が 2 本になる**（OAuth セッション + Basic のパスワード）。ローテーション・共有・ブラウザ保存の管理が増える。− 「誰が見たか」が `current_user` と結びつかない。− `force_ssl`（`config/environments/production.rb:31`）前提とはいえ、平文 base64 を毎リクエスト送る |

**A を推奨する理由**: このアプリの運用者は実質 1 人（`docs/deployment.md` の VPS 1 台 + crontab バックアップ + `bin/kamal console` という運用像）で、管理者の集合はほぼ固定・ごく少数。その規模で B のスキーマ変更や C の第 2 認証系統を持ち込むのは、得られる柔軟性に対してコストが見合わない。A は**既存の資産（OAuth ログイン + credentials → ENV の注入経路）だけで完結**し、新規に増えるのはメソッド 1 本である。

実装は判定を 1 箇所に閉じ込め、**未設定なら誰も管理者にならない（フェイルクローズ）** を守る:

```ruby
# app/models/user.rb
# 管理者は ENV の許可リストで決める。users にロール列は持たない（#26 / ADR 00XX）。
# 未設定・空文字なら誰も管理者にならない（フェイルクローズ）。
def admin?
  email.present? && self.class.admin_emails.include?(email.downcase)
end

def self.admin_emails
  ENV["ADMIN_EMAILS"].to_s.split(",").filter_map { |e| e.strip.downcase.presence }
end
```

`filter_map { ... .presence }` により、`ADMIN_EMAILS=""` や `ADMIN_EMAILS=" , "` でも空配列になり、空メールが一致することはない。将来ロールが必要になったら `User#admin?` の中身だけを差し替えられる。

### 2.2 ページネーション・カテゴリ絞り込み — **推奨: 上限 N 件 + クライアント側カテゴリタブ（ページネーションは入れない）**

| 案                                                          | トレードオフ                                                                                                                                                                                       |
| ----------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A. 全件を素で返す                                           | ＋ 最も単純。− 件数が伸びたときに無防備（1 リクエストで全 PII を吐く）。打ち切りが無いのは将来の事故                                                                                                |
| **B. 上限 N 件 + クライアント側タブ（推奨）**               | ＋ **`HistoriesController` / `History.tsx` の既存パターンをそのまま写せる**（新しい設計判断がゼロ）。＋ 新 gem 不要、URL 設計不要、Inertia の部分再読み込み配線も不要。− N 件を超えた分は画面から見えない（打ち切り表示で明示する） |
| C. kaminari / pagy 導入 + サーバサイド絞り込み              | ＋ 件数が増えても破綻しない。− gem 追加 + URL / query param 設計 + Inertia の partial reload 配線 + それらのテスト。読む対象が数十件の段階では明確に過剰                                            |

**B を推奨する理由**: フィードバックは公開フォーム経由とはいえ、`rate_limit`（5 件/分）とハニーポットで守られた個人開発アプリへの投稿であり、流量は日に数件のオーダーが現実的。100 件を 1 画面で読むことに支障は無い。そして何より、**B は「新しい設計をしない」案**である ── `records` を新しい順に `limit` して返し、タブはフロントの `useState` で絞る形は `History.tsx` に完成品があり、レビューコストも学習コストもゼロ。C が必要になるのは「100 件を超えて古いものを追いたくなった」ときで、その時点で `RECENT_LIMIT` を引数化して移行すればよい。

ただし A の失敗（打ち切りが不可視）は必ず避ける。`totalCount` を props に載せ、`totalCount > feedbacks.length` のときに「最近 100 件を表示中（全 N 件）」を出す（`History.tsx:216-220` と同形）。

- 定数: `Admin::FeedbacksController::RECENT_LIMIT = 100`（History の 50 より大きくするのは、フィードバックにサマリー統計が無く 1 画面で読み切る用途だから）。
- カテゴリタブは `Feedback.categories.keys` をサーバから props で渡し、ラベルだけフロントで対応付ける（`AchievementsController` が `Badge::CATEGORIES` を渡すのと同じ考え方 ── 「フロントにハードコードしない」）。

### 2.3 既読 / 対応済みフラグ — **推奨: この issue では持たせない（マイグレーション無し）**

| 案                                        | トレードオフ                                                                                                                                                                                            |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **A. 持たせない（推奨）**                 | ＋ マイグレーション・更新アクション・CSRF 付き PATCH・その配線テストがまるごと不要で、issue のコア（「読む手段がゼロ」）だけを最短で解く。＋ 後付けが安い（後述）。− 「どこまで見たか」を人間が覚える必要がある |
| B. `feedbacks.handled_at`（datetime, nullable）+ トグル | ＋ 対応漏れが構造的に見える。− **読み取り専用ページに書き込み経路が生える**（PATCH + 認可 + CSRF + 楽観的更新）。実運用の捌き方が未確定のまま「対応済み」の意味を先に固定してしまう                       |
| C. ステータス enum（new / in_progress / resolved / wontfix） | ＋ 表現力は最大。− ワークフローを 1 件も捌く前に設計することになる。PG native enum の追加はマイグレーションも重い（既存 `feedback_category` と同じ形を新設）                                              |

**A を推奨する理由**: 3 つある。

1. **issue のコアは読み取り手段の不在**であり、一覧が新しい順で総件数付きなら、それだけで #7 が承知した「送信されても誰も見に行かず埋もれる」リスクは大幅に下がる。既読フラグはその上乗せであって前提ではない。
2. **ADR 0004 Consequences の「UI にない設定フィールドを DB スキーマへ先取りしない」と同じ理由**で、捌き方が 1 件も実運用されていない段階でワークフロー語彙（既読 / 対応中 / 解決）を DB に固定するのは早すぎる。実際に何件溜まり、どう捌くかを見てから決める方が安い。
3. **後付けコストが極めて低い**。`handled_at`（nullable datetime）を足す場合、既存行のバックフィルは不要（全件 NULL ＝「未対応」が正しい初期状態）。ADR 0005 がバックフィル案を却下した「過去データに欠損があるので移行できない」問題は、ここでは起きない。

なお **ADR 0007（バッジは導出）をそのまま持ち出すのは誤り**なので注意する。既読は `feedbacks` の既存列から導出できない純粋な状態であり、「必要になったら必ず保存が要る」。A は「導出で代替できる」という主張ではなく「今は不要」という主張である ── この違いは B へ移行する将来の判断者のために計画に残す。

暫定の運用: 一覧は新しい順で `created_at` を表示するので、「前回見た日時」を運用者が覚えていれば境界は目視で分かる。1 人運用ではこれで足りる。

---

## 3. 実装計画

### 3.1 ルーティング設計

```ruby
# config/routes.rb（feedback のルート定義の直後に置く）
  # 管理者用（#26）。許可リスト外・未ログインは 404 を返し、存在自体を伏せる。
  namespace :admin do
    resources :feedbacks, only: :index
  end
```

- URL: **`GET /admin/feedbacks`**（`admin_feedbacks_path`）。
- **名前空間は `admin` にする。** 理由: ①`Admin::BaseController` という認可の単一関門を作れ、将来の管理画面が増えても `before_action` の付け忘れが起きない ②URL を見るだけで公開面と管理面の境界が分かる ③Inertia のページも `pages/admin/` に分離でき、`pages/auth/Login.tsx` という既存の前例に一致する。
- `resources ... only: :index` を使うのは、将来 `show` を足すときに素直に伸びるため。ただし**今回 `show` は作らない**（一覧に全文が出るので不要）。

### 3.2 追加・変更するファイル

| ファイル                                        | 種別 | 内容                                                                                                                                                                                                                                                          |
| ----------------------------------------------- | ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `app/models/user.rb`                            | 変更 | `#admin?` と `.admin_emails` を追加（§2.1 のコード）。既存メソッドには触らない                                                                                                                                                                              |
| `app/controllers/admin/base_controller.rb`      | 新規 | `ApplicationController` を継承し `before_action :require_admin`。`require_admin` は `current_user&.admin?` でなければ `raise ActionController::RoutingError, "Not Found"`。**未ログインと非管理者を区別せず同じ 404** にする                                  |
| `app/controllers/admin/feedbacks_controller.rb` | 新規 | `Admin::BaseController` を継承。`RECENT_LIMIT = 100`。`Feedback.includes(:user).order(created_at: :desc).limit(RECENT_LIMIT)` を props 化。`totalCount` / `recentLimit` / `categories` も渡す                                                                |
| `config/routes.rb`                              | 変更 | §3.1 の `namespace :admin`                                                                                                                                                                                                                                    |
| `app/frontend/pages/admin/Feedbacks.tsx`        | 新規 | 一覧ページ。`History.tsx` の構造（Head + Header + ヒーロー + タブ + テーブル + 空状態 + 打ち切り表示）を踏襲                                                                                                                                                  |
| `spec/models/user_spec.rb`                      | 変更 | `describe "#admin?"` を追加                                                                                                                                                                                                                                   |
| `spec/requests/admin/feedbacks_spec.rb`         | 新規 | 認可の正/負 + props の内容（§5）                                                                                                                                                                                                                              |
| `spec/factories/feedbacks.rb`                   | 変更 | `trait :from_guest` / `trait :with_email` / `trait :with_subject` を追加（既存の 3 行は壊さない）                                                                                                                                                              |
| `app/frontend/pages/admin/Feedbacks.spec.tsx`   | 新規 | Vitest のコンポーネント spec（§5）                                                                                                                                                                                                                            |
| `.kamal/secrets`                                | 変更 | `ADMIN_EMAILS=$(bin/rails credentials:fetch admin.emails)` を追記（既存 OAuth 行と同形）                                                                                                                                                                      |
| `config/deploy.yml`                             | 変更 | `env.secret` に `ADMIN_EMAILS` を追記                                                                                                                                                                                                                         |
| `docs/deployment.md`                            | 変更 | 「4. シークレットの設定」に `admin.emails` の項を追記                                                                                                                                                                                                         |
| `README.md`                                     | 変更 | 開発時は `.env` に `ADMIN_EMAILS=you@example.com` を書く旨を追記                                                                                                                                                                                              |
| `CONTEXT.md`                                    | 変更 | 「フィードバック」節に**「管理者」**の定義を追加（§3.3）                                                                                                                                                                                                      |
| `docs/adr/0011-admin-by-email-allowlist.md`     | 新規 | 認可モデルの決定を ADR 化（§3.4）                                                                                                                                                                                                                             |

**マイグレーションは不要**（§2.3 で既読フラグを見送り、§2.1 でロール列を見送ったため）。`db/schema.rb` は一切変更されない。

### 3.3 CONTEXT.md への用語追加（案）

`CONTEXT.md` の「フィードバック」の直後に置く:

```markdown
**管理者**:
送られたフィードバックを閲覧できる運営者。ログイン済みユーザーのうち、サーバ側の許可リスト（`ADMIN_EMAILS`）にメールアドレスが載っている者だけを指す。プレイヤー向けの機能差は無く、アプリ内に管理者を任命する画面も無い。
_Avoid_: 運営者（アプリ内の役割としては「管理者」）、admin ユーザー、ロール
```

`docs/agents/domain.md` の「用語集に無い概念を output で名指しするのはシグナル」に従い、実装と同じ PR で用語を確定させる。

### 3.4 ADR 0011（案の骨子）

タイトル: **管理者はメール許可リストで決め、`users` にロール列を持たない**

- 決定: `ENV["ADMIN_EMAILS"]` に載るメールでログイン中のユーザーのみを管理者とする。判定は `User#admin?` の 1 箇所。認可は `Admin::BaseController` の `before_action` に一元化し、非管理者には 404 を返す。
- 理由: 実質 1 人運用の規模で、既存 OAuth ログインと credentials → ENV の注入経路だけで完結する最小の案だから。
- Considered Options: `users` のロール列（任命 UI が無く運用は console 頼りのまま、スキーマだけ増える）／ HTTP Basic 認証（資格情報の系統が 2 本になる）。
- Consequences: 管理者の付け外しは ENV 更新 + 再起動（`bin/kamal deploy`）が要る／OAuth プロバイダの検証済みメールを信頼の根拠にする（§6）／`ADMIN_EMAILS` 未設定なら誰も管理者にならない（フェイルクローズ）／将来ロールが要るなら `User#admin?` の中身だけ差し替える。

### 3.5 コントローラの形（案）

```ruby
# app/controllers/admin/base_controller.rb
module Admin
  # 管理者専用画面の共通基底。認可はここに一元化し、配下のコントローラは
  # before_action の付け忘れが構造的に起きないようにする（#26 / ADR 00XX）。
  class BaseController < ApplicationController
    before_action :require_admin

    private

    # 未ログインと「ログイン済みだが管理者でない」を区別せず 404 にする。
    # ページの存在自体を伏せるため、require_login のようなログイン画面への
    # リダイレクトはしない。
    def require_admin
      raise ActionController::RoutingError, "Not Found" unless current_user&.admin?
    end
  end
end
```

```ruby
# app/controllers/admin/feedbacks_controller.rb
module Admin
  class FeedbacksController < BaseController
    # 一覧は新しい順の直近 N 件のみ。総件数は全件から数え、打ち切りを画面に出す（#26）
    RECENT_LIMIT = 100

    def index
      feedbacks = Feedback.includes(:user).order(created_at: :desc).limit(RECENT_LIMIT)

      render inertia: "admin/Feedbacks", props: {
        feedbacks: feedbacks.map { |f| serialize(f) },
        totalCount: Feedback.count,
        recentLimit: RECENT_LIMIT,
        # タブはモデルの enum から描く（フロントにハードコードしない）
        categories: Feedback.categories.keys
      }
    end

    private

    # 返信先はフォームの email 欄が正（CONTEXT.md「フィードバック」）。
    # アカウントのメールアドレスは返信先ではないので props に載せない。
    def serialize(feedback)
      {
        id: feedback.id,
        category: feedback.category,
        subject: feedback.subject,
        body: feedback.body,
        email: feedback.email,
        createdAt: feedback.created_at,
        user: feedback.user && { id: feedback.user.id, nickname: feedback.user.nickname }
      }
    end
  end
end
```

`includes(:user)` で N+1 を潰す。`Feedback.count` は別クエリだが 1 本で済む。

### 3.6 ページの形（`app/frontend/pages/admin/Feedbacks.tsx`）

`History.tsx` の骨格を写し、以下を持たせる:

- `<Head title="フィードバック一覧 - 上毛かるたタイピング" />` + `<Header user={auth?.user ?? null} />`。
- ヒーロー（`MessageSquareHeart` アイコン + 「フィードバック一覧」）。
- カテゴリタブ: `'all'` + `categories` を `useState<string>` で切り替え、`feedbacks.filter(...)`。ラベルは `Feedback.tsx:28-33` の `CATEGORIES` と**同じ日本語**（バグ報告 / 機能リクエスト / 使い方の質問 / その他）にする。各タブに件数を添えると 1 人運用で有用。
- テーブル列: 日時 / 種類 / 件名・本文 / 送信者 / 返信先。
  - 日時は `History.tsx:55-63` の `formatDate` と同じ `toLocaleString('ja-JP', ...)`。
  - 本文は `<p className="whitespace-pre-wrap break-words">{f.body}</p>`。**`dangerouslySetInnerHTML` は絶対に使わない**（§6）。
  - 送信者は `f.user ? (f.user.nickname || `ユーザー #${f.user.id}`) : 'ゲスト'`。CONTEXT.md の語（「ゲスト」）をそのまま使う。
  - 返信先は `f.email || '—'`。`mailto:` リンクにするかは任意（付けるなら `rel="noreferrer"` は不要だが、`<a href={`mailto:${f.email}`}>`）。
- 空状態（`totalCount === 0`）と、タブで 0 件になったときの `colSpan` 行（`History.tsx:234-239` と同形）。
- 打ち切り表示（`totalCount > feedbacks.length` のとき「最近 {recentLimit} 件を表示中（全 {totalCount} 件）」）。

---

## 4. コミット分割案

コミットメッセージはリポジトリの流儀（日本語・終止形「〜する」。`git log` 参照）に合わせる。各コミットは単体で CI（rubocop / brakeman / rspec / bun run lint,check,test）が緑になる粒度にする。

| #     | コミットメッセージ                                       | 内容                                                                                                          | 何が緑になるか                                                                                       |
| ----- | -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| 1     | `管理者の判定を User#admin? に追加する`                  | `app/models/user.rb` に `#admin?` / `.admin_emails`。`spec/models/user_spec.rb` に許可リストの正・負・フェイルクローズのテスト | `bundle exec rspec spec/models/user_spec.rb` + rubocop。**この時点でまだ画面は無く、挙動は何も変わらない**  |
| 2     | `管理者用フィードバック一覧のルーティングとコントローラを追加する` | `Admin::BaseController` / `Admin::FeedbacksController` / `config/routes.rb` / `spec/requests/admin/feedbacks_spec.rb` / factory トレイト。ページは最小の TSX（テーブルのみ、装飾なし）を同時に置く | `bundle exec rspec`（認可の正/負 + props 形状）。ページが最小でも Inertia の request spec は通り、ブラウザでも一応読める |
| 3     | `管理者用フィードバック一覧の画面を整える`               | `pages/admin/Feedbacks.tsx` を本実装（ヒーロー・カテゴリタブ・空状態・打ち切り表示・日時整形）+ `Feedbacks.spec.tsx` | `bun run lint` / `bun run check` / `bun run test`。バックエンドは無変更なので rspec も据え置きで緑     |
| 4     | `管理者メールの設定手順をデプロイ手順に追記する`         | `.kamal/secrets` / `config/deploy.yml` / `docs/deployment.md` / `README.md`                                    | CI は無変更で緑（設定とドキュメントのみ）。**本番で 404 のままにしないための必須コミット**             |
| 5     | `管理者の定義を CONTEXT.md に追加する`                   | `CONTEXT.md` の用語追加 + `docs/adr/0011-admin-by-email-allowlist.md`                                          | CI は無変更で緑                                                                                        |
| 6（任意） | `ヘッダーに管理者向けの導線を追加する`                   | `inertia_share` の `auth.user` に `admin` を足し、`UserDropdown` に「フィードバック一覧」を管理者だけ表示      | rspec（shared props のテスト）+ bun run test。**先送り可**（§7）                                       |

コミット 1 と 2 を分ける意図は、**認可の判定ロジックだけを単独でレビュー・テストできる状態にする**こと。認可は後戻りが最も高くつくので、画面の差分に埋もれさせない。

---

## 5. テスト計画

前提として、**このリポジトリに system spec（Capybara）は存在しない**（§1.1）。issue の依頼にある「system spec」の役割は、Vitest のコンポーネント spec（`app/frontend/pages/admin/Feedbacks.spec.tsx`）が担う。新しくテスト基盤（Capybara + driver + CI ジョブ）を持ち込むのはこの issue のスコープを超えるので行わない（§7）。

### 5.1 model spec — `spec/models/user_spec.rb`（追記）

`ENV["ADMIN_EMAILS"]` は `around` フックで退避・復元する（`spec/support/` の自動 require は無効なので、ヘルパはこの spec 内にローカル定義するか、`rails_helper.rb:27` を有効化して共有ヘルパに切り出す）。

- 許可リストに載るメールのユーザーは `admin?` が true
- 載っていないユーザーは false
- **`ADMIN_EMAILS` 未設定なら、どのユーザーも false**（フェイルクローズ。最重要）
- **`ADMIN_EMAILS=""` / `" , "` でも false**（空文字が一致しない）
- 大文字小文字を無視して一致する（`Admin@Example.com` ↔ `admin@example.com`）
- カンマ区切りで複数指定でき、各要素の前後空白が無視される

### 5.2 request spec — `spec/requests/admin/feedbacks_spec.rb`（新規）

ログインは `spec/requests/feedbacks_spec.rb:7-14` の `log_in_via_google` を写す（email を引数で変えられる形）。

**認可の負テスト（必須）**

- 未ログインで `GET /admin/feedbacks` → **404**（`have_http_status(:not_found)`）。`/auth/login` へリダイレクト**しない**こと（ページの存在を伏せる設計の回帰テスト）も明示的にアサートする
- ログイン済みだが許可リスト外のユーザー → **404**
- **`ADMIN_EMAILS` 未設定のとき、管理者候補のメールでログインしていても 404**（フェイルクローズの回帰テスト）
- 許可リストに他人のメールだけが載っている状態で、自分のメールでログイン → 404

**認可の正テスト**

- 許可リストのメールでログイン → 200、`expect_inertia.to render_component("admin/Feedbacks")`

**props の内容**

- `feedbacks` が **`created_at` の降順**（新しい順）で並ぶ
- 各行のキーが `id / category / subject / body / email / createdAt / user` の**ホワイトリストに一致する**（`spec/requests/histories_spec.rb:50-52` と同じ形。将来うっかり `user.email` 等を足したら落ちる）
- ゲスト送信は `user` が `nil`、ログインユーザー送信は `user` が `{ id, nickname }` のみ（**`email` を含まない**こと）
- `totalCount` が全件数、`feedbacks.size` が `RECENT_LIMIT` で頭打ち、`recentLimit` が定数と一致（`spec/requests/histories_spec.rb:65-78` と同形）
- `categories` が `Feedback.categories.keys` と一致
- **他ユーザーのフィードバックも含まれる**（`histories_spec.rb:55-63` の「他人の記録を除外する」とは逆向きの契約。管理者は全件見えるのが正しい、を明文化する）

**N+1 の防止**（任意だが推奨）

- `includes(:user)` が効いていることを、複数ユーザー分を作って `ActiveRecord::Base.connection` のクエリ数で見るか、少なくとも「ユーザー付きフィードバック複数件でも props が正しい」ケースで担保する

### 5.3 component spec — `app/frontend/pages/admin/Feedbacks.spec.tsx`（新規）

`BattleResult.spec.tsx` と同じく `render()` + `screen.getByText`（日本語の可視テキスト）で見る。`usePage` を使う `Header` を含むため、`vi.mock('@inertiajs/react', ...)` で `usePage` / `Head` / `Link` をスタブするか、`Header` 自体をスタブする（ADR 0002 の「装飾リーフは `__testmocks__` のスタブで越える」の精神に従い、後者が軽い）。

- 1 件のフィードバックの `category` ラベル（例「バグ報告」）・`body`・`email`・日時が表示される
- ゲスト送信の行に「ゲスト」、ユーザー送信の行にニックネームが出る
- カテゴリタブを押すとそのカテゴリの行だけが残る（他カテゴリの本文が消える）
- 0 件のとき空状態メッセージが出る
- タブで 0 件になったときのメッセージが出る
- `totalCount > feedbacks.length` のとき打ち切り表示が出て、等しいときは出ない
- **本文の改行が保持され、HTML タグを含む本文がそのままテキストとして表示される**（`<script>` が要素として現れないこと。§6 の XSS 回帰テスト）

### 5.4 実行コマンド

```sh
bundle exec rspec                  # backend
bin/rubocop                        # lint（omakase）
bin/brakeman --no-pager            # セキュリティ静的解析
bun run lint && bun run check && bun run test   # frontend
```

CI（`.github/workflows/ci.yml`）は request spec がレイアウト経由で Vite マニフェストを参照するため `bin/vite build` を事前に走らせている。ローカルで request spec が落ちる場合はこれを疑う。

---

## 6. セキュリティ上の注意点

### 6.1 フィードバック本文の XSS

- 本文・件名・メールは**匿名の誰でも投稿できる自由入力**であり、管理者が特権セッションで閲覧する。ここは典型的な stored XSS の的になる。
- React は JSX 内の文字列を自動エスケープするので、**`dangerouslySetInnerHTML` を使わない限り安全**。改行の保持は `white-space: pre-wrap`（Tailwind の `whitespace-pre-wrap`）で行い、`<br>` への置換や `innerHTML` は禁止。§5.3 に回帰テストを置く。
- Inertia の初期 props は `use_script_element_for_initial_page = true`（`config/initializers/inertia_rails.rb:7`）により `<script type="application/json">` に入る。この形式は `</script>` 等をエスケープするので `data-page` 属性方式より安全側だが、**props に生 HTML を組み立てて入れない**ことは前提として守る。
- `mailto:` リンクを作る場合、`email` はモデルで `URI::MailTo::EMAIL_REGEXP` により検証済み（`app/models/feedback.rb:23`）なので `javascript:` 等は入らない。ただし `email` が空のときにリンクを描かないことは確認する。
- CSP は現状すべてコメントアウト（`config/initializers/content_security_policy.rb`）。本 issue で有効化するのはスコープ外だが、「有効化されていない」事実は認識しておく（§8）。

### 6.2 PII の扱い

- このページは **`feedbacks.email`（返信先メール）と本文という PII の集約点**になる。設計上、露出を最小にする:
  - **アカウントのメールアドレスは props に載せない**（§3.5 の `serialize`）。返信先は CONTEXT.md 上も「返信先メールアドレス」＝フォームの `email` 欄が正であり、アカウントのメールへ勝手に返信するのはユーザーの期待に反する。送信者の識別は `id` + `nickname` で足りる。
  - request spec で props のキーをホワイトリスト検証し、将来の追加を機械的に止める（§5.2）。
- **メールアドレスを URL に載せない**。検索・絞り込みを query param で実装すると、リバースプロキシ（kamal-proxy）や Rails のリクエストログにメールが残る。カテゴリ絞り込みをクライアント側にする案（§2.2）は、この点でも都合が良い。
- `config/initializers/filter_parameter_logging.rb:6-8` は `:email` を既にフィルタ対象にしているが、**これは params のフィルタであってレスポンスボディや `Rails.logger.info` の引数には効かない**。実装中のデバッグログを残さないこと（`Rails.logger.info feedback.body` の類は禁止）。
- 本番のログレベルは `info`（`config/environments/production.rb:41`）。Inertia のレスポンスボディはログに出ないので、通常運用でメール・本文がログに落ちる経路は無い。
- ブラウザキャッシュ: 管理ページのレスポンスに `Cache-Control: no-store` を付けることを検討してもよいが、Rails のデフォルトで `no-store` 相当（`no-cache`）になるため今回は追加しない。

### 6.3 認可バイパス経路

- **`Admin::BaseController` を経由しない管理者アクションを作らない。** `namespace :admin` 配下のコントローラは必ず `Admin::BaseController` を継承する。将来 API を足すときも同様（`Api::` 側に管理者エンドポイントを作らない）。
- **フェイルクローズ**: `ADMIN_EMAILS` が未設定・空・空白のみのとき、誰も管理者にならないこと。`ENV["ADMIN_EMAILS"].to_s.split(",")` の結果に空文字が残ると `"".include?` 相当の事故になり得るため `.presence` で落とす（§2.1）。テストで固定する（§5.1）。
- **メール一致は正規化して比較**（両辺 `downcase` + `strip`）。逆に、部分一致（`include?` を文字列に対して使う等）は絶対にしない ── `ADMIN_EMAILS=admin@example.com` に対し `evil-admin@example.com` が通ってしまう。配列の `include?` であることを明示的に読める形にする。
- **管理者フラグをクライアント入力から決めない。** `params` にも `session` にも管理者フラグを置かず、常に `current_user` から `admin?` を計算する（`FeedbacksController:20` の「user_id はサーバの session からのみ決める」と同じ原則）。
- **`User.from_omniauth` のメール一致経路への依存**（`app/models/user.rb:49`）: 既存ユーザーとメールが一致する OAuth ログインは、プロバイダを問わず同じ `User` に紐づく。つまり管理者メールの**セキュリティは「Google と GitHub の両方で、そのメールを他人が検証済みにできない」ことに依存する**。運用上は ①管理者メールに 2 要素認証を必ず設定する ②可能ならそのメールで GitHub アカウントも押さえておく、を `docs/deployment.md` に注記する。この依存関係は ADR 0011 の Consequences にも書く。
- **未ログイン / 非管理者に 404 を返す**（403 やログイン画面リダイレクトではなく）。`/admin/feedbacks` の存在自体を伏せることで、URL 総当たりに対する情報漏れを減らす。`require_login`（`ApplicationController:27-29`）のリダイレクト慣習からは**意図的に外れる**判断であり、その旨をコードコメントに残す（後続の実装者が「他と揃える」つもりで redirect に戻すのを防ぐ）。
- CSRF: 今回は GET のみで状態変更が無いため追加の手当ては不要。ただし §2.3-B（既読フラグ）を将来入れる際は、必ず PATCH/POST + CSRF 検証（`ApplicationController:37-39` の既存機構）に乗せること。
- `robots.txt` への `Disallow: /admin` 追記は**しない**。認証で 404 になるので保護の必要が無く、追記はむしろパスを公開する。

### 6.4 その他

- brakeman が CI で走る（`.github/workflows/ci.yml`）。`raise ActionController::RoutingError` や `includes` 使用で警告は出ない見込みだが、警告が出たら握り潰さず対処する。
- `rate_limit` は管理ページには付けない（認証済みかつ単一利用者で、キャッシュストア依存 ── 本番は `config.cache_store` がコメントアウトのままでプロセスローカル ── を増やす意味が無い）。

---

## 7. スコープ外

この issue では**やらない**こと。必要になったら別 issue を立てる。

- **既読 / 対応済みフラグとそのマイグレーション**（§2.3-A の判断）。`feedbacks` テーブルは無変更。
- **サーバサイドページネーション・全文検索・メールでの絞り込み**（§2.2-B の判断）。`RECENT_LIMIT` を超える古いフィードバックは当面 `rails console` / `bin/kamal dbc` で見る。
- **フィードバックの削除・編集・返信送信**。読み取り専用ページに限定し、書き込み経路を一切生やさない。
- **管理者の任命 UI / ロール管理画面**。`ADMIN_EMAILS` の更新はデプロイ操作で行う。
- **`users` へのロール列追加**（§2.1-B の却下）。
- **通知（新着フィードバックのメール / Slack 通知）**。#7 が承知した「埋もれるリスク」に対するもう一段の手当てだが、閲覧手段の新設とは別の問題。
- **Capybara / system spec 基盤の導入**。テストは既存構成（RSpec request/model + Vitest）で完結させる。
- **CSP の有効化**（`config/initializers/content_security_policy.rb` は全コメントアウトのまま）。アプリ全体に影響する変更で、この issue で扱う範囲を超える。
- **`/admin` 配下の他の管理画面**（ユーザー一覧、スコア管理など）。`Admin::BaseController` という受け皿だけ用意し、中身は作らない。
- **コミット 6（ヘッダーの管理者導線）は任意**。`inertia_share` に `admin` フラグを足すと全ページのレスポンスに乗るため、URL 直打ちで足りるなら見送ってよい。

---

## 8. 未解決の疑問（人間に確認したいこと）

1. **管理者にするメールアドレスは何か。** `ADMIN_EMAILS` に入れる実際の値と、複数人にするかどうか。またそのアドレスで Google / GitHub の両方を押さえられているか（§6.3 の依存関係）。
2. **`ADMIN_EMAILS` の格納先の確認。** 本計画は既存の OAuth クレデンシャルと同じ「Rails credentials（`admin.emails`）→ `.kamal/secrets` → ENV」に乗せる前提だが、秘密というほどでもないので `config/deploy.yml` の `env.clear` に平文で置く選択肢もある。どちらを好むか（`clear` に置くとリポジトリにメールアドレスが平文で残る点が判断材料）。
3. **`RECENT_LIMIT = 100` は妥当か。** 現在 DB に何件のフィードバックが溜まっているかで適正値が変わる。本番で `Feedback.count` を確認したい。
4. **未ログイン時に 404 を返す方針で良いか。** 既存の `require_login` はログイン画面へリダイレクトしており、そこから意図的に外れる（§6.3）。「管理者でログインし直したいのに 404 で気づけない」という運用上の不便と、ページの存在を伏せる利益のどちらを取るか。
5. **送信者の表示にアカウントのメールアドレスを含めなくて良いか。** 本計画は「返信先は `email` 欄が正」として `nickname` + `id` のみにしたが（§3.5）、ログインユーザーからのフィードバックで `email` 欄が空のときに連絡手段が無くなる。運用上それで困らないか。
6. **CONTEXT.md の「管理者」の定義文と ADR 0011 の起票**を、この PR に含めてよいか（別 PR に分けたい意向があれば分割する）。
7. **ヘッダーへの導線（コミット 6）を入れるか。** 入れる場合、`inertia_share` の `auth.user` に `admin: true/false` を足すことになる（全ページのレスポンスに 1 フィールド増える）。
