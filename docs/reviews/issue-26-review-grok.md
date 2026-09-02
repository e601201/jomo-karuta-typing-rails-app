# issue #26 実装計画レビュー（3案）

対象:

- `docs/plans/issue-26-plan-opus.md`（以下 **計画 opus**）
- `docs/plans/issue-26-plan-gpt.md`（以下 **計画 gpt**）
- `docs/plans/issue-26-plan-grok.md`（以下 **計画 grok**）

レビュー基準は内容のみ。ファイル名のモデル名は識別子として使うが、著者推定は評価に使わない。コード参照は 2026-09-02 時点の `/workspace`（ブランチ `cursor/issue-26-multi-model-planning-9701`）と、`gh issue view 26` の現行本文に基づく。

---

## 1. 事実確認

### 1.1 先に結論: フロントエンドの認識は 3 案とも正しい

親タスクが懸念していた「ERB か Inertia + React か」について、**3 案は割れていない**。いずれも Rails + Inertia + React（`app/frontend/pages/*.tsx`）と述べており、これは事実と一致する。

実体:

- `app/views/` にあるのは `layouts/application.html.erb` / `layouts/mailer.*` / `pwa/manifest.json.erb` のみ。ページ本体の ERB は無い。
- `FeedbacksController#new` は `render inertia: "Feedback"`。画面は `app/frontend/pages/Feedback.tsx`。
- `Gemfile` に `inertia_rails` / `vite_rails`。`package.json` に `@inertiajs/react` / `react` / `vitest`。
- `app/frontend/pages/` に `History.tsx` / `Feedback.tsx` などがあり、`app/frontend/pages/**/*.spec.*` は **0 件**。Vitest の spec があるのはコンポーネント・ストア・lib（例: `BattleResult.spec.tsx`）に限る。

「system spec (Capybara) か Vitest か」は **現状認識では割れていない**。3 案とも `spec/system` 不在・Capybara / Selenium 未導入を認めている。割れているのは **この issue で Capybara を新導入するか** という方針だけである。

- 計画 opus / 計画 grok: 導入しない。UI は Vitest（opus）または開発サーバ目視（grok）。
- 計画 gpt: 導入する（ただし人間確認事項として縮退経路も書いている）。

### 1.2 issue #26 原文とのズレ（計画 opus が issue を誤引用している）

現行の issue #26 本文に **`app/views/feedbacks/` という文字列は無い**。参考欄は `app/models/feedback.rb` / `app/controllers/feedbacks_controller.rb` / `feedbacks` テーブル / enum のみ。テスト方針（system spec を含む）も issue は要求していない。先行 #7 も `Header.tsx` と Inertia の配線であり、ERB ビューは出てこない。

したがって計画 opus §1.1 の「issue には `app/views/feedbacks/` とある」と §5 の「issue の依頼にある system spec」は、**issue 原文の事実誤認**である。結論（ERB では書かない / Capybara を新設しない）自体は正しいが、根拠の帰属が違う。計画 gpt / 計画 grok はこの誤引用をしていない。

### 1.3 コードベース記述の正誤

以下、ファイルを読んで確認した。行番号の ±数行は「概ね正しい」とし、実装を誤誘導するものだけを誤認とする。

#### 3 案とも正しい（重要な一致）

| 事実 | 裏取り |
| --- | --- |
| ロール / 管理者の概念はアプリにもスキーマにも無い | `users` は `avatar_url / email / nickname / timestamps` のみ（`db/schema.rb`）。`app/` `config/` `spec/` に `admin` ヒットなし |
| `current_user` は `session[:user_id]`、`require_login` は `/auth/login` へ 302 | `application_controller.rb` |
| ログイン後は `root_path` へ飛び、元 URL へ戻す機構は無い | `sessions_controller.rb:17`。`return_to` / `stored_location` はリポジトリにゼロ |
| `User.from_omniauth` は (a) Identity (b) **email 完全一致**で既存 User に Identity を追加 (c) 新規 | `user.rb:42-56`。`find_by(email: email)` は **大文字小文字を区別する** |
| フィードバックはゲスト可、`user_id` は session からのみ、rate_limit + honeypot | `feedbacks_controller.rb` |
| `feedbacks` に既読・対応済み列は無い。index は `user_id` のみ | `schema.rb:41-50` |
| `User` は `has_many :feedbacks` を持たない。FK は `on_delete` 未指定（デフォルト Restrict） | `user.rb` / `schema.rb:131` |
| 一覧 UI の手本は `HistoriesController`（`limit(50)` + `as_json(only:)`）と `History.tsx`（クライアント `useState` タブ、打ち切り表示、空状態、`toLocaleString('ja-JP')`） | 該当ファイル |
| pagy / kaminari / capybara / selenium は `Gemfile` に無い | 全文検索 0 件 |
| `spec/support` の自動 require はコメントアウト | `rails_helper.rb:27` |
| `filter_parameters` に `:email` あり、`:body` / `:subject` なし | `filter_parameter_logging.rb` |
| CSP はコメントアウト | `content_security_policy.rb` |
| 秘密情報は credentials → `.kamal/secrets` → ENV | `.kamal/secrets` / `deploy.yml` |
| Inertia `encrypt_history = true`、`use_script_element_for_initial_page = true` | `inertia_rails.rb` |
| 認可の既存パターンは「未ログイン 302」（履歴）と「他人の資源 404」（API 部屋） | `histories_spec.rb:15-18` / `api_battle_rooms_spec.rb:113-118`。BattlesController は 404 ではなく **トップへ 302 + alert**（opus の引用は正しい） |

#### 計画 opus の誤認・過大解釈

1. **issue 本文の誤引用**（上述）。`app/views/feedbacks/` も system spec 要求も issue #26 に無い。
2. **`History.tsx:9-10` に `SANS` がある**と書いているが、そこにあるのは `SERIF` と `MONO` だけ。`SANS` は `Feedback.tsx:21-22`。フォント定数のコピー元を間違えると画面が微妙に崩れる。
3. **ADR 0004 を「UI にない列をスキーマへ先取りしない」一般原則として使う**のは類推である。0004 Consequences の原文は **ユーザー設定**（`user_settings` のフィールドと初回引き継ぎ）に限定される。既読フラグ見送りの結論は妥当だが、ADR 違反を理由にするのは正確ではない。
4. **「Rails のデフォルトで `Cache-Control: no-store` 相当になるため今回は追加しない」**は過信。本番 HTML GET に PII 向け `no-store` が自動で付く保証はコード上見当たらない。計画 gpt の明示設定の方が安全。
5. **`raise ActionController::RoutingError` で request spec が必ず 404 になる**は、`test.rb` の `show_exceptions = :rescuable` **かつ** `consider_all_requests_local = true` に依存する。テストでは DebugExceptions の診断 HTML 404 になりやすく、Inertia matcher との相性も `head :not_found` より不安定。既存の 404 は API が `status: :not_found` を明示している。ここは計画 gpt / grok の `head :not_found` の方が既存流儀とテスト容易性に合う。
6. factory を「3 行（category / body / email）」と書いたが、実際は `email { nil }` を含む 7 行。中身の理解は正しい。

#### 計画 gpt の誤認・過大解釈

1. **`feedback.rb:18-25`** — ファイルは 24 行で終わる。validation は 18–23。微細。
2. **`db/schema.rb:40-49`** — `create_table "feedbacks"` は 41 行開始。微細。
3. **`Header.tsx:137-163`** — ゲストのフィードバック項目は 158–163。137 は TOP ページから始まるブロック全体。リンク自体の指摘は正しい。
4. **「generator の system_tests = nil は手書き system spec の実行禁止ではない」** — 文言としては正しいが、Capybara gem が無い以上 **実行不能** である。禁止されていないことと、基盤が無いことを同列に置くと、導入コストを過小評価する。
5. コミット 1 で「許可 email の user だけが **index action へ到達**できる」と書くが、同コミットの変更一覧に `Admin::FeedbacksController` が無い。ルートだけ生やすと未定義定数で 500 になり、404 の契約テストは成立しない。コミット分割の欠陥（後述）。

事実として正しいが方針として危険な記述（Capybara 新導入、credentials 配列をアプリから直接読む、など）は §3 で扱う。

#### 計画 grok の誤認・過大解釈

1. **ADR 0007 をロール列却下の根拠にするのは誤り。** 0007 はバッジ解除を `game_results` から導出する決定であり、「今いらないテーブルを持たない」一般原則ではない。ロール列を今作らない結論は妥当だが、引用が違う。
2. **「ページ単位の vitest は無い（spec があるのはゲーム部品・ストア）」** — ページ spec が 0 件なのは正しい。ただし spec は battle コンポーネント等にもある。これを根拠に **本ページの vitest を必須にしない**のは、History に無いから揃える、という判断であり、ゲスト入力の stored XSS 面を過小評価している。
3. **`application.css` の中身は計画 gpt 側の引用が正確**（Tailwind + forms / typography）。計画 grok は 1.4 で Inertia resolver を正しく `pages: '../pages'`（`inertia.tsx:14-15`）と取っている。
4. factory の `email { nil }`、`User` に `has_many :feedbacks` が無いこと、は正確で、3 案中ここを明示したのは計画 grok だけである。

### 1.4 ADR / CONTEXT.md との整合

`docs/adr/0001`〜`0010` と `CONTEXT.md` を通読した。

- **正面衝突する ADR は 3 案とも無い。** 0001–0003 は旧 Svelte ルートテスト、0004–0008 は設定・プレイ記録・バッジ・時刻表記、0009–0010 は対戦。
- 0008 はゲームの **秒.センチ秒 vs m:ss** であり、カレンダー日時の JST 固定とは無関係。計画 gpt の JST 明示は ADR 違反ではないが、`History.tsx` の `toLocaleString('ja-JP')`（`timeZone` なし）とは意図的にずらすことになる。
- `CONTEXT.md` に「管理者」は無い。「フィードバック」は 4 種類の単一非公開チャネル、返信先は **フォームの任意メール**、送信者はユーザーまたはゲスト。計画 opus が用語追加を計画に含めたのは `docs/agents/domain.md` に沿う。計画 gpt は用語追加に触れない。計画 grok は任意扱い。
- 計画 gpt が本文で多用する「運営者」は、CONTEXT のフィードバック定義（「運営へ送る」）と矛盾しない。ロール名として固定するなら opus 案の「管理者」の方が glossary 向き。

---

## 2. 要判断 3 点

### 2.1 認可モデル

3 案とも **「既存 OAuth + email 許可リスト」を推奨し、ロール列も HTTP Basic も今は作らない**。少人数・マイグレーション無し・新しい認証経路を増やさない、という理由は妥当。ここは一致でよい。

実装の差が品質を分ける。

| 項目 | 計画 opus | 計画 gpt | 計画 grok |
| --- | --- | --- | --- |
| 判定の置き場 | `User#admin?` + `User.admin_emails`（リクエスト時に ENV を読む） | コントローラが `credentials.dig(:admin, :emails)` を照合。**モデルメソッド無し** | `User#admin?` + boot 時 initializer が `config.x.admin_emails` |
| 設定の運び | credentials 文字列 → `.kamal/secrets` → `ADMIN_EMAILS`。開発は `.env` | credentials の **配列をアプリが直接読む**。新 ENV 不要 | opus と同型（credentials → ENV）。開発は `.env` |
| 未ログイン | **404** | **404** | **302 `/auth/login`**（`require_login` を先に付ける） |
| ログイン済・非管理者 | 404 | 404 | 404 |
| 未設定 | フェイルクローズ | フェイルクローズ | フェイルクローズ |
| 正規化 | 両辺 downcase + strip、空要素 drop、**部分一致禁止を明記** | trim + lowercase の完全一致 | downcase + trim。部分一致テストは無し |

#### どれが最も妥当か

**許可リスト自体は 3 案共通で正しい。** 採用すべき HTTP 契約は計画 opus / gpt の **未ログインも非管理者も 404**。計画 grok の 302 は却下する。

理由:

1. **ログインは元 URL に戻らない。** `SessionsController#create` は常に `redirect_to root_path`。未ログインで `/admin/feedbacks` を開いて 302 されても、OAuth 後はトップに落ち、ブックマーク再開にならない。計画 grok が 302 に払う「運営者の利便」は、このアプリの OAuth フローではほぼ得られない。
2. **302 は存在オラクルになる。** 未ログイン 302 → ログイン後 404 という二段は、パスが実在することだけを教え、非管理者には不親切でもある。隠すなら両方 404、親切にするなら return URL 付き 302 + 403。中途半端な 302+404 が一番弱い。
3. **403 より 404。** プレイヤー向けに管理 URL を広告しない。推測可能な `/admin/feedbacks` に対する効果は限定的だが、`require_login` に「揃える」事故を防ぐコメントを残す opus の判断は妥当。403 は REST 的には正しいが、このアプリに 403 の前例は無く、得る情報は「権限不足」だけで、運営者 UX も大差ない。

#### フェイルオープン / フェイルクローズ

3 案とも空・未設定は拒否で正しい。実装時の落とし穴:

- `ENV["ADMIN_EMAILS"].to_s.split(",")` の空文字残り。opus の `filter_map { ... .presence }` が最も明示的。
- 文字列に対する `include?`（`evil-admin@example.com`）。opus が警告し、gpt が request spec で「部分一致しない」と書く。grok は配列比較にしているが回帰テストが薄い。
- 計画 gpt が credentials を YAML **配列**で持つ案と、opus / grok が `credentials:fetch` で ENV に載せる案は **格納形式が非互換**。`credentials:fetch` はスカラー向け（既存の `google.client_id` と同型）。配列を fetch して ENV に入れると `["a@x.com", "b@x.com"]` のような `to_s` になり、許可リストが壊れてフェイルクローズ（誰も入れない）か、予期しない一致になる。統合するなら **credentials はカンマ区切り文字列**に固定し、Ruby 側で split する。

ローカル DX は **既存 OAuth と同じ `.env` + 本番は credentials → ENV**（opus / grok）。計画 gpt の「新 secret 変数不要」は `RAILS_MASTER_KEY` があるという意味では正しいが、開発者が `credentials:edit` しないと管理画面を開けず、request spec での stub も credentials の方が重い。`config.x`（grok）はテストで差し替えやすいが、このアプリに `config.x` の前例は無く、必須ではない。**seam は `User#admin?` 1 箇所**（opus / grok）を採る。コントローラ直読み（gpt）は正規化ロジックの単体テストが request spec に押し込まれ、将来の管理画面追加時にコピーされやすい。

#### 認可バイパス（厳しめ）

コードに入れる許可リストだけでは、次が残る。3 案とも程度の差はあれ言及しているが、**コードで塞ぐ案はどれも無い**。

1. **`User.from_omniauth` の email 合流（経路 b）。** Google で作った管理者 User に、同じ email の GitHub を後から紐付けられる。メールボックスを取られれば管理者セッションを取られる。opus が 2FA と両プロバイダ占有を `deployment.md` に書くのが最も具体的。gpt は「人間確認」、grok はアカウント識別子であることまでで、乗っ取り経路としての接続が弱い。
2. **プロバイダの email 検証フラグを見ていない。** `omniauth.rb` は Google / GitHub（`user:email`）だけで、`email_verified` を見ていない。未検証メールを返すプロバイダ設定があると、経路 b が本物の合流になる。全ログインで検証済みメールだけ受け取るのは本 issue のスコープを超えうるが、ADR の Consequences には書くべき。3 案とも「運用で確認」止まり。
3. **email の大小文字。** `users.email` の unique は PG デフォルトで大小区別。`from_omniauth` の `find_by(email:)` も区別する。一方 `admin?` は downcase する（opus / grok）。同じメールボックスが大小違いで **別 User 二つ**になり、両方 `admin? == true` になり得る。乗っ取りというよりアカウント分裂。許可リスト比較と OAuth 合流の正規化が揃っていないことを、3 案とも書いていない。
4. **クライアント起因の管理者フラグ。** 3 案とも「params / session に置かない」。opus の任意コミット 6 だけが `inertia_share` に `admin` を足す。これは認可 bypass ではないが、全ページの JSON に管理者否かが乗る。見送りでよい。
5. **フェイルオープンの設定ミス。** 開発 `.env` を本番イメージに焼かない、デフォルト空、テスト後に `config.x` / ENV を空に戻す。opus と grok がテストで固定する。gpt も credentials stub で固定する。

**見落としている選択肢:** IP 制限や Basic の併用は不要。代わりに、(a) OAuth 側で verified email のみ、(b) email の case-fold を `from_omniauth` と `admin?` で揃える、は許可リストより根の対策になる。本 issue で (a)(b) までやるかは別判断として人間に聞く価値がある。閲覧ページ側の最低ラインは「`User#admin?` + 未設定フェイルクローズ + 未ログイン/非管理者とも 404 + 部分一致しない」。

### 2.2 ページネーション・カテゴリ絞り込み

| | 計画 opus | 計画 gpt | 計画 grok |
| --- | --- | --- | --- |
| 推奨 | 上限 100 + **クライアント側カテゴリタブ** + 打ち切り表示 | **50 件 offset ページング、絞り込み無し** | 上限 200 + タブは任意（History コピー） |
| サーバフィルタ / gem | 見送り | 見送り | 見送り |

**最も妥当なのは計画 opus の「History と同型の上限 + クライアントタブ + 打ち切り明示」**に、計画 gpt の注意を注釈として足すこと。

- 公開フォームでも honeypot + 5 件/分で、当面は数十件が現実的。新 gem と query param 設計は過剰。
- 全件無制限（opus の却下案 A、grok の揺れ）は PII の JSON を無界に吐くので採らない。
- 計画 gpt の「クライアント絞り込みは今ページの 50 件にしか効かず、全件を絞ったように誤認する」は **正しい**。History で許せるのは「最近 50 プレイをモードで見る」が製品の意味だから。フィードバックで「バグ報告」タブが「最近 100 件のうちのバグ」であることは、打ち切り文言の隣に書くか、タブを初回から入れない。
- ただし gpt の offset ページングは、今の件数に対して URL・clamp・空ページ・Inertia `Link` のテストが増える。issue の「一覧」は最新順で読めれば足り、古い行は当面 console、でよい。ページングを先に入れるなら絞り込みもサーバ側にしないと gpt 自身の誤認指摘と矛盾する。

安定ソート `created_at DESC, id DESC` は gpt / grok が正しく、opus は `created_at` のみ。同時刻の tie は取り込み対象。

カテゴリラベルは、Achievements が `Badge::CATEGORIES` をサーバから渡す前例（`achievements_controller.rb:6-8`）と、Feedback フォームが TSX に 4 語をベタ書きする前例の両方がある。enum ドリフトを避けるなら opus（サーバから `Feedback.categories.keys`）。4 語固定なら grok の重複定義でも壊れない。

### 2.3 既読 / 対応済みフラグ

3 案とも **持たない（マイグレーション無し）**。同意する。

issue のコアは読み取り経路の不在。ワークフロー語彙を実運用ゼロで固定するのは早い。`handled_at` の後付けは NULL 初期化で足り、ADR 0005 が嫌った欠損バックフィル問題は起きない（opus の整理が最も正確。0007 を既読に直接適用しない、という注意も正しい）。

---

## 3. 各案の穴

### 3.1 計画 opus（`issue-26-plan-opus.md`）

**セキュリティ**

- XSS: React テキスト + `whitespace-pre-wrap`、vitest で `<script>` が要素化しないことを見る。3 案中いちばん具体的。
- PII: アカウント email を props に載せない。キーのホワイトリスト。ログに `feedback.body` を出さない。`:email` フィルタが params 限定であることの認識。いずれも良い。
- `mailto:` はモデルの `URI::MailTo::EMAIL_REGEXP` 頼み。空ならリンクを描かない、は必要。計画 gpt の「リンク化しない」の方が攻撃面は小さい。
- Cache-Control を省略したのは弱い（§1.3）。
- RoutingError より `head :not_found`（§1.3）。
- OAuth 合流と 2FA の運用注記は 3 案で最も良い。
- `robots.txt` に `/admin` を書かない判断は正しい（現行 `public/robots.txt` はほぼ空）。

**テスト**

- model: フェイルクローズ、空文字、大小文字、カンマ・空白。必須セットとして十分。
- request: 未ログイン 404（ログインへ飛ばないこと）、リスト外 404、未設定 404、他人分も見えること、ゲスト `user: nil`、アカウント email が混入しないこと。負テストが厚い。
- Inertia の `X-Inertia` 部分リクエストは gpt のみ。opus は欠けている。
- N+1 は任意。`includes(:user)` があるので実装すれば足り、クエリ数アサートは無くてよい。
- ページ vitest は History に前例が無い新規レイヤだが、本ページは匿名の自由入力を特権セッションで描くので、XSS 回帰として正当。Header を stub する方針は ADR 0002 の精神の類推として許容（0001–0003 を機械適用するのは opus 自身も Svelte 時代と認めている）。

**コミット分割**

- 1 は画面もルートも無く安全。
- 2 でコントローラ + **最小 TSX** を同時に置くのは正しい。Inertia コンポーネント欠落で開発サーバが死ぬのを避ける。この時点で `require_admin` が付くので、認可無し公開は起きない。
- 4 のデプロイ手順を別コミットにするのは良いが、マージ前に credentials へ値を入れる人間作業が残る。コードだけマージすると本番はフェイルクローズで 404 のまま。計画が「必須」と書いている通り。
- 任意のヘッダー導線（コミット 6）は **やらなくてよい**。shared props に `admin` を足すコストの方が大きい。

**スコープ / 流儀**

- CONTEXT.md + ADR 0011 を同一 PR に含めるのは domain.md に沿い、認可の後戻りを防ぐ。やや厚いが過剰ではない。
- factory トレイト、`categories` をサーバから渡す、打ち切り表示のコピー、は既存流儀への追従度が高い。
- `serialize` が `createdAt`（camelCase）なのに History の records は `created_at`（snake、`as_json`）。アプリは混在している（summary は camel、records は snake）。新規は History の行に合わせて snake にするか、明示的に camel に統一するか、計画が決めていない。実装者が割れる。

### 3.2 計画 gpt（`issue-26-plan-gpt.md`）

**セキュリティ**

- 未ログイン 404、アカウント email 非露出、`dangerouslySetInnerHTML` 禁止、allowlist 完全一致、Inertia 部分リクエストでも before_action、は強い。
- `Cache-Control: no-store` は本ページの PII に対して正しい。取り込むべき。
- `:body` / `:subject` を `filter_parameters` に足すのは **既存 POST `/feedback` の改善**で、本 GET には params で本文が来ない（grok が正しくスコープ外とした）。一行で安いので「ついで」は許容だが、コミットメッセージを一覧機能と混ぜない方がよい。
- email を `mailto:` しない判断は防御的で良い。
- OAuth 検証メールは「人間確認事項」に止まり、deployment.md への具体的手順が opus より薄い。

**テスト**

- request のページング境界・不正 `page`・部分一致しない・fail-closed は厚い。
- **XSS の自動テストが system spec 依存。** フロント spec は escaping を再テストしないと明言している。Capybara を人間が却下した瞬間、XSS 回帰が消える。計画 opus の vitest より脆い。
- model spec を足さないのは、認可ロジックをコントローラに置いた帰結。seam が弱い。
- Capybara / Selenium を Gemfile と CI に足すのは、このリポジトリ最大のスコープ膨張。CI の backend_test は Vite ビルド + `bundle exec rspec` のみ（`.github/workflows/ci.yml`）。headless Chrome の安定化は issue #26 の「console 以外の読み取り手段」を超える。質問 5 の縮退経路（page spec + request spec）を **本線にすべき**で、推奨側に Capybara を置くのは誤り。

**コミット分割**

- コミット 1 が routes + BaseController だけで FeedbacksController を後回しにすると、そのコミット単体では index の 200 も 404 契約も完結しない（未定義定数）。「各コミットで緑」と自己矛盾。
- コミット 4 の system spec を製品コードから分離しているのは、Capybara をやるなら正しい。やらないならこのコミットごと消える。
- 認可無しで一覧が公開される窓は無い（BaseController が先）。データリークという意味では安全。

**スコープ / 流儀**

- offset ページングは過剰（§2.2）。
- JST 固定は History と不一致。運営が日本前提なら害は小さいが、「既存を写す」コストを自ら捨てている。
- CONTEXT / ADR を書かない。認可モデルは一度決めると高いので、ここは opus / grok より弱い。
- ローカル `.env` の `ADMIN_EMAILS` が計画の主経路に無い。既存の OAuth 開発体験とずれる。

### 3.3 計画 grok（`issue-26-plan-grok.md`）

**セキュリティ（この案で実装すると実際に穴が開く）**

- **未ログイン 302 は採用しない**（§2.1）。存在漏洩があり、OAuth 後に元 URL へも戻らない。
- **`sender: { id, nickname, email }` は計画 opus / gpt が明示的に避けた PII。** CONTEXT.md 上の返信先はフォームの `email` 列。アカウント email を sender に載せるのは「ログイン送信でフォーム email が空だと連絡できない」問題への解だが、それは別の運用判断であり、デフォルトで JSON に出すべきではない。表示フォールバックも `nickname || sender.email` ではなく opus の `nickname || ユーザー #id`。
- XSS 方針（テキストノード、`pre-wrap`）は正しいが、**自動テストが無い**。History に page spec が無いことを理由に vitest を必須解除している。本ページの脅威モデルは History（自分のプレイ記録）と違う。
- `encrypt_history = true` を外さない、は 3 案でここだけが明示していて正しい。
- OAuth 合流をアカウント識別子として述べるが、管理者乗っ取り経路としての運用対策が opus より短い。
- 未知カテゴリを「不明」にするのは堅い。

**テスト**

- 未ログイン 302 を回帰テストにすると、404 方針へ直したときにテストごと捨てることになる。最初から 404 で書くべき。
- フェイルクローズの **HTTP** 回帰（許可リスト空のまま候補メールでログイン → 404）が表に無い。model の空リスト false だけでは、before_action の付け忘れを捕捉しない。
- 部分一致しないテストが無い。
- 公開 `GET/POST /feedback` の既存 spec を落とさない、は良い。

**コミット分割**

- 認可土台 → サーバ契約（stub ページ同時）→ UI → デプロイ配線、は安全。ルート公開と同時に `require_admin` が付く。
- コミット 1 に `has_many :feedbacks, dependent: :nullify` を混ぜるのは関心の混在。退会 UI は無く、`user.destroy!` は spec と console の話。FK Restrict の指摘自体は正しく、一覧の `includes(:user)` で幽霊 User を避ける意味もあるが、**別コミット（またはフォロー issue）** がきれい。

**スコープ / 流儀**

- History 踏襲と Capybara 拒否は流儀に最も近い。
- 上限 200 と「全件でも当面困らない」が本文内で揺れている。定数を一つに固定すること。
- ADR 0011 を「推奨するが本計画のファイル追加には含めない」は、実装 PR で忘れやすい。opus のようにファイル一覧へ入れるべき。
- `config.initializers/admin.rb` はファイルが増えるだけで、`User.admin_emails` で足りる。必須ではない。

---

## 4. 判定

### 総合順位

1. **計画 opus** — ベースにする
2. **計画 gpt**
3. **計画 grok**

計画 opus をベースにする理由: コードベースの骨格（Inertia、History 上限パターン、Vitest、credentials→ENV、`User#admin?`、Capybara を足さない）を正しく取り、認可の負テストと XSS 回帰とフェイルクローズを同一文書で完結させ、CONTEXT / ADR まで含めて後戻り点を固定している。issue 誤引用と RoutingError / Cache-Control の弱点はあるが、**書いてある通りに実装しても製品は概ね動く**。計画 gpt は Capybara とページングを本線に置くと issue がテスト基盤 ticket に化ける。計画 grok は 302 と sender.email が推奨案の中核に入っており、そのままだと認可の情報漏洩と PII 過剰露出が残る。

2 位を gpt にしたのは、Capybara を「質問 5 で縮退可」と自分で逃げを作っている一方、**404・アカウント email 非露出・no-store・部分一致テスト・Inertia 部分リクエスト**が推奨設計として正しいからである。計画 grok の History 踏襲は魅力的だが、セキュリティ契約が opus / gpt より弱い。

### 他案から取り込む具体的要素

ベースは計画 opus。次を上書き・追加する。

計画 gpt から:

- 非管理者応答は 404 で維持（opus と同じ。grok の 302 は捨てる）。
- `Cache-Control: no-store`（`expires_now` でも可）。opus §6.2 の省略を撤回。
- 並びは `created_at: :desc, id: :desc`。不正な page 正規化は、ページング自体を入れないので不要。
- request spec: 部分一致しないこと、Inertia の partial request ヘッダでも 404 になること。
- 本文・件名はリンク化 / Markdown 化しない（`mailto:` は任意だが、デフォルトは plain text）。
- クライアントタブは「今 props に載っている行」にしか効かない、と UI か打ち切り文言で明示する（タブを入れる場合）。入れない選択も gpt どおり許容。
- Capybara / Selenium / `spec/system` は **取り込まない**。gpt 質問 5 の縮退（request + ページ vitest）を本線にする。

計画 grok から:

- `has_many :feedbacks, dependent: :nullify` は **別の小さなコミット**で入れてよい。console で `user.destroy!` した瞬間に FK で落ちるのは本物の穴。退会 UI は今もスコープ外。
- `InertiaRails.encrypt_history` を外さない、をセキュリティ節に残す。
- 未知の `category` は生値を出さず「不明」。
- プレイヤー向け Header に管理者リンクを出さない（opus コミット 6 は行わない、で確定）。
- 開発確認手順（`.env` の `ADMIN_EMAILS` で `/admin/feedbacks` を直打ち）。
- 公開フィードバック spec の回帰をチェックリストに残す。

opus 自身の修正:

- issue に `app/views/feedbacks/` や system spec 要求が「書いてある」という叙述を捨てる。
- `require_admin` は `head :not_found`（または `render` 404）。RoutingError にしない。
- 行フィールドのキーを History に合わせて snake_case にするか、camelCase で統一するか決める（推奨: 行は `created_at` など snake、ページ全体の `totalCount` / `recentLimit` は既存 History と同じ camel 混在を踏襲してよい）。
- `sender` 相当は `{ id, nickname }` のみ。アカウント email は出さない。フォーム `email` が空の連絡手段は、未解決の疑問として人間確認（opus 質問 5）を残す。
- ADR 0004 は「類推」と書き、ユーザー設定 ADR の一般化ではないと明記する。
- OAuth の verified メールと `from_omniauth` の case-sensitive 一致は、ADR 0011 Consequences に書く。本 issue で `from_omniauth` を変えるかは人間確認。

やらないこと（3 案のスコープ外で一致しているもの、維持）:

- 既読フラグ、削除・返信、通知、ロール UI、プレイヤーメニューへの管理リンク、CSP 有効化。

---

## 付録: 統合時の認可契約（実装者が迷わないための要約）

```
GET /admin/feedbacks
  ADMIN_EMAILS 未設定・空 → 誰がログインしていても 404
  未ログイン → 404（/auth/login へ飛ばない）
  ログイン済・許可リスト外 → 404（本文・email を含まない）
  許可リスト内（大小無視・前後空白無視・完全一致） → 200 + inertia "admin/Feedbacks"
```

判定は `current_user.admin?` のみ。リストは配列の `include?`。公開 `FeedbacksController` に index を足さない。
