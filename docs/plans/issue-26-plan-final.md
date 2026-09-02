# issue #26 統合実装計画（最終版）

対象 issue: [#26 管理者用フィードバック閲覧ページを作る](https://github.com/e601201/jomo-karuta-typing-rails-app/issues/26)（label: `enhancement` / コメント 0 件）
先行 issue: [#7](https://github.com/e601201/jomo-karuta-typing-rails-app/issues/7)（書き込み側。保存のみ・通知なしで決着）

入力: 計画 3 本（`docs/plans/issue-26-plan-{opus,gpt,grok}.md`）とクロスレビュー 3 本（`docs/reviews/issue-26-review-{opus,gpt,grok}.md`）。

**レビューのラベル対応（本文から確認済み）**: レビュー opus（冒頭の表）とレビュー gpt（冒頭の箇条書き）はいずれも **案 A = 計画 opus / 案 B = 計画 gpt / 案 C = 計画 grok**。レビュー grok はラベルを使わず「計画 opus / gpt / grok」と直接呼ぶ。3 レビューで A/B/C の割り当てに食い違いは無い。

本書は統合計画のみで、コード実装は含まない。以下の「確認済み」表記は、すべて本ブランチ（`cursor/issue-26-multi-model-planning-9701`）の実ファイル、`gh issue view 26` の原文、および固定バージョンの gem / Rails の upstream ソースに突き合わせた結果である。この環境に Ruby 処理系が無いため spec の実行はしておらず、実行が必要な検証は §3.7 に「裏が取れなかったもの」として分離した。

---

## 1. サマリ

**本書は確定版であり、そのまま実装に着手できる。** 2026-09-02 にリポジトリオーナーから設計上の未確認事項 3 点（管理者のログインプロバイダ / アドレスの種別 / 未ログイン時のレスポンス）すべてに回答があり、いずれも本計画の前提どおりで承認された（§9.1）。設計判断の変更は無く、残るのはデプロイ時の設定作業（`ADMIN_EMAILS` に入れる実際のアドレス）だけである。

`GET /admin/feedbacks` に、保存済みフィードバックを新しい順に読むための Inertia + React ページを新設する。書き込み側（`/feedback`）と `feedbacks` テーブルは一切変更しない。**マイグレーションは不要。**

要判断 3 点の最終決定:

- **認可モデル**: 既存 OAuth ログインに乗せ、**「サーバ側のメール許可リスト（ENV `ADMIN_EMAILS`）に載っている」かつ「今回のログインが `google_oauth2` である」**の両方を満たすユーザーだけを管理者とする。後者は `SessionsController#create` でログイン時のプロバイダをセッションに記録して判定する。`users` へのロール列追加と HTTP Basic 認証はいずれも却下。未ログイン・非管理者はどちらも `head :not_found`。管理者アドレスは Gmail であることがオーナー回答で確定しているため、`(provider, uid)` によるピン留めは採らない（§2.2）。
- **ページネーション・カテゴリ絞り込み**: **1 ページ 50 件の offset ページネーションを入れる**（`?page=`、`created_at DESC, id DESC`）。「上限 N 件だけ返す」方式は、issue の目的（console 以外に読む手段が無い状態の解消）を古い行について解消しないため却下。カテゴリ絞り込みは今回入れない（クライアント側絞り込みは「ページ内だけ」に効くので誤解を招く。必要になったらサーバ側 `?category=` として別 issue）。
- **既読 / 対応済みフラグ**: **持たせない。** ただし 3 計画が却下根拠に使った ADR の引用は誤用なので、根拠を差し替えたうえで同じ結論を出す（§2.6）。

---

## 2. 決定事項と根拠

### 2.1 争点 1 — ベースにする案

**決定: 計画 opus をベースにする。ただし争点 4（ページネーション）だけは計画 gpt を採る。**

多数決（レビュー opus・レビュー grok が計画 opus を 1 位、レビュー gpt が計画 gpt を 1 位）に従っただけではない。計画 opus を骨格に採る理由は、自分で確認できた次の 3 点である。

1. **フェイルクローズの詰め方が唯一具体的。** `ENV["ADMIN_EMAILS"].to_s.split(",").filter_map { |e| e.strip.downcase.presence }` は、未設定・空文字・`" , "` のいずれでも空配列になり、配列の `include?` なので部分一致もしない。他 2 計画は方針だけで、空文字要素の罠に触れていない。
2. **コミット分割が各時点で緑かつ認可の無いページを露出しない。** 計画 gpt のコミット 1 は routes と `Admin::BaseController` だけで `Admin::FeedbacksController` を後回しにするため、`namespace :admin { resources :feedbacks, only: :index }` が未定義定数を参照する。この状態では「管理者は 200」を書けず、「非管理者は 404」は**コントローラが無いことによる 404** でも通ってしまう偽の緑になる（3 レビューとも同じ指摘。計画の記述だけから確定できる欠陥）。
3. **既存流儀への追従度。** `render inertia: "auth/Login"`（`app/controllers/sessions_controller.rb:9`）という既存のサブディレクトリ前例があり、`pages/admin/Feedbacks.tsx` はそのまま乗る。props ホワイトリストを request spec で固定する型（`spec/requests/histories_spec.rb:50-52`）、`RECENT_LIMIT` + `totalCount` の props 設計（`app/controllers/histories_controller.rb:5, 18-21`）も既存にある。

**計画 gpt の長所は本物で、ページネーションについては gpt を採る**（§2.4）。計画 gpt が単独で正しかった点は他にもあり、いずれも取り込む: `Cache-Control: no-store`（§2.5）、決定的ソート `created_at DESC, id DESC`、Inertia partial request でも `before_action` が先に走ることの request spec、プロバイダの検証済みメール契約の確認（§2.2 で裏取りした）。

**計画 grok から取り込むもの**: `encrypt_history = true` を外さない旨の明記（`config/initializers/inertia_rails.rb:5` に実在。3 計画で grok だけが指摘）、未知 `category` 値を生表示せず「不明」にする、開発時の確認手順（`.env` に自分のアドレスを入れて直打ち）、実装チェックリスト形式。

**明示的に却下するもの**:

| 却下 | 出典 | 理由 |
| --- | --- | --- |
| Capybara / Selenium の新規導入と `spec/system/` | 計画 gpt | `Gemfile` に capybara / selenium が無く `spec/` は `channels / factories / models / requests` のみ（確認済み）。1 画面のためにテスト基盤・CI のブラウザ保守を増やす。目的（危険な文字列がテキストとして描画されることの確認）は Vitest のページ spec で足りる。§8 で別 issue に切り出す |
| credentials の直読み（`Rails.application.credentials.dig(:admin, :emails)`） | 計画 gpt | §2.3 |
| `sender: { id, nickname, email }`（アカウントのメールを props に載せる） | 計画 grok | `CONTEXT.md:87-89` は返信先を「任意」と定義しており、フォームの `email` 欄を空にしたのは送信者の選択。アカウントのメールを出すのはその選択の迂回。しかも計画 grok はこのキー集合を spec の契約として固定するので後から直す圧力が下がる |
| `has_many :feedbacks, dependent: :nullify` を本 issue に含める | 計画 grok | `includes(:user)` は `Feedback#belongs_to :user`（`app/models/feedback.rb:3`）だけで成立し、`User#has_many :feedbacks` は不要（因果が誤り）。さらに `app/controllers` / `app/models` に user を destroy する経路は存在しない（確認済み）。FK 制約自体の問題は本物なので §8 で別 issue |
| 未ログイン時の 302 リダイレクト | 計画 grok | §2.2 |
| `inertia_share` の `auth.user` に `admin` フラグを足すヘッダー導線（計画 opus のコミット 6） | 計画 opus | 全ページのレスポンスに認可情報が乗り、「フラグを消せば認可も消える」誤解を招く。URL 直打ちで足りる |
| クライアント側カテゴリタブ | 計画 opus / grok | ページネーションを入れる決定と両立しない（§2.4） |

### 2.2 争点 2 — 認可モデル（最重要）

#### 確定させた技術的事実

`app/models/user.rb:42-57` の `User.from_omniauth` は次の順で解決する。

```
(a) Identity.find_by(provider:, uid:) が見つかれば identity.user を返す   … user.rb:43-44
(b) find_by(email: auth.info.email) が見つかれば、その User に
    新しい Identity を作って返す                                          … user.rb:49, 55
(c) いずれも無ければ User + Identity を新規作成                            … user.rb:50-55
```

`Identity` は `provider` / `uid` / `user_id` のみを持ち（`app/models/identity.rb`、`db/schema.rb:67-75`、`(provider, uid)` に unique index）、**セッションに残るのは `session[:user_id]` だけ**（`app/controllers/sessions_controller.rb:15-17`）。つまり「今回どの Identity でログインしたか」はサーバ側に残っていない。

`config/initializers/omniauth.rb:4-5` は Google（`omniauth-google-oauth2` 1.2.2）と GitHub（`omniauth-github` 2.0.1、`scope: "user:email"`）。upstream ソースで確認した:

- google_oauth2 1.2.2 の `info.email` は `verified_email`（`raw_info['email_verified'] ? raw_info['email'] : nil`）。未検証なら `info.email` が nil になり、このアプリでは `User::EmailUnavailableError`（`app/models/user.rb:47`）になる。
- omniauth-github 2.0.1 は `user:email` scope のとき `primary_email` = `emails.find { |i| i['primary'] && i['verified'] }` を使う。

→ **レビュー grok が挙げた「プロバイダの verified メールを見ていない」という課題は、固定中の gem バージョンでは strategy 側で既に閉じている。** ただしこれはアプリの不変条件ではなく gem 実装への依存なので、ADR の Consequences に「この 2 つの strategy が検証済みメールしか `info.email` に入れないことに依存している」と明記する。

#### 3 レビューの処方箋の判定

| 処方箋 | 出典 | 判定 |
| --- | --- | --- |
| メールではなく `(provider, uid)` の組を許可リストにする | レビュー gpt | **技術的には正しく、実装可能。** ただし「今回ログインした Identity」をセッションに残す変更が前提になる（現状は残っていない）。3 計画いずれもこの変更を含んでいない。**採用はしない** — Gmail 確定によりメール許可リスト + プロバイダ固定との強度差が無くなるため（後述） |
| メール許可リスト + `current_user.identities.exists?(provider: "google_oauth2")` を 1 行足す | レビュー opus | **穴を塞げない。** 経路 (b) は新しい Identity を**同じ User** に紐付ける（`user.rb:55`）。管理者の User には既に Google の Identity があるので、攻撃者が GitHub でログインして合流しても `identities.exists?(provider: "google_oauth2")` は true のままで通過する。判定対象が「User が持つ Identity 集合」であって「今回のログイン」ではないことが原因。`spec/models/user_spec.rb:115-127` が経路 (b) の挙動を既にテストしている |
| メール許可リストのまま、verified メールを課題として残す | レビュー grok | **課題認識としては現状に合わない**（上記のとおり gem 側で閉じている）。かつ乗っ取り経路としての手当てが無い |

#### 決定

**メール許可リスト（`ENV["ADMIN_EMAILS"]`）かつ「今回のログインが `google_oauth2` である」を要求する。** ログインプロバイダは `SessionsController#create` で `session[:auth_provider] = auth.provider` として記録する（セッション cookie は署名・暗号化されているのでクライアントからは改ざんできない）。判定は `User#admin?(auth_provider:)` 1 メソッドに閉じる。

**この決定はオーナー回答（2026-09-02）で確定している。** 管理者は Google（Gmail）でログインし、GitHub ログインで管理画面に入る要件は無い、という回答を得た（§9.1）。したがって `ADMIN_PROVIDER = "google_oauth2"` は暫定値ではなく確定値であり、複数プロバイダを許可する分岐も設けない。

```ruby
# app/models/user.rb
# 管理者は ENV の許可リストで決める。users にロール列は持たない（#26 / ADR 0011）。
# メール一致だけでは足りない: from_omniauth は同じメールの別プロバイダ Identity を
# 同じ User に合流させるため（#user.rb (b) の経路）、今回のログインプロバイダも要求する。
ADMIN_PROVIDER = "google_oauth2"

def admin?(auth_provider:)
  return false unless auth_provider.to_s == ADMIN_PROVIDER

  self.class.admin_emails.include?(email.to_s.strip.downcase)
end

# 未設定・空文字・空白のみは空配列（フェイルクローズ）。配列の include? なので部分一致しない。
def self.admin_emails
  ENV["ADMIN_EMAILS"].to_s.split(",").filter_map { |e| e.strip.downcase.presence }
end
```

**`(provider, uid)` 許可リスト（レビュー gpt の推奨）を採らない理由**: ブートストラップが鶏と卵になる。任命 UI が無いので、uid を知るには一度ログインしてから `bin/kamal console` で `Identity` を引き、credentials を書き換えて再デプロイする必要がある。プロバイダ固定はその往復なしで、**クロスプロバイダ合流という現実的な経路をコードで閉じる**。残留リスクは「同じプロバイダで当該メールアドレスを他人が取得できる場合」だけである。

**この残留リスクは Gmail 確定により該当しない。** オーナー回答（2026-09-02）で管理者アドレスは Gmail（Google Workspace の独自ドメインではない）と確定した。Google は Gmail アドレスを再割り当てしないため、「同じプロバイダで当該アドレスを他人が取得する」経路は存在せず、残留リスクは「管理者本人の Google アカウント乗っ取り」に収束する。これは `(provider, uid)` ピン留めでも同じく残るもので、uid ピン留めに切り替えても得られる強度の差は無い。**したがって `(provider, uid)` ピン留めは本 issue でも将来の必須事項としても採らない。**

<a id="premise-gmail"></a>**この前提が崩れたら再検討する条件（本書で条件を展開する唯一の箇所。他は ADR 0011 の Consequences に 1 行再掲するだけ）**: 管理者アドレスを Gmail から **Google Workspace の独自ドメイン**へ移す場合。Workspace ではドメイン管理者が退職者のアドレスを別人へ再割り当てでき、新しいアカウントには別の `sub`（＝ Identity の `uid`）が振られる一方、メールアドレスは同一なので `from_omniauth` の経路 (b) でその新アカウントが管理者 User に合流する。そのときは許可リストを `(provider, uid)` へ切り替える（`User#admin?` の中身だけを差し替えればよいよう seam を 1 メソッドに閉じてある）。この条件と対処は ADR 0011 の Consequences にも 1 行残し、本文の他の箇所では繰り返さない。

#### メールの大文字小文字

- **許可リスト比較**: 両辺 `strip` + `downcase` の完全一致（上記コード）。
- **DB 保存**: **本 issue では変更しない。** `db/schema.rb:126` の `index_users_on_email` は通常の unique index で PostgreSQL の既定どおり**大文字小文字を区別**し、`from_omniauth` の `find_by(email: email)`（`user.rb:49`）も区別する。したがって `Admin@example.com` と `admin@example.com` は別 User 行になり得て、比較を小文字化する `admin?` は両方を管理者と見なす。これはレビュー gpt が唯一指摘した実在の不整合だが、**修正は全ユーザーのログイン経路（`from_omniauth`）とデータ移行（既存の大小違い重複の検出・統合）を伴う**ため、閲覧ページの issue に混ぜない。§8 で別 issue に切り出し、ADR 0011 の Consequences に既知の性質として書く。プロバイダ固定と Gmail 確定（§9.1）により、実際に大小違いの行を作れるのは「Google が当該アドレスの大文字混じり表記を返す」場合に限られる。Gmail アカウントの `email` クレームは正規化された表記で返るのが通常なので実務上は起きにくいが、これは実測していない（§3.7）ため、既知の性質として ADR に残し、別 issue で正規化する方針は変えない。

#### フェイルクローズ

`ENV["ADMIN_EMAILS"]` が未設定 / `""` / `" , "` のとき `admin_emails` は `[]` になり、誰も管理者にならない。`Array#include?` は完全一致なので `ADMIN_EMAILS=admin@example.com` に対し `evil-admin@example.com` は通らない（文字列の `include?` を使ってはならない）。`session[:auth_provider]` が nil のとき（この変更より前から続いているセッション、または `auth_provider` を記録しない経路）も false になる。この 4 つはすべて回帰テストで固定する（§6）。

#### 「許可リストのメールの User 行がまだ無い場合、最初にログインした者が管理者になる」

**事実である。** 経路 (c)（`user.rb:50-54`）でその場で User が作られ、`admin?` は true を返す。緩和策:

1. プロバイダ固定により「Google が検証済みとして返すメール」＝そのメールボックス／Google アカウントの所有者に限定される（誰でもではない）。
2. 運用手順として、**許可リストへ追加する前に一度ログインし、`User.find_by(email: ...)` で行の存在を確認する**ことを `docs/deployment.md` に書く。
3. この性質を ADR 0011 の Consequences に明記し、将来の読み手に「許可リストは任命ではなく、メール所有の証明に対する事前承認である」と伝える。

#### 未ログイン / 非管理者へのレスポンス

**どちらも `head :not_found`。** リダイレクトも 403 も使わない。**オーナー回答（2026-09-02）で、既存 `require_login` の 302 慣習から外れることを含めて承認済み**（§9.1）。以下は承認の根拠として残す。

- `SessionsController#create` は常に `redirect_to root_path`（`sessions_controller.rb:17`）で、`return_to` / `stored_location` の類はリポジトリに存在しない（確認済み）。したがって未ログイン時に `/auth/login` へ 302 しても、OAuth 後はトップに落ちて `/admin/feedbacks` には戻らない。計画 grok が 302 に払う「運営者の利便」は、このアプリのフローでは実際には得られない。
- 「未ログインは 302、非管理者は 404」の二段構えは、パスが実在することだけを教える最も弱い組み合わせになる。1 本のルール（`/admin/*` は管理者以外から観測できない）にした方がテストしやすく、後続の実装者が崩しにくい。
- 403 は「ここに管理画面がある」を確定情報として返すうえ、このアプリには権限を申請する手段が無いので情報価値がゼロ。
- **`raise ActionController::RoutingError` ではなく `head :not_found` を使う。** 本番は `config.consider_all_requests_local = false`（`config/environments/production.rb:13`）なので、raise すると認可拒否のたびに例外がログに積まれ、将来エラートラッキングを入れたときに URL 総当たりがそのままアラートになる。既存の 404 も `render json: ..., status: :not_found`（`app/controllers/api/battle_rooms_controller.rb:34`）と明示形。なお「RoutingError でも request spec が 404 として観測できる」という計画 opus の主張は、この環境では実行して確かめられなかった（§3.7）。実行せずに済む `head :not_found` を選ぶ理由の一つでもある。

`require_login`（`app/controllers/application_controller.rb:27-29`）の 302 慣習から意図的に外れるので、その旨を `Admin::BaseController` のコードコメントに残す（後続の実装者が「他と揃える」つもりでリダイレクトに戻すのを防ぐ）。

#### ロール列 / Basic 認証を却下する理由

- **`users` にロール列**: 任命 UI が無い以上、実際の付け外しは `bin/kamal console` になり運用手順は許可リストと変わらない。マイグレーション + スキーマ変更 + factory 更新のコストだけが増える。なお計画 opus が却下根拠に引いた ADR 0004 は**ユーザー設定に限定された決定**であり（後述 §2.6）、一般原則としては使えない。ここは「必要になるまで状態を増やさない」という設計上の類推として書く。
- **HTTP Basic 認証**: 資格情報の系統が 2 本になり、`current_user` と結びつかないため誰が読んだかが残らない（§2.5 の監査ログが成立しない）。
- **アプリの外で閉じる（IP 制限 / VPN / kamal-proxy）**: Considered Options として ADR に 1 行残すが採らない。理由は Basic 認証と同じで、`current_user` と結びつかず監査できない。

### 2.3 争点 3 — 設定の置き場: credentials か ENV か

**決定: アプリは `ENV["ADMIN_EMAILS"]` を読む。本番の値は既存の OAuth クレデンシャルとまったく同じ経路（Rails credentials `admin.emails` → `.kamal/secrets` の `credentials:fetch` → `config/deploy.yml` の `env.secret` → コンテナの ENV）で注入する。開発・テストは `.env`（dotenv-rails）。**

レビュー opus の指摘は実物で裏が取れた:

- `config/master.key` はリポジトリに存在しない（`ls` で確認）。`.gitignore:34` の `/config/*.key` が無視している。
- CI の `backend_test` ジョブで RSpec に渡る env は `RAILS_ENV` と `DATABASE_URL` だけ（`.github/workflows/ci.yml:91-94`）。`RAILS_MASTER_KEY` は渡っていない。
- `require_master_key` は `config/` のどこにも設定されていない（`rg` で 0 件）。したがって `raise_if_missing_key` は false。Rails 8.1.3 の `ActiveSupport::EncryptedConfiguration#read` は `EncryptedFile::MissingContentError` を rescue して `""` を返すので、**鍵が無くても例外にはならず credentials は空として読まれる**（upstream ソースで確認）。

つまり credentials 直読みは「クラッシュしないが常に空」であり、(1) 正常系の request spec が必ず stub 必須になる、(2) master.key を持たない開発者・エージェントはローカルで管理者経路を再現できない、という開発体験の悪化を招く。ENV なら spec は `around` で退避・復元するだけで済み、ローカルは `.env` に 1 行書くだけで再現できる。

計画 gpt が挙げた credentials 直読みの長所（`RAILS_MASTER_KEY` は既にコンテナへ注入済みなので `deploy.yml` / `.kamal/secrets` を触らずに済む）は本物だが、`.kamal/secrets:15-19` に 1 行、`config/deploy.yml` の `env.secret` に 1 行足すだけなので、開発体験の劣化に見合わない。

**格納形式はカンマ区切りの文字列に固定する**（レビュー grok の指摘。`bin/rails credentials:fetch` はスカラー向けで、既存の `google.client_id` と同型。YAML 配列を fetch すると `["a@x.com", "b@x.com"]` のような `to_s` が ENV に入り、許可リストが壊れる）。環境ごとの具体的な設定手順は §4.8 に書き下してある。

`config/deploy.yml` の `env.clear` に平文で置く選択肢は**採らない**（当初は人間への確認事項としていたが、オーナー回答で管理者が特定の個人 Gmail アカウント 1 つに固定されたため、そのアドレスをリポジトリへ平文で残すのは認可の集約先を公開するのと同じになる。§9.2 の「取り下げた確認事項」）。

環境ごとにキャッシュせず、判定のたびに `ENV` を読む。計画 grok の initializer キャッシュ（`config.x.admin_emails`）は起動時に固定されるためテストで差し替えて戻し忘れると他の spec に漏れるうえ、このリポジトリに `config.x` の前例が無い。パフォーマンス差は管理者ページの GET だけなので無視できる。

### 2.4 争点 4 — ページネーション

**決定: 1 ページ 50 件の offset ページネーションを入れる（計画 gpt を採用）。カテゴリ絞り込みは今回入れない。**

これは 3 レビューの多数意見（レビュー opus・レビュー grok が「上限方式」）を覆す判断なので、理由を明示する。

**レビュー gpt の指摘「上限方式では古い投稿が console 専用のまま残る」は正しく、しかも軽くない。** issue #26 の本文は「**読み取り手段が `rails console` しか無い**」ことを問題として立て、「DB に溜まったフィードバックを一覧できる管理者ページを新設する」ことを目的にしている（原文確認済み）。上限方式は、上限を超えた行についてまさにその問題を再生産する。レビュー opus は「打ち切り表示を出すので取りこぼしが不可視にならない」と反論するが、**可視であることと到達可能であることは別**であり、issue が求めているのは後者である。

上限方式を推す論拠（件数が当面少ない・実装が既存の写しで済む）を検討したうえで、それでも offset を採る:

- **増分コストが小さい。** 上限方式でも `totalCount` と打ち切り表示は必要で、そこは共通。追加になるのは `page` パラメータの正規化・clamp、`offset`、`totalPages` の props、前後リンク 2 本、request spec 数本だけ。新 gem も複合 index も不要（`RECENT_LIMIT` 相当の定数は `PER_PAGE` に置き換わる）。
- **「そのときが来たら別 issue で足す」は自動的には起きない。** 上限方式を採った 2 計画とも「`totalCount > RECENT_LIMIT` になったら次の issue」と書いているが、その閾値を誰が監視するのかは決めていない。運用者 1 人の前提では、気づくのは「読めなくなってから」になる。
- **深い offset の性能・境界ずれ**（レビュー opus が offset の短所として挙げた点）は、日に数件のオーダーでは実害が無い。`created_at DESC, id DESC` で同一時刻のタイブレークを固定すれば、ページ境界の非決定性も消える（計画 gpt / grok が正しく、計画 opus の `created_at` のみは欠落）。

**カテゴリ絞り込みは入れない。** ページネーションを入れる以上、クライアント側タブは「今のページの 50 件の中での絞り込み」になり、計画 gpt が指摘したとおり「全件を絞った」と誤認させる。サーバ側 `?category=` にすると query param のバリデーション・状態保持・空状態・ページ番号との組み合わせテストが一気に増える。**1 件も捌いていない段階でトリアージ UI を設計するより、まず全件に到達できることを優先する。** サーバ側絞り込みは §8 で別 issue に切り出す。

仕様:

- `PER_PAGE = 50`。`page` は `params[:page].to_i` を 1 以上へ正規化し、`total_pages`（= `[(total_count / PER_PAGE.to_f).ceil, 1].max`）へ clamp する。非数・0・負数・過大値はすべてこの正規化で吸収する。
- 並びは `order(created_at: :desc, id: :desc)`。
- props は `page` / `perPage` / `totalCount` / `totalPages` のみ。`page` 以外の未知の query param は引き回さない。
- 0 件のときは `totalPages = 1`、`page = 1`、空状態を表示する。

### 2.5 争点 5 — PII とキャッシュ

#### `Cache-Control: no-store` → **入れる**

レビュー opus の指摘は upstream ソースで裏が取れた。Rails 8.1.3 の `ActionDispatch::Http::Cache::Response` は `DEFAULT_CACHE_CONTROL = "max-age=0, private, must-revalidate"` と定義しており（`actionpack/lib/action_dispatch/http/cache.rb`）、**`no-store` ではない**。これは共有キャッシュを止めるだけで、ブラウザのディスクキャッシュや戻る操作での再表示は止めない。したがって計画 opus §6.2 の「Rails のデフォルトで `no-store` 相当（`no-cache`）になるため今回は追加しない」は誤りで、フィードバック本文と返信先メールの集約ページで唯一の緩和策を誤った根拠で捨てている。

`Admin::BaseController` の `before_action` で **`no_store` を呼ぶ**。`ActionController::ConditionalGet#no_store` は Rails 8.1.3 に実在し、`response.cache_control.replace(no_store: true)` で `Cache-Control: no-store` を出す（upstream ソースで確認）。

**`expires_now` は併用しない。** 同じソースで確認したとおり `expires_now` は `cache_control` を `no_cache: true` で **replace** するだけで、docstring にも「Intermediate/browser caches may still store the asset」とある。両方呼ぶと後勝ちの順序依存になり、意図が読めなくなる。`no_store` 単体が正しい。レスポンスヘッダを request spec で固定する（§6）。

#### Inertia の `encrypt_history` → **追加変更は入れない（現状維持を明文化する）**

`config/initializers/inertia_rails.rb:5` で既に `config.encrypt_history = true`（確認済み。3 計画で grok だけが指摘）。したがってコード変更は不要。**将来この行を外されないように**、ADR 0011 の Consequences とセキュリティ節に「管理者ページの props が history state に平文で残らない現状はこの設定に依存している」と書く。コントローラ側で冗長に呼び直すことはしない。

同じ初期化ファイルの `use_script_element_for_initial_page = true`（`:7`）により初期 props は `<script type="application/json">` に入る。`data-page` 属性方式より安全側だが、これは props に生 HTML を入れないという前提の上での話である。

#### 管理者アクセスの監査ログ → **入れる（成功時のみ、PII なし）**

認可の信頼根拠が「OAuth プロバイダの検証済みメール」＋「ログインプロバイダ」という外部の主張に集約されている以上（§2.2）、乗っ取りを後から検知する手段がまったく無いのは弱い。`Admin::FeedbacksController#index` の成功時に 1 行だけ残す。

```ruby
Rails.logger.info("[admin] feedbacks#index user_id=#{current_user.id} page=#{page}")
```

- **`user_id` とページ番号のみ。メールアドレス・本文・件名は絶対に載せない。**
- 本番のログレベルは `info`（`config/environments/production.rb:41`）、出力は STDOUT（`:38`）なので、この行は本番に出る。
- **拒否（404）はログしない。** 攻撃者がいくらでも量を出せるため。404 自体はプロキシのアクセスログに残る。

#### PII のその他の扱い

- **アカウントのメールアドレスを props に載せない。** `sender` は `{ id, nickname }` のみ。返信先は `CONTEXT.md:87-89` の定義どおりフォームの `email` 欄が正であり、それを空にしたのは送信者の選択。
- **メールアドレスを URL に載せない。** 検索・メール絞り込みを query param で実装しない（今回はそもそも実装しない）。`page` だけを URL に置く。
- `config/initializers/filter_parameter_logging.rb:6-8` は `:email` を既にフィルタしているが、**これは params のフィルタであってレスポンスボディや `Rails.logger` の引数には効かない**。実装中のデバッグログ（`Rails.logger.info feedback.body` の類）を残さない。
- `:body` / `:subject` の params フィルタ追加（計画 gpt の提案）は、**本 issue では行わない。** 効くのは書き込み側 POST `/feedback` のログであり、本 issue が作るのは GET のみで params に本文は来ない。1 行で安いが関心が違うので §8 で別 issue に切り出す。

### 2.6 争点 6 — 既読 / 対応済みフラグ

**決定: 持たせない（結論は 3 計画・3 レビューと同じ）。ただし却下の根拠を差し替える。**

実際に ADR を読んで確認した誤用:

- **ADR 0007（`docs/adr/0007-badges-derived-not-stored.md`）**: 主旨は「バッジの解除判定を `game_results` から毎回導出し、**保存された解除と現在の条件で計算した解除が食い違う経路を構造的に排除する**」。「今いらないテーブルを持たない」という一般原則ではない。**既読は `feedbacks` の既存列から導出できない純粋な状態**なので、0007 をロール列や既読フラグの却下根拠にするのは論理が飛んでいる（計画 grok の引用は誤用。計画 opus はこの区別を明示していて正確）。
- **ADR 0004（`docs/adr/0004-account-first-settings-sync.md:16`）**: 原文は「サーバー契約は設定画面に露出している項目のみ（アカウントと設定の用語は CONTEXT.md 参照）。UI にない設定フィールドを DB スキーマへ先取りしない。」で、**ユーザー設定に限定された Consequence** である。既読フラグやロール列を一般に禁じてはいない。計画 opus の「ADR 0004 に反する」は射程を広げすぎ（レビュー gpt・レビュー grok の指摘が正しい）。**類推**としてなら引ける。

**差し替えた却下根拠**:

1. **issue が求めていない。** issue #26 の「やること」は一覧表示の 1 行だけで、表示項目は `category` / `body` / `email` / 送信者 / `created_at`（原文確認済み）。要判断としては挙がっているが、ワークフローの要件は書かれていない。
2. **読み取り専用ページに書き込み経路が生える。** トグルを入れると PATCH + CSRF + 認可 + 楽観的更新が同じコミット列に乗り、**新設したばかりの認可境界の攻撃面が読み取りと書き込みの 2 種類に増える**。本 issue の価値（読む手段の新設）に対して割に合わない。
3. **「既読」と「対応済み」は別の状態で、どちらを意味するかが未決定**（レビュー gpt の指摘）。自動既読か手動か、誰が対応したかも決まっていない。1 件も捌く前に語彙を DB に固定するのは早い。
4. **後付けが安い。** `handled_at`（nullable datetime）を後から足す場合、全件 NULL ＝「未対応」が正しい初期状態なのでバックフィルは不要。先送りのコストがほぼゼロである以上、今決める理由が無い。

**Considered Options として ADR に残すが実装しない中間案**（3 計画に無く、レビュー opus が提案）: 管理者のセッションまたは `localStorage` に最終閲覧日時を持ち、それより新しい行に「NEW」を出す。スキーマも更新エンドポイントも CSRF も不要で「どこまで読んだか」の実用上の大半が埋まる。今回は入れない（ページネーションと組み合わせると「NEW が別ページに散る」ため、意味が出るのは絞り込みができてから）。

---

## 3. 前提となるコードベースの事実（自分で確認したもの）

### 3.1 フロントエンドの構成

**Inertia + React（TSX）である。ERB のフィードバック View は存在しない。**

- `app/views/` にあるのは `layouts/`（`application.html.erb` / mailer）と `pwa/` のみ。画面本体の ERB は無い。
- ページは `app/frontend/pages/*.tsx`。resolver root は `app/frontend/entrypoints/inertia.tsx` の `pages: '../pages'`。
- サブディレクトリの前例あり: `render inertia: "auth/Login"`（`app/controllers/sessions_controller.rb:9`）→ `app/frontend/pages/auth/Login.tsx`。**`admin/Feedbacks` はこの流儀に乗る。**
- ビルドは Vite（`vite_rails` 3.11）+ bun。Tailwind v4。
- 一覧 UI の手本は `app/frontend/pages/History.tsx`（テーブル・空状態・打ち切り表示・タブ）。日時整形は `:55-63` の `toLocaleString('ja-JP')` で **`timeZone` の指定は無い**。
- フォント定数は `History.tsx:9-10` が `SERIF` と **`MONO`**。`SANS` は `app/frontend/pages/Feedback.tsx:22`（計画 opus の「`History.tsx:9-10` の `SERIF` / `SANS`」は誤り）。
- カテゴリの日本語ラベルは `app/frontend/pages/Feedback.tsx:28-33` に `CATEGORIES` としてベタ書き（バグ報告 / 機能リクエスト / 使い方の質問 / その他）。一方 `app/controllers/achievements_controller.rb:8` は `Badge::CATEGORIES` をサーバから props で渡す。リポジトリは両方の前例を持つ。

### 3.2 テスト基盤

- **RSpec**: `spec/` は `channels / factories / models / requests` の 4 つのみ。`spec/system` は無く、`Gemfile` に capybara / selenium も無い（確認済み）。`config/application.rb:40` に `config.generators.system_tests = nil`。
- `spec/rails_helper.rb:12` で `inertia_rails/rspec`、`:40` で FactoryBot、`:43-49` で OmniAuth テストモード（各 example 後に mock をクリア）、`:59` でトランザクショナルフィクスチャ。
- `spec/rails_helper.rb:27` の `spec/support/**` 自動 require は**コメントアウトのまま**で、`spec/support` ディレクトリも無い。共有ヘルパを足すならこの行を有効にするか、spec 内にローカル定義する。
- request spec のログインは各ファイルにベタ書き（`spec/requests/histories_spec.rb:4-12`、`spec/requests/feedbacks_spec.rb:7-14`。後者は `email:` / `uid:` を引数で変えられる形）。
- props のキー集合そのものを検証する前例: `spec/requests/histories_spec.rb:50-52`。上限と総件数の前例: `:65-78`。他ユーザー分の除外の前例: `:55-63`（管理者ページはこの**逆向き**の契約になる）。
- **Vitest**: `vitest.config.ts` に happy-dom + `app/frontend/test/setup.ts` + `@testing-library/react` が完備。既存 spec は 16 本だが、**`app/frontend/pages/` 配下のページ spec は 0 件**（`components/` 5 本、`features/` / `stores/` / `lib/` 11 本）。つまり `pages/admin/Feedbacks.spec.tsx` は**このリポジトリで最初のページ spec** になる。基盤はあるが手本は無い、という位置づけ。
- `config/environments/test.rb`: `:22` `consider_all_requests_local = true`、`:23` `cache_store = :null_store`、`:26` `show_exceptions = :rescuable`、`:29` `allow_forgery_protection = false`、`:52` `raise_on_missing_callback_actions = true`。

### 3.3 認証の実装

- `app/controllers/application_controller.rb:21-25` — `current_user` は `session[:user_id]` から `User.find_by`。`:27-29` — `require_login` は未ログインで `/auth/login` へ 302。`:7-17` — `inertia_share` が `auth.user`（`id / email / nickname / avatar_url / created_at`）、`settings`、`best_scores`、`csrf_token`、`flash` を全ページへ配る。
- `app/controllers/sessions_controller.rb:12-20` — ログインは OmniAuth コールバックのみ。`reset_session` 後に `session[:user_id]` を入れ、**常に `root_path` へ**戻す。`return_to` の類は無い。
- `app/models/user.rb:42-57` — `from_omniauth`（§2.2 に詳述）。`:13` — `email` は presence + uniqueness。
- `app/models/identity.rb` / `db/schema.rb:67-75` — `provider` / `uid` / `user_id`、`(provider, uid)` に unique index。
- **ロール／管理者の概念はコードにもスキーマにも一切無い**（`rg -ni "\badmin\b" app config db spec` が 0 件）。`db/schema.rb:120-127` の `users` は `avatar_url / created_at / email / nickname / updated_at` のみ。
- 認可の既存パターンは 3 通り: 302 リダイレクト（`application_controller.rb:27-29`）、`redirect_to root_path, alert:`（`app/controllers/battles_controller.rb:8-10`）、明示的な `status: :not_found`（`app/controllers/api/battle_rooms_controller.rb:34`）。

### 3.4 Feedback（#7 の成果物）

- `app/models/feedback.rb:3` — `belongs_to :user, optional: true`。`:11-16` — `enum :category`（4 値、DB は PG native enum。`db/schema.rb:21`）。`:18-23` — `category` / `body` 必須（`body` 最大 1000）、`subject`（最大 100）と `email` は任意。
- `db/schema.rb:41-50` — `feedbacks` は `body / category / created_at / email / subject / updated_at / user_id` と `index_feedbacks_on_user_id` のみ。**既読・対応済みに相当する列は無い。** `:131` — `add_foreign_key "feedbacks", "users"`（`on_delete` 指定なし）。
- `app/controllers/feedbacks_controller.rb:6-7` — `rate_limit to: 5, within: 1.minute`。`:16` — ハニーポット。`:20` — `user_id` は session からのみ。`:36` — `permit(:category, :subject, :body, :email)`（`user_id` は許可しない）。
- `config/routes.rb:23-24` — `get/post "feedback"`。管理者ルートは無い。
- **読み取り経路は存在しない。**
- `spec/factories/feedbacks.rb` は 7 行（`category` / `body` / `email { nil }`）。トレイトは無い（計画 opus の「3 行のみ」は不正確）。

### 3.5 CI の env と秘密情報

- `.github/workflows/ci.yml` のジョブは 4 つ: `scan_ruby`（brakeman + bundler-audit）、`lint`（rubocop）、`backend_test`、`frontend`（lint / check / test）。
- `backend_test` は PostgreSQL 16 サービス + bun install + **`bin/vite build`（`:86-89`。request spec がレイアウト経由で Vite マニフェストを参照するため）** + `bin/rails db:test:prepare && bundle exec rspec`。**RSpec に渡る env は `RAILS_ENV` と `DATABASE_URL` のみ（`:91-94`）。`RAILS_MASTER_KEY` は渡っていない。**
- `config/master.key` はリポジトリに無く、`.gitignore:34` の `/config/*.key` が無視している。`require_master_key` は `config/` に 0 件。
- 秘密情報は credentials に集約し、`.kamal/secrets:8-19` が `credentials:fetch` で ENV に落とし、`config/deploy.yml` の `env.secret`（`RAILS_MASTER_KEY` / DB パスワード / Google・GitHub の 4 つ）でコンテナへ注入。アプリは素の ENV を読む（`config/initializers/omniauth.rb:4-5`）。
- 開発・テストは dotenv-rails + `.env`。**`.env.example` はワーキングツリーにもインデックスにも存在しない**（`ls .env*` が no such file、`git ls-files` にヒット無し、`git check-ignore -v .env.example` が `.gitignore:11:/.env*` を返す）。したがって `README.md:20` の `cp .env.example .env` は既存の齟齬であり、**`.env.example` に追記するという手順は取れない**（§4.8）。なお計画 opus の「README:20」という行番号は正しく、レビュー opus の「21 行目」という訂正の方が誤り。

### 3.6 その他の確認事項

- `config/application.rb:36` の `config.time_zone` はコメントアウト＝ **UTC**。JST を明示している前例は `app/models/badge.rb:14`（`JST = ActiveSupport::TimeZone["Asia/Tokyo"]`、`:61 / :74 / :78` で使用）と `CONTEXT.md:82`（「連続プレイ」＝日本時間の暦日）。
- `config/initializers/inertia_rails.rb:5` `encrypt_history = true`、`:7` `use_script_element_for_initial_page = true`。
- CSP は `config/initializers/content_security_policy.rb` が全コメントアウト。
- `dangerouslySetInnerHTML` の使用箇所は 0 件。
- pagy / kaminari は `Gemfile` に無い。
- `CONTEXT.md:85-89` に「フィードバック」の定義はあるが、**「管理者」は用語集に無い**。`docs/agents/domain.md` は「用語集に無い概念を output で名指しするのはシグナル」としている。
- ADR は 0001〜0010。**本計画と正面から衝突するものは無い**（0001-0003 は Svelte 時代のフロントテスト方針、0004-0008 は設定・プレイ記録・バッジ・時刻表記、0009-0010 は対戦）。ADR 0008 はゲームの所要時間表記（秒.センチ秒 vs m:ss）であり、カレンダー日時の TZ とは無関係。
- コミットメッセージは日本語の終止形（`git log`: 「依存関係を更新する」「CI の失敗を修正する」「本番デプロイ（Kamal + VPS 1台）を構成する」）。

### 3.7 裏が取れなかったこと（明記）

この環境に Ruby / Bundler が無く（`ruby -v` / `bundle --version` とも command not found）、spec を実行していない。以下は**実行して確かめていない**:

1. `raise ActionController::RoutingError` が request spec で 404 として観測できるか（レビュー grok は `consider_all_requests_local = true` との組み合わせで DebugExceptions の診断 HTML になりやすく Inertia matcher と相性が悪い、と主張）。**どちらであっても `head :not_found` を採るので、実装上の分岐は生じない。**
2. `no_store` が本アプリのミドルウェアスタックを通過して最終ヘッダに残るか。Rails 8.1.3 のソース上は残る（`merge_and_normalize_cache_control!` が `no_store` を最優先で出力する）が、実測はしていない。**request spec でヘッダをアサートして確定させる**（§6）。
3. brakeman が新規コードに警告を出すか。
4. 本番 DB に現在フィードバックが何件溜まっているか（`PER_PAGE = 50` の妥当性判断に必要。§9）。
5. レビュー opus が挙げた「本番の `config.cache_store` がコメントアウトなので Rails 8 の既定はファイルストア」の正否。`config/environments/production.rb:50` がコメントアウトである点だけは確認した。**管理者ページに `rate_limit` を付けないという結論はキャッシュストアの種類に依存しない**ので、この点は決着させなくてよい。

---

## 4. 実装計画

### 4.1 ルーティング設計

```ruby
# config/routes.rb（feedback のルート定義の直後、namespace :api の前）
  # 管理者用（#26）。許可リスト外・未ログインは 404 を返し、存在自体を伏せる。
  namespace :admin do
    resources :feedbacks, only: :index
  end
```

- URL: **`GET /admin/feedbacks`**（`admin_feedbacks_path`）。ページ番号は `?page=N`。
- **`namespace :admin` にする理由**: ①`Admin::BaseController` という認可の単一関門を作れ、将来管理画面が増えても `before_action` の付け忘れが構造的に起きない ②URL を見るだけで公開面と管理面の境界が分かる ③Inertia のページも `pages/admin/` に分離でき、`pages/auth/Login.tsx` の前例に一致する。
- `only: :index`。今回 `show` は作らない（一覧に全文が出るので不要）。将来足すときに素直に伸びる形だけ残す。

### 4.2 マイグレーション

**不要。** 既読フラグ（§2.6）もロール列（§2.2）も見送るため、`db/schema.rb` は一切変更されない。index も足さない（現規模では `feedbacks` の `count` と `created_at DESC` のソートコストは無視できる。実測で増えたら `(created_at, id)` の複合 index を別 issue で検討）。

### 4.3 追加・変更するファイル

| ファイル | 種別 | 内容 |
| --- | --- | --- |
| `app/models/user.rb` | 変更 | `ADMIN_PROVIDER` 定数、`#admin?(auth_provider:)`、`.admin_emails` を追加（§2.2 のコード）。既存メソッドには触らない |
| `app/controllers/sessions_controller.rb` | 変更 | `create` に `session[:auth_provider] = auth.provider` を 1 行追加（`reset_session` の**後**）。理由をコメントで残す |
| `app/controllers/application_controller.rb` | 変更 | `private` に `current_auth_provider`（`session[:auth_provider]` を返すだけ）を追加。`inertia_share` は変更しない |
| `app/controllers/admin/base_controller.rb` | 新規 | `ApplicationController` を継承。`before_action :require_admin`, `before_action :no_store`。`require_admin` は `head :not_found unless current_user&.admin?(auth_provider: current_auth_provider)` |
| `app/controllers/admin/feedbacks_controller.rb` | 新規 | `Admin::BaseController` を継承。`PER_PAGE = 50`。ページ取得・serializer・監査ログ |
| `config/routes.rb` | 変更 | §4.1 |
| `app/frontend/pages/admin/Feedbacks.tsx` | 新規 | 一覧ページ（§4.5） |
| `spec/models/user_spec.rb` | 変更 | `describe "#admin?"` を追加 |
| `spec/requests/admin/feedbacks_spec.rb` | 新規 | 認可マトリクス + props 契約 + ページング + ヘッダ（§6） |
| `spec/requests/sessions_spec.rb` | 変更 | ログイン時に `session[:auth_provider]` が記録されることの回帰テスト |
| `spec/factories/feedbacks.rb` | 変更 | `trait :from_guest` / `trait :with_email` / `trait :with_subject` を追加（既存 3 属性は壊さない） |
| `app/frontend/pages/admin/Feedbacks.spec.tsx` | 新規 | Vitest のページ spec（§6） |
| `.kamal/secrets` | 変更 | 末尾（現在 `:18` の GitHub 行の下）に `ADMIN_EMAILS=$(bin/rails credentials:fetch admin.emails)` を追記（既存 OAuth 行と同形。§4.8） |
| `config/deploy.yml` | 変更 | `env.secret`（`:27-33`）のリスト末尾に `- ADMIN_EMAILS` を追記（§4.8） |
| `docs/deployment.md` | 変更 | 「4. シークレットの設定」（`:34-46`）に `admin.emails` の項を追記（§4.8 の手順をそのまま書く） |
| `README.md` | 変更 | `:20` の `cp .env.example .env` 周辺に、`.env` へ `ADMIN_EMAILS=you@example.com` を書く旨を追記（§4.8） |
| `.github/workflows/ci.yml` | **変更しない** | `backend_test` に `ADMIN_EMAILS` を渡さない。未設定＝管理者ゼロが CI の既定状態であることを保つ（§4.8） |
| `CONTEXT.md` | 変更 | 「フィードバック」節に「管理者」の定義を追加（§4.6） |
| `docs/adr/0011-admin-by-email-allowlist-and-provider-pin.md` | 新規 | 認可モデルの決定を ADR 化（§4.7） |

### 4.4 コントローラの形

```ruby
# app/controllers/admin/base_controller.rb
module Admin
  # 管理者専用画面の共通基底。認可はここに一元化し、配下のコントローラは
  # before_action の付け忘れが構造的に起きないようにする（#26 / ADR 0011）。
  class BaseController < ApplicationController
    before_action :require_admin
    before_action :no_store

    private

    # 未ログインと「ログイン済みだが管理者でない」を区別せず 404 にする。
    # ページの存在自体を伏せるため、require_login のようなログイン画面への
    # リダイレクトは意図的にしない（ログイン後に元 URL へ戻る機構がそもそも無い）。
    def require_admin
      head :not_found unless current_user&.admin?(auth_provider: current_auth_provider)
    end
  end
end
```

```ruby
# app/controllers/admin/feedbacks_controller.rb
module Admin
  class FeedbacksController < BaseController
    PER_PAGE = 50

    def index
      total_count = Feedback.count
      total_pages = [ (total_count / PER_PAGE.to_f).ceil, 1 ].max
      page = params[:page].to_i.clamp(1, total_pages)

      feedbacks = Feedback.includes(:user)
                          .order(created_at: :desc, id: :desc)
                          .offset((page - 1) * PER_PAGE)
                          .limit(PER_PAGE)

      # 認可の信頼根拠が OAuth の主張である以上、閲覧の事実だけは残す（PII は載せない）
      Rails.logger.info("[admin] feedbacks#index user_id=#{current_user.id} page=#{page}")

      render inertia: "admin/Feedbacks", props: {
        feedbacks: feedbacks.map { |f| serialize(f) },
        page: page,
        perPage: PER_PAGE,
        totalCount: total_count,
        totalPages: total_pages
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
        created_at: feedback.created_at,
        sender: feedback.user && { id: feedback.user.id, nickname: feedback.user.nickname }
      }
    end
  end
end
```

- `params[:page].to_i` は非数で 0 になり、`clamp(1, total_pages)` が 1 に寄せる。負数・過大値も同じ経路で吸収される。
- `includes(:user)` で送信者表示の N+1 を潰す。
- **props のキー命名**: 行の中は snake_case（`created_at`）、ページ全体の props は camelCase（`totalCount` / `perPage` / `totalPages`）。リポジトリは `HistoriesController` が `records`（`as_json` の snake）+ `recentLimit`（camel）という同じ混在をしており、それに揃える。実装者が割れないようここで固定する。

### 4.5 ページの形（`app/frontend/pages/admin/Feedbacks.tsx`）

`History.tsx` の骨格を写す。

- `<Head title="フィードバック一覧 - 上毛かるたタイピング" />` + `<Header user={auth?.user ?? null} />` + 背景画像。
- ヒーロー（アイコン + 「フィードバック一覧」）。運営向けであることが分かるサブコピーは可。プレイヤー向け文言（「ご意見・ご要望を…」）は使わない。
- テーブル列: 日時 / 種類 / 件名・本文 / 送信者 / 返信先。
  - **日時は `Intl.DateTimeFormat` で `timeZone: 'Asia/Tokyo'` を明示し、画面にも JST と分かる表記を置く。** `config.time_zone` が未設定＝ UTC で `created_at` は UTC の ISO 文字列として props に載るため、`History.tsx:56` の `toLocaleString('ja-JP')`（TZ 指定なし）ではブラウザ依存になる。運営がログや `bin/kamal console` と突き合わせる画面なので曖昧さを残さない。前例は `app/models/badge.rb:14`。
  - 本文は `<p className="whitespace-pre-wrap break-words">{f.body}</p>`。**`dangerouslySetInnerHTML` は使わない。** Markdown 化・リンク自動変換もしない。
  - 送信者は `f.sender ? (f.sender.nickname || \`ユーザー #${f.sender.id}\`) : 'ゲスト'`。`CONTEXT.md` の語（「ゲスト」「ユーザー」）をそのまま使う。
  - 返信先は `f.email || '—'`。**`mailto:` リンクにしない**（プレーンテキスト。攻撃面を増やさない）。
  - **未知の `category` 値は生文字列を出さず「不明」にする**（計画 grok）。ラベルは `Feedback.tsx:28-33` と同じ 4 語（バグ報告 / 機能リクエスト / 使い方の質問 / その他）をこのページ内に定義する。4 語固定なのでサーバから渡さない（絞り込みを入れないため `categories` props も不要）。
- ページネーション: 「前へ」「次へ」を Inertia の `Link`（`href={\`/admin/feedbacks?page=${n}\`}`）で描き、`page === 1` / `page === totalPages` のとき無効化する。「{page} / {totalPages} ページ（全 {totalCount} 件）」を併記する。`page` 以外の query param は引き回さない。
- 0 件の空状態（`totalCount === 0`）。
- ヘッダーに管理者向けのメニュー項目は**足さない**。

### 4.6 CONTEXT.md への用語追加（案）

`CONTEXT.md` の「フィードバック」の直後に置く。既存本文が「運営へ送る」と書いているので、`_Avoid_` に「運営者」を入れると既存語彙と衝突する。そこを踏まえた案:

```markdown
**管理者**:
送られたフィードバックを閲覧できる運営の担当者。ログイン済みユーザーのうち、サーバ側の許可リスト（`ADMIN_EMAILS`）にメールアドレスが載っており、かつ Google でログインしている者だけを指す。プレイヤー向けの機能差は無く、アプリ内に管理者を任命する画面も無い。
_Avoid_: admin ユーザー、ロール、権限（「運営」は組織を指す語として引き続き使う）
```

`docs/agents/domain.md` の「用語集に無い概念を output で名指しするのはシグナル」に従い、実装と同じ PR で用語を確定させる。

### 4.7 ADR 0011（骨子）

タイトル: **管理者はメール許可リストとログインプロバイダで決め、`users` にロール列を持たない**

- **決定**: `ENV["ADMIN_EMAILS"]`（カンマ区切り、`strip` + `downcase` の完全一致）に載るメールを持ち、かつ今回のログインが `google_oauth2` であるユーザーだけを管理者とする。判定は `User#admin?(auth_provider:)` の 1 箇所。認可は `Admin::BaseController` の `before_action` に一元化し、未ログイン・非管理者ともに 404 を返す。
- **理由**: 実質 1 人運用の規模で、既存 OAuth ログインと credentials → ENV の注入経路だけで完結する最小の案だから。プロバイダ固定は `from_omniauth` のメール合流経路（`user.rb:49`）による権限昇格を運用注意ではなくコードで閉じるため。
- **Considered Options**:
  - `users` のロール列 — 任命 UI が無く運用は console 頼りのまま、スキーマだけ増える。
  - HTTP Basic 認証 — 資格情報の系統が 2 本になり、`current_user` と結びつかず監査できない。
  - アプリ外で閉じる（IP 制限 / VPN） — 同上。
  - `(provider, uid)` の許可リスト — uid を知るために一度ログイン → console → 再デプロイのブートストラップが要る。**管理者アドレスが Gmail である前提（オーナー確認済み）では強度の差が出ないため却下。**
  - 既読フラグの代替として「最終閲覧日時をセッション/localStorage に持ち新着に NEW を出す」— スキーマ変更なしで実現できるが今回は入れない。
- **Consequences**:
  - 管理者の付け外しは credentials 編集 + `bin/kamal deploy`。
  - **この決定は「管理者アドレスが Gmail である」ことを前提にしている。** Google Workspace の独自ドメインへ移す場合、退職者アドレスの再割り当てで別 `uid` の新アカウントが同じメールで経路 (b) に乗り、管理者 User に合流する。そのときは許可リストを `(provider, uid)` へ切り替える（`User#admin?` の中身だけを差し替えればよい）。
  - **許可リストに載せたメールの `User` 行がまだ無い場合、そのメールで最初に Google ログインした者が管理者になる。** 追加前に User 行の存在を確認する運用手順で緩和する。
  - 信頼の根拠は `omniauth-google-oauth2` 1.2.2 が検証済みメールしか `info.email` に入れない実装（`verified_email`）である。gem を更新するときはこの契約を確認する。
  - `users.email` の一意性と `from_omniauth` の照合は大文字小文字を区別する一方、`admin?` は小文字化して比較する。大小違いの 2 行がどちらも管理者になり得る（別 issue で正規化する）。
  - `ADMIN_EMAILS` 未設定なら誰も管理者にならない（フェイルクローズ）。
  - `session[:auth_provider]` を持たない既存セッションは管理者になれない（再ログインが必要）。
  - `InertiaRails` の `encrypt_history = true` を外すと、管理者ページの props が history state に平文で残る。外さない。
  - 画面を作っても誰も見に行かなければ #7 が承知した見逃しリスクは残る。確認頻度は運用で決める。

### 4.8 `ADMIN_EMAILS` の設定手順（環境別）

値の形式は全環境共通で **カンマ区切りの文字列**（例: `you@gmail.com` / `you@gmail.com,other@gmail.com`）。要素の前後空白は `User.admin_emails` が `strip` するので気にしなくてよい。YAML 配列にはしない（`bin/rails credentials:fetch` はスカラー向けで、配列を fetch すると `["a@x", "b@x"]` の `to_s` が ENV に入り許可リストが壊れる）。

#### 開発（`.env`）

```sh
# .env（gitignore 済み。リポジトリには入らない）
ADMIN_EMAILS=you@gmail.com
```

`bin/dev` を起動し直してから Google でログインし、`/admin/feedbacks` を直接開く。別アカウントでログインすると 404 になることも確認する。

**`.env.example` には追記できない。** このリポジトリに `.env.example` は存在せず（ワーキングツリーにもインデックスにも無い）、`.gitignore:11` の `/.env*` が将来作っても追跡対象にしない（§3.5 で確認済み）。したがって**開発者向けの案内は `README.md:20` 付近に直接書く**。`.env.example` を追跡対象に戻す（`.gitignore` に `!/.env.example` を足す）のは README の既存の齟齬を直す作業なので §8 で別 issue に切り出す。

#### テスト / CI（設定しない）

`.github/workflows/ci.yml` の `backend_test` に `ADMIN_EMAILS` を**追加しない**。CI の env は `RAILS_ENV` と `DATABASE_URL` のままにする（`:91-94`）。

- CI では `ADMIN_EMAILS` が未設定 → `User.admin_emails` が `[]` → **誰も管理者にならない**のが既定状態になる。これはフェイルクローズの実地確認そのものなので、そのまま維持する価値がある。
- 正常系（管理者が 200 を受け取る）の spec は、CI の env に依存せず **spec 内の `around` フックで `ENV["ADMIN_EMAILS"]` を退避・設定・復元する**（§6.1 / §6.3）。ワークフローを触らずに済むのは ENV 方式を選んだ利点である（credentials 直読みなら CI に `RAILS_MASTER_KEY` を渡す必要が生じていた。§2.3）。
- 万一 CI に `ADMIN_EMAILS` を足すと、フェイルクローズの負テスト（未設定なら 404）が env の値に汚染される。足さないことをワークフローのコメントで明示してもよい。

#### 本番（credentials → `.kamal/secrets` → `deploy.yml` → コンテナ ENV）

既存の Google / GitHub OAuth クレデンシャルとまったく同じ経路に 1 行ずつ足す。

1. `bin/rails credentials:edit` で `admin.emails` を追加する（`docs/deployment.md:34-46` の「4. シークレットの設定」に手順がある）。

   ```yaml
   admin:
     emails: you@gmail.com
   ```

2. `.kamal/secrets` の末尾（現在 `:18` の `GITHUB_CLIENT_SECRET` 行の下）に 1 行足す。既存 OAuth 行（`:15-18`）と同形。

   ```sh
   # 管理者用フィードバック閲覧ページの許可リスト（#26 / ADR 0011）。カンマ区切り。
   ADMIN_EMAILS=$(bin/rails credentials:fetch admin.emails)
   ```

3. `config/deploy.yml` の `env.secret`（`:27-33`）の末尾に `- ADMIN_EMAILS` を足す。

4. `bin/kamal deploy` で反映する。ENV はコンテナ起動時に読まれるので、**値を変えたら再デプロイが必要**（管理者の付け外し＝デプロイ操作、という ADR 0011 の Consequence の実体）。

**アドレスを許可リストへ入れる前の確認手順**（§2.2 の「先着で管理者になる」性質の緩和）:

```sh
bin/kamal console
# > User.find_by(email: "you@gmail.com")
```

`nil` が返るなら、そのアドレスではまだ誰もログインしていない。**先に自分で Google ログインして User 行を作ってから**許可リストに入れる。あわせて `docs/deployment.md` に、管理者の Google アカウントに 2 要素認証を設定することを書く（信頼の根拠がその 1 アカウントに収束するため。§7.1）。

---

## 5. コミット分割案

コミットメッセージはリポジトリの流儀（日本語・終止形「〜する」）に合わせる。**各コミット時点で (a) CI が緑になるか (b) 認可の無いページが露出しないか** を明記する。

| # | メッセージ | 内容 | (a) 緑になるか | (b) 露出しないか |
| --- | --- | --- | --- | --- |
| 1 | `ログインしたプロバイダをセッションに記録する` | `sessions_controller.rb` に `session[:auth_provider] = auth.provider`、`application_controller.rb` に `current_auth_provider`。`spec/requests/sessions_spec.rb` に回帰テスト | **緑。** 既存の挙動は変わらず（セッションに 1 キー増えるだけ）、既存 spec も落ちない | 画面もルートも増えないので露出なし |
| 2 | `管理者の判定を User#admin? に追加する` | `app/models/user.rb` に `ADMIN_PROVIDER` / `#admin?` / `.admin_emails`。`spec/models/user_spec.rb` に許可リストの正・負・フェイルクローズ・プロバイダ不一致のテスト | **緑。** `bundle exec rspec spec/models/user_spec.rb` + rubocop。呼び出し元がまだ無いので挙動は何も変わらない | 同上 |
| 3 | `管理者用フィードバック一覧のルーティングとコントローラを追加する` | `Admin::BaseController` / `Admin::FeedbacksController` / `config/routes.rb` / `spec/requests/admin/feedbacks_spec.rb` / factory トレイト、**および最小の `pages/admin/Feedbacks.tsx`（テーブルとページリンクのみ、装飾なし）を同じコミットに入れる** | **緑。** request spec（認可マトリクス + props 形状 + ページング + `no-store` ヘッダ）と `bun run check` / `lint` が通る | **露出しない。** ルートが生えるのと同時に `require_admin` が付く。TSX を同梱するので「request spec は緑だが実ブラウザで壊れる」状態も作らない |
| 4 | `管理者用フィードバック一覧の画面を整える` | `pages/admin/Feedbacks.tsx` の本実装（ヒーロー・テーブル・空状態・JST 日時・ページネーション UI・未知カテゴリの「不明」）+ `Feedbacks.spec.tsx` | **緑。** `bun run lint` / `check` / `test`。バックエンド無変更なので rspec も据え置きで緑 | 既に認可済み |
| 5 | `管理者メールの設定手順をデプロイ手順に追記する` | `.kamal/secrets` / `config/deploy.yml` / `docs/deployment.md` / `README.md`（§4.8 のとおり）。`.github/workflows/ci.yml` は触らない | **緑**（設定とドキュメントのみ。CI の env を変えないので既存ジョブへの影響もゼロ）| — |
| 6 | `管理者の定義を CONTEXT.md と ADR に追加する` | `CONTEXT.md` の用語追加 + `docs/adr/0011-...md` | **緑** | — |

**レビューが指摘した罠を踏まないための設計**:

- コミット 3 で routes・コントローラ・最小 TSX を**同時に**入れる。計画 gpt のようにコミット 1 で routes + `Admin::BaseController` だけを入れると、`Admin::FeedbacksController` が未定義で「管理者は 200」が書けず、「非管理者は 404」はコントローラ不在による 404 でも通ってしまう偽の緑になる。
- コミット 1・2 を分ける意図は、**認可の材料（ログインプロバイダの記録）と判定ロジックを、画面の差分に埋もれさせずに単独でレビュー・テストできる状態にする**こと。認可は後戻りが最も高くつく。
- **コミット 5 は必須。** これを入れずにマージすると、本番では `ADMIN_EMAILS` が未設定＝フェイルクローズで、管理者本人も 404 のままになる。
- コミット 6 を最後に置いているが、ADR の内容（§4.7）はコミット 2 の実装前に確定させておく。認可の決定は実装と同時か先に固めるべきというレビュー gpt の指摘は正当で、ここでは「文書コミットを分ける」だけであって「決定を後回しにする」わけではない。

---

## 6. テスト計画

**実在するテスト基盤のみを使う**: RSpec の model spec / request spec（`spec/rails_helper.rb` に inertia matcher・FactoryBot・OmniAuth テストモードが揃っている）と Vitest（happy-dom + Testing Library、`vitest.config.ts` が `app/frontend/**/*.spec.tsx` を拾う）。**Capybara / system spec は導入しない**（§8 で別 issue）。

### 6.1 model spec — `spec/models/user_spec.rb`（追記）

`ENV["ADMIN_EMAILS"]` は `around` フックで退避・復元する（`spec/support/**` の自動 require はコメントアウトのままなので、ヘルパはこの spec 内にローカル定義する）。CI では `ADMIN_EMAILS` を渡さない方針（§4.8）なので、**正常系も含めてすべての example が spec 内で ENV を明示的に組み立てる**。spec の外の環境に依存する example を書いてはならない。

- 許可リストに載るメール + `auth_provider: "google_oauth2"` → true
- 載っていないメール → false
- **`ADMIN_EMAILS` 未設定なら常に false**（フェイルクローズ。最重要）
- **`ADMIN_EMAILS=""` / `" , "` でも false**（空文字要素が一致しない）
- 大文字小文字を無視して一致（`Admin@Example.com` ↔ `admin@example.com`）
- カンマ区切りで複数指定でき、各要素の前後空白が無視される
- **部分一致しない**（`ADMIN_EMAILS=admin@example.com` に対し `evil-admin@example.com` は false）
- **許可リストに載るメールでも `auth_provider` が `"github"` / nil なら false**（クロスプロバイダ合流の回帰テスト。§2.2 の中心）

### 6.2 request spec — `spec/requests/sessions_spec.rb`（追記）

- Google でログインすると `session[:auth_provider]` が `"google_oauth2"` になる
- GitHub でログインすると `"github"` になる
- ログアウト（`reset_session`）で消える

### 6.3 request spec — `spec/requests/admin/feedbacks_spec.rb`（新規）

ログインヘルパは `spec/requests/feedbacks_spec.rb:7-14` の `log_in_via_google`（`email:` / `uid:` を引数で変えられる形）を写し、GitHub 版も足す。

**認可の負テスト（必須）**

- 未ログインで `GET /admin/feedbacks` → **404**。`/auth/login` へリダイレクト**しない**ことも明示的にアサートする（存在を伏せる設計の回帰テスト）
- ログイン済みだが許可リスト外 → **404**
- **`ADMIN_EMAILS` 未設定のとき、管理者候補のメールでログインしていても 404**（フェイルクローズの HTTP 層の回帰テスト）
- **`ADMIN_EMAILS=""` / `" , "` でも 404**
- **許可リストのメールでも GitHub でログインしていれば 404**（クロスプロバイダ合流の回帰テスト。同じメールの User に Google と GitHub の両方の Identity が付いた状態を作って確認する）
- 許可リストに他人のメールだけが載っている状態で自分のメールでログイン → 404
- 部分一致しない（`ADMIN_EMAILS=admin@example.com` の状態で `evil-admin@example.com` でログイン → 404）
- **Inertia の partial request ヘッダ（`X-Inertia` / `X-Inertia-Partial-Data` / `X-Inertia-Partial-Component`）を付けても 404**（`before_action` が先に走ることの固定。3 計画で gpt だけが挙げた経路）
- いずれの 404 でもレスポンスボディにフィードバック本文・メールアドレスが含まれない

**認可の正テスト**

- 許可リストのメールで Google ログイン → 200、`expect_inertia.to render_component("admin/Feedbacks")`

**レスポンスヘッダ**

- `response.headers["Cache-Control"]` が `no-store` を含む（§3.7-2 をここで確定させる）

**props の内容**

- `feedbacks` が `created_at` の降順、同一 `created_at` では `id` の降順（決定的ソートの固定）
- 各行のキーが `id / category / subject / body / email / created_at / sender` の**ホワイトリストに一致する**（`spec/requests/histories_spec.rb:50-52` と同形）
- ゲスト送信は `sender` が nil、ログインユーザー送信は `sender` が `{ id, nickname }` のみで **`email` を含まない**
- **他ユーザーのフィードバックも含まれる**（`histories_spec.rb:55-63` の「他人の記録を除外する」とは逆向きの契約。管理者は全件見えるのが正しい、を明文化する）

**ページング**

- 51 件あるとき、1 ページ目は 50 件、`totalCount` は 51、`totalPages` は 2
- 2 ページ目に 1 ページ目と重複しない最も古い行が出る（**全件に到達できることの回帰テスト**。この issue の目的そのもの）
- `page` が 0 / 負数 / 非数（`"abc"`）/ 過大（`999`）のいずれでも例外にならず、1 または `totalPages` に正規化される
- 0 件のとき `page = 1`、`totalPages = 1`、`feedbacks = []`

**回帰**

- 公開側 `GET/POST /feedback` の既存 spec（`spec/requests/feedbacks_spec.rb`）が落ちないこと

### 6.4 Vitest ページ spec — `app/frontend/pages/admin/Feedbacks.spec.tsx`（新規）

このリポジトリで最初のページ spec になる（§3.2）。`Header` が `usePage` を使うため、`Header` をローカルにスタブするか `vi.mock('@inertiajs/react', ...)` で `usePage` / `Head` / `Link` をスタブする。既存の `app/frontend/components/battle/BattleResult.spec.tsx:27-46` と同じく `render()` + `screen.getByText`（日本語の可視テキスト）で見る。

- 1 件のフィードバックの category ラベル（「バグ報告」）・本文・返信先・日時が表示される
- **日時が JST で表示される**（UTC の ISO 文字列を渡して、期待する JST 表記になること）
- ゲスト送信の行に「ゲスト」、ユーザー送信の行にニックネーム、ニックネームが nil のとき「ユーザー #ID」が出る
- 返信先が空のとき「—」が出る
- 未知の `category` 値で「不明」が出る（生文字列を出さない）
- 0 件のとき空状態メッセージが出る
- `totalPages > 1` のとき「次へ」が有効、`page === totalPages` のとき無効。`page === 1` のとき「前へ」が無効
- **本文の改行が保持され、HTML タグを含む本文（`<script>alert(1)</script>` や `<img onerror=...>`）がそのままテキストとして表示される**（要素として現れないこと。§7 の XSS 回帰テスト）

React のエスケープ自体を再実装してテストするのではなく、「`dangerouslySetInnerHTML` を使っていないこと」の代理として描画結果を見る、という位置づけ（計画 gpt の姿勢が正しい）。

### 6.5 実行コマンド

```sh
bundle exec rspec
bin/rubocop
bin/brakeman --no-pager
bun run lint && bun run check && bun run test
```

CI（`.github/workflows/ci.yml:86-89`）は request spec がレイアウト経由で Vite マニフェストを参照するため `bin/vite build` を事前に走らせている。ローカルで request spec が落ちるときはこれを疑う。

---

## 7. セキュリティ

### 7.1 認可バイパス経路

- **`Admin::BaseController` を経由しない管理者アクションを作らない。** `namespace :admin` 配下のコントローラは必ずこれを継承する。公開 `FeedbacksController` に `index` を足さない。`Api::` 側に管理者エンドポイントを作らない。
- **フェイルクローズ**: `ADMIN_EMAILS` 未設定・空・空白のみで誰も管理者にならない。`.presence` で空文字要素を落とし、配列の `include?`（完全一致）で判定する。文字列に対する `include?` は絶対に使わない。model spec と request spec の両層で固定する（§6.1 / §6.3）。
- **管理者フラグをクライアント入力から決めない。** `params` にも表向きの cookie にも管理者フラグを置かず、常に `current_user` と `session[:auth_provider]`（署名・暗号化された cookie）から計算する。`FeedbacksController:20` の「`user_id` は session からのみ」と同じ原則。
- **`from_omniauth` のメール合流経路**（`app/models/user.rb:49`）: メール一致で別プロバイダの Identity が同じ User に無条件で紐付く。プロバイダ固定でクロスプロバイダの経路は閉じる。同一プロバイダ内でアドレスを他人が取得する経路は **Gmail 確定（§9.1）により存在しない**（Google は Gmail アドレスを再割り当てしない）。したがって**残る攻撃面は管理者本人の Google アカウント乗っ取りだけ**であり、`docs/deployment.md` に「管理者の Google アカウントに 2 要素認証を必須にする」を書いて閉じる。ADR 0011 の Consequences にも残す。
- **未ログイン / 非管理者に 404**（403 でもリダイレクトでもなく）。`require_login` の慣習から意図的に外れる旨をコードコメントに残す。
- CSRF: 今回は GET のみで状態変更が無いため追加の手当ては不要。将来 PATCH を足すときは既存機構（`ApplicationController:37-39` の `verified_request?`）に乗せる。
- `rate_limit` は管理ページに付けない（認証済みかつ単一利用者。キャッシュストア依存を増やす意味が無い）。
- `robots.txt` への `Disallow: /admin` 追記は**しない**。認証で 404 になるので保護の必要が無く、追記はむしろパスを公開する。

### 7.2 PII

- このページは `feedbacks.email`（返信先）と本文という PII の集約点になる。露出を最小にする（§2.5）。
  - アカウントのメールアドレスを props に載せない。
  - props のキーを request spec でホワイトリスト検証し、将来の追加を機械的に止める。
  - メールアドレスを URL に載せない（`page` のみ）。
  - `Cache-Control: no-store`。
  - `encrypt_history = true` を外さない。
- `filter_parameter_logging.rb:6-8` の `:email` は params のフィルタであり、レスポンスボディや `Rails.logger` の引数には効かない。デバッグログを残さない。
- 本番のログレベルは `info`（`production.rb:41`）、出力は STDOUT（`:38`）。レスポンスボディはログに出ないので、通常運用でメール・本文がログに落ちる経路は無い。**収集先（`bin/kamal logs` が読む Docker のログ）の保持期間とアクセス権は運用で確認する**（計画 gpt の指摘）。

### 7.3 XSS

- 本文・件名・メールは**匿名の誰でも投稿できる自由入力**であり、管理者が特権セッションで閲覧する。典型的な stored XSS の的。
- React は JSX 内の文字列を自動エスケープするので、**`dangerouslySetInnerHTML` を使わない限り安全**。改行の保持は `whitespace-pre-wrap` で行い、`<br>` への置換や `innerHTML` は禁止。Markdown 化・リンク自動変換もしない。`mailto:` リンクも作らない。§6.4 に回帰テストを置く。
- `use_script_element_for_initial_page = true`（`inertia_rails.rb:7`）により初期 props は `<script type="application/json">` に入る。props に生 HTML を組み立てて入れないことは前提として守る。
- CSP は現状すべてコメントアウト（`config/initializers/content_security_policy.rb`）。本 issue で有効化するのはスコープ外だが、「有効化されていない」事実は認識しておく。

### 7.4 監査

- 成功時に `[admin] feedbacks#index user_id=... page=...` を `Rails.logger.info` に 1 行（§2.5）。PII は載せない。拒否はログしない。
- 認可の信頼根拠が外部（OAuth の主張）に依存しているため、このログが「乗っ取られたか」を後から見る唯一の手掛かりになる。

### 7.5 静的解析

- brakeman が CI で走る（`.github/workflows/ci.yml:20-21`）。警告が出たら握り潰さず対処する（この環境では実行できていない。§3.7-3）。

---

## 8. スコープ外（別 issue に切り出す）

| 内容 | issue タイトル案 |
| --- | --- |
| `users.email` の保存時正規化と case-insensitive uniqueness、`from_omniauth` の照合正規化、既存の大小違い重複の検出 | `メールアドレスの大文字小文字を正規化してアカウント分裂を防ぐ` |
| `filter_parameters` に `:body` / `:subject` を追加（書き込み側 POST `/feedback` のログ対策） | `フィードバック本文がリクエストログに残らないようにする` |
| `User#has_many :feedbacks, dependent: :nullify`（現状 FK があり `has_many` が無いため、console で `user.destroy!` すると FK 違反になる。退会 UI は存在しない） | `退会時にフィードバックを孤児にせず残す` |
| Capybara / Selenium と `spec/system` の導入、CI のヘッドレスブラウザ設定 | `system spec（Capybara）の基盤を導入する` |
| サーバサイドのカテゴリ絞り込み（`?category=`）、全文検索、メールでの絞り込み | `管理者用フィードバック一覧にカテゴリ絞り込みを追加する` |
| 既読 / 対応済みフラグとそのマイグレーション（`handled_at` など） | `フィードバックの対応状態を記録できるようにする` |
| 新着フィードバックの通知（メール / Slack） | `新着フィードバックを運営へ通知する` |
| `.env.example` をリポジトリに置き直す（`.gitignore` に `!/.env.example` を足す）。`README.md:20` の `cp .env.example .env` が現状は成立しない既存の齟齬（§3.5 / §4.8） | `.env.example をリポジトリに戻して README のセットアップ手順を成立させる` |
| ~~`(provider, uid)` による管理者ピン留めへの移行~~ — **オーナー回答で管理者アドレスが Gmail と確定したため不要**。Google Workspace の独自ドメインへ移した場合のみ再検討する（§2.2 の「前提が崩れたら再検討する条件」）。issue は事前に立てない | — |
| CSP の有効化 | `Content-Security-Policy を有効化する` |
| フィードバックの削除・編集・返信送信、詳細ページ、CSV エクスポート | — |
| 管理者の任命 UI / ロール管理画面、`users` へのロール列追加 | — |
| `/admin` 配下の他の管理画面（ユーザー一覧、スコア管理など）。`Admin::BaseController` という受け皿だけ用意し中身は作らない | — |
| フィードバックの保存期間・匿名化・削除依頼対応 | — |
| `(created_at, id)` の複合 index、keyset pagination、pagination gem | — |
| プレイヤー向け Header / フッターへの管理者リンク、`inertia_share` への `admin` フラグ追加 | — |
| デザインカンプ（`docs/design/design.pen`）への管理者画面ノード追加 | — |

---

## 9. 確認済みの前提と、残っている未確認事項

### 9.1 確認済みの前提（2026-09-02、リポジトリオーナー回答）

設計に影響する未確認事項として挙げていた最重要 3 点は、すべてオーナーから回答を得て確定した。**3 点とも本計画の前提どおりで、設計判断の変更は発生していない。**

| # | 確認した事項 | 回答（2026-09-02） | 本計画への反映 |
| --- | --- | --- | --- |
| 1 | 管理者のログインプロバイダ。本計画は `google_oauth2` 固定を前提にしていた | **Google（Gmail）。GitHub ログインで管理画面に入る要件は無い** | `ADMIN_PROVIDER = "google_oauth2"` を確定値として実装する（§2.2）。複数プロバイダを許可する分岐は設けない。「許可リストのメールでも GitHub ログインなら 404」は仕様であり、回帰テストで固定する（§6.1 / §6.3） |
| 2 | そのアドレスが Gmail か、Google Workspace の独自ドメインか | **Gmail（独自ドメインではない）** | Google は Gmail アドレスを再割り当てしないため、`(provider, uid)` ピン留めへ切り替える条件分岐は**発生しない**。メール許可リストで確定とする（§2.2）。この前提が崩れる唯一の条件（Workspace への移行）は §2.2 の「前提が崩れたら再検討する条件」に集約し、ADR 0011 の Consequences に 1 行残す。§8 の別 issue 候補からも外した |
| 3 | 未ログイン時に 404 を返してよいか（既存 `require_login` の 302 慣習から外れる） | **404 でよい。慣習から外れる件も承認** | 未ログイン・非管理者とも `head :not_found` を確定仕様とする（§2.2）。`Admin::BaseController` に「意図的に `require_login` と揃えていない」旨のコメントを残す方針も維持する |

**実際のメールアドレスの値は未提供。** これは設計判断ではなくデプロイ時の設定作業なので、実装の着手をブロックしない（§9.2-A）。

### 9.2 残っている未確認事項

設計上の未確認事項は無い。以下はいずれも**実装完了後またはデプロイ時に決める運用側の項目**であり、実装の着手をブロックしない。

| # | 優先度 | 残っている事項 | いつ必要になるか |
| --- | --- | --- | --- |
| A | **高** | **`ADMIN_EMAILS` に入れる実際の Gmail アドレス。** 複数人にするならカンマ区切りで並べる。値そのものはコードにもこの計画にも書かず、`bin/rails credentials:edit` で本番 credentials に入れる（§4.8） | **デプロイ時。** これが設定されるまで本番は「誰も管理者にならない」（フェイルクローズ）ままで、管理者本人にも 404 が返る。実装・マージは値が無くても進められる |
| B | 中 | **`PER_PAGE = 50` は妥当か。** 本番 DB に現在フィードバックが何件溜まっているかで適正値が変わる（`bin/kamal console` で `Feedback.count`。§3.7-4） | 実装中またはデプロイ後。定数 1 つなので変更は安い |
| C | 中 | **日時を JST 固定にしてよいか。** 既存 `History.tsx:56` はブラウザ依存で、意図的にずらすことになる（§4.5） | 実装中。表示だけの問題で、決まらなくても着手できる |
| D | 中 | **ログインユーザーからのフィードバックで `email` 欄が空のとき、連絡手段が無くなることを許容するか。** 本計画はアカウントのメールを props に載せない（§2.5） | 実装中。許容しないなら PII の方針を見直す |
| E | 低 | **`subject` を表示列に含めてよいか。** issue #26 の表示項目には無いが、#7 で追加済みの任意件名なので出す想定 | 実装中。列が 1 つ増減するだけ |
| F | 低 | **`CONTEXT.md` の「管理者」定義と ADR 0011 をこの PR に含めてよいか**（別 PR に分けたい意向があれば分割する） | PR を出すとき |
| G | 低 | **フィードバックの確認頻度を運用手順として決める。** 画面を追加しただけでは #7 が承知した「誰も見に行かない」リスク自体は消えない（計画 gpt の指摘） | デプロイ後。コードの判断ではない |

**取り下げた確認事項**: 「`ADMIN_EMAILS` の格納先を credentials にするか `config/deploy.yml` の `env.clear` に平文で置くか」は、確認事項から外して credentials に確定した。回答 1・2 で管理者が特定の個人 Gmail アカウント 1 つに固定されたことで、そのアドレスがリポジトリに平文で残る `env.clear` は「認可の全体が 1 アドレスに集約されている」状態と噛み合わないと判断した。既存 OAuth と同じ credentials 経路（§4.8）で統一する。

---

## 10. 3 案・3 レビューの一致点と不一致点

**凡例**: 計画は opus / gpt / grok、レビューは R-opus / R-gpt / R-grok。◎ = 推奨、○ = 支持、△ = 条件付き、× = 反対・却下、— = 言及なし。最終決定欄の **【オーナー確定 2026-09-02】** は、§9.1 の回答によって留保が外れた論点を示す。

| # | 論点 | 計画 opus | 計画 gpt | 計画 grok | R-opus | R-gpt | R-grok | **最終決定** |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | ベース案 | — | — | — | opus 1 位 | gpt 1 位 | opus 1 位 | **opus をベース（ページネーションのみ gpt）** |
| 2 | 認可の枠組み | メール許可リスト ◎ | メール許可リスト ◎ | メール許可リスト ◎ | 許可リスト + Google Identity 要求 | `(provider, uid)` 許可リスト | 許可リスト（verified メールを課題視） | **メール許可リスト + ログインプロバイダ固定（`google_oauth2`）。【オーナー確定 2026-09-02】** R-opus の処方箋は User 単位の判定なので合流を塞げない（自分で確認）。R-gpt の uid 案は正しいがブートストラップが重く、**Gmail 確定により強度の差も出ない**ので却下。R-grok の verified 懸念は gem 側で既に閉じている（upstream 確認） |
| 3 | 判定の置き場 | `User#admin?` | コントローラ | `User#admin?` + initializer | `User#admin?` | 独立ポリシー | `User#admin?` | **`User#admin?(auth_provider:)`。** initializer キャッシュはグローバル状態になるので不採用 |
| 4 | 設定の置き場 | credentials → ENV | credentials 直読み | credentials → ENV + initializer | ENV | credentials | ENV | **ENV。** master.key がリポジトリに無く CI に `RAILS_MASTER_KEY` も無い（確認済み）。credentials は空として読まれ例外にはならないが、常に stub 必須になる |
| 5 | 格納形式 | 文字列 | YAML 配列 | 文字列 | — | — | 配列は `credentials:fetch` と非互換 | **カンマ区切り文字列**（R-grok が正しい） |
| 6 | 未ログイン時 | 404 | 404 | 302 | 404 | 302 + 403 を推奨（ただし統一するなら 404） | 404 | **404。【オーナー確定 2026-09-02】** ログイン後に元 URL へ戻る機構が存在しない（確認済み）ので 302 の利便が実在しない。`require_login` の慣習から外れる点もオーナー承認済み |
| 7 | 非管理者（ログイン済）| 404 | 404 | 404 | 404 | 403 を推奨 | 404 | **404。【オーナー確定 2026-09-02】** |
| 8 | 404 の返し方 | `raise RoutingError` | `head` | `head` | `head` | `head` | `head` | **`head :not_found`。** 本番は `consider_all_requests_local = false` なので raise はログを汚す |
| 9 | 空文字・部分一致 | `filter_map(&:presence)` + テスト ◎ | 方針のみ | 方針のみ | opus が最良 | opus が最良 | opus が最良 | **opus の実装をそのまま採用** |
| 10 | メールの大小文字 | 比較のみ downcase | 比較のみ downcase | 比較のみ downcase | — | **DB は case-sensitive で不整合**（唯一の指摘） | 同上（アカウント分裂として） | **比較は downcase、DB 正規化は別 issue**（確認済み: `index_users_on_email` は通常の unique index） |
| 11 | 許可リスト先着で管理者になる | — | — | — | **指摘（3 案とも見落とし）** | — | — | **事実。** 経路 (c) で新規 User が作られる。運用手順とプロバイダ固定で緩和し ADR に明記 |
| 12 | ページネーション | 上限 100 ◎ | offset 50 ◎ | 上限 200 ◎ | 上限方式（opus 支持）| **offset 50（gpt 支持）** | 上限方式（opus 支持）| **offset 50。** 多数意見を覆す。上限方式は issue の目的（console 依存の解消）を古い行について達成しない |
| 13 | ソートのタイブレーク | `created_at` のみ | `created_at, id` | `created_at, id` | `id` 必須 | `id` 必須 | `id` 必須 | **`created_at: :desc, id: :desc`** |
| 14 | カテゴリ絞り込み | クライアント側タブ ◎ | 入れない ◎ | 任意 △ | 入れる | 入れない | 入れる（注釈付き）| **入れない。** ページネーションと両立しない |
| 15 | 既読フラグ | 持たない ◎ | 持たない ◎ | 持たない ◎ | 持たない | 持たない | 持たない | **持たない**（根拠は差し替え） |
| 16 | 既読却下の根拠 | ADR 0004 を引用 | 「別状態で未決定」 | ADR 0007 を引用 | 0007 の誤用を指摘（opus 正確）| 0004 も 0007 も射程外 | 0007 誤用、0004 も類推 | **両 ADR とも直接の根拠にならない**（実物確認済み）。issue が求めていない／書き込み経路が生える／語彙が未決定／後付けが安い、を根拠にする |
| 17 | `Cache-Control` | Rails 既定で足りる（誤り）| `no-store` ◎ | — | opus の誤りを指摘 | opus の誤りを指摘 | opus の誤りを指摘 | **`no_store` を入れる。** Rails 8.1.3 の既定は `max-age=0, private, must-revalidate`（upstream 確認）。`expires_now` は併用しない |
| 18 | `encrypt_history` | — | — | 外さないと明記 ◎ | grok を取り込む | — | grok が正しい | **既に true（確認済み）。コード変更なし、ADR に明記** |
| 19 | 監査ログ | — | — | — | **提案（3 案とも欠落）** | — | — | **入れる**（成功時のみ、`user_id` + `page`、PII なし） |
| 20 | アカウント email の露出 | 載せない ◎ | 載せない ◎ | **`sender.email` に載せる** | grok は設計欠陥 | grok は設計欠陥 | grok は PII 過剰 | **載せない** |
| 21 | system spec | 導入しない | **Capybara 導入 ◎** | 導入しない | スコープ過剰 | スコープ過剰 | スコープ過剰・最大の膨張 | **導入しない**（別 issue） |
| 22 | ページ Vitest spec | 書く ◎ | 書く（XSS は system 依存）| 必須にしない | opus が最厚 | opus を取り込む | opus が正当 | **書く。** ただし**このリポジトリ初のページ spec**（既存ページ spec は 0 件。確認済み） |
| 23 | XSS 回帰テスト | Vitest ◎ | system spec | 無し | opus | opus を採用 | opus | **Vitest** |
| 24 | Inertia partial request の負テスト | — | ◎ | — | gpt を取り込む | 自案 | opus に欠落 | **入れる** |
| 25 | コミット 1 が緑か | 緑 | **緑にならない** | 緑 | gpt の欠陥 | 自認せず（他 2 レビューが指摘）| gpt の欠陥 | **opus / grok 型（最小 TSX をコントローラと同時に置く）** |
| 26 | `has_many :feedbacks, :nullify` | — | — | 本 issue に含める | 無関係 | scope creep | 別コミット可 | **別 issue** |
| 27 | 日時の TZ | `toLocaleString('ja-JP')` | **`Asia/Tokyo` 明示 ◎** | `toLocaleString` | gpt が正確 | 既存と不一致だが害は小 | 既存と意図的にずれる | **`Asia/Tokyo` 明示。** `config.time_zone` 未設定＝ UTC（確認済み）、前例は `badge.rb:14` |
| 28 | `:body` / `:subject` の params フィルタ | — | 本 issue に含める | 別 issue | 別コミット / 別 issue | 一緒に閉じるべき | 別 issue が正しい | **別 issue**（本 issue は GET のみで params に本文が来ない） |
| 29 | `CONTEXT.md` + ADR | 含める ◎ | 触れない | 任意 | opus が規約に沿う | opus を取り込む | opus が正しい | **含める** |
| 30 | issue 本文の引用 | **`app/views/feedbacks/` と system spec 要求を引用（存在しない）** | 引用なし | **「非管理者は 403/404」を issue 指定と記述（存在しない）** | opus の捏造引用を指摘 | opus は「鵜呑みにせず正しい」と評価 | opus の誤引用を指摘 | **R-opus / R-grok が正しい**（`gh issue view 26` で確認。本文に該当文字列なし、コメント 0 件）。技術的結論（Inertia で作る / Capybara を新設しない）は正しい |
| 31 | `README:20` の行番号 | 20 行目 | — | — | **21 行目だと訂正** | — | — | **計画 opus が正しく、R-opus の訂正が誤り**（`grep -n` で 20 行目と確認） |
| 32 | `History.tsx:9-10` の定数 | `SERIF` / `SANS` | — | — | `SERIF` / `MONO` | — | `SERIF` / `MONO`、`SANS` は `Feedback.tsx` | **R-opus / R-grok が正しい**（`SANS` は `Feedback.tsx:22`） |
| 33 | factory の行数 | 「3 行のみ」 | — | — | — | — | 実際は `email { nil }` を含む 7 行 | **R-grok が正しい** |
| 34 | プロバイダの verified メール | 運用注意（2FA） | 人間確認事項 | **課題として指摘** | 運用注意止まり | **gem が verified のみ採用と確認** | 課題（運用で確認） | **R-gpt が正しい。** google_oauth2 1.2.2 は `verified_email`、omniauth-github 2.0.1 は `primary && verified`（upstream 確認）。gem バージョン依存なので ADR に記録 |

---

## 付録: 実装チェックリスト

- [ ] `session[:auth_provider]` を `reset_session` の**後**に設定している
- [ ] `User#admin?` が ENV 由来の許可リストと `auth_provider` だけを見る（`params` / クライアント入力を見ない）
- [ ] `admin_emails` が `.presence` で空文字要素を落とし、配列の `include?` で完全一致している
- [ ] `GET /admin/feedbacks` が `namespace :admin` 配下で `Admin::BaseController` を継承している
- [ ] 未ログイン 404 / 非管理者 404 / 許可リスト未設定 404 / GitHub ログイン 404 / partial request 404 の request spec がある
- [ ] レスポンスに `Cache-Control: no-store` が付いている（spec で固定）
- [ ] props が `created_at DESC, id DESC` 順・ホワイトリスト・ゲストは `sender: nil`・アカウント email 非露出
- [ ] 2 ページ目に最も古い行が出る spec がある（全件到達性）
- [ ] `page` の 0 / 負数 / 非数 / 過大値が正規化される
- [ ] 本文を HTML として出していない（`dangerouslySetInnerHTML` ゼロ、`mailto:` なし、Markdown なし）
- [ ] 日時が `Asia/Tokyo` 明示
- [ ] 未知の `category` が「不明」になる
- [ ] マイグレーションを増やしていない（`db/schema.rb` に差分なし）
- [ ] Header にプレイヤー向けの管理者リンクが無い / `inertia_share` に `admin` フラグを足していない
- [ ] `Rails.logger` に PII を出していない（監査ログは `user_id` と `page` のみ）
- [ ] `InertiaRails` の `encrypt_history = true` を外していない
- [ ] 本番手順（credentials `admin.emails` / `.kamal/secrets` / `deploy.yml` / `docs/deployment.md`）が揃っている（§4.8）
- [ ] `.github/workflows/ci.yml` に `ADMIN_EMAILS` を**足していない**（CI は未設定＝管理者ゼロを既定状態に保つ。§4.8）
- [ ] request spec / model spec が CI の env に依存せず、`around` で `ADMIN_EMAILS` を自前に組み立てている
- [ ] 開発者向けの `.env` 手順が `README.md` に書かれている（`.env.example` は存在しないので追記先にできない。§4.8）
- [ ] `CONTEXT.md` の「管理者」と ADR 0011 がある
- [ ] ADR 0011 の Consequences に「Gmail 前提が崩れたら `(provider, uid)` へ切り替える」の 1 行がある（§2.2）
- [ ] 既存 `spec/requests/feedbacks_spec.rb` が緑のまま

---

## 更新履歴

- **2026-09-02（初版）** — 計画 3 本とクロスレビュー 3 本を統合。争点 1〜6 を決着させ、未確認事項を §9 に列挙。
- **2026-09-02（確定版）** — リポジトリオーナーから最重要 3 点（ログインプロバイダ / アドレス種別 / 未ログイン時のレスポンス）の回答を受領。**3 点とも本計画の前提どおりで、設計判断の変更なし。** 条件付きだった記述を断定形に直し（§1 / §2.2 / §2.3 / §4.7 / §10）、`(provider, uid)` ピン留めの分岐を「Workspace へ移行した場合のみ再検討」として §2.2 に集約、`ADMIN_EMAILS` の環境別設定手順を §4.8 として追加、§9 を「確認済みの前提」と「残っている未確認事項」に再構成した。
