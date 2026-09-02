# issue #26 実装計画レビュー（3案の突き合わせ）

対象: [#26 管理者用フィードバック閲覧ページを作る](https://github.com/e601201/jomo-karuta-typing-rails-app/issues/26)

レビュー対象（以下、著者名を伏せて **案 A / B / C** と呼ぶ。順序はファイル名の五十音でも優劣でもなく、単なるラベル）:

| ラベル | ファイル |
| --- | --- |
| 案 A | `docs/plans/issue-26-plan-opus.md` |
| 案 B | `docs/plans/issue-26-plan-gpt.md` |
| 案 C | `docs/plans/issue-26-plan-grok.md` |

レビュー方法: 3案が主張するコードベースの事実を、実ファイル（`app/`, `config/`, `db/schema.rb`, `spec/`, `Gemfile`, `package.json`, `vitest.config.ts`, `.github/workflows/ci.yml`, `.kamal/secrets`, `docs/adr/`, `CONTEXT.md`）と `gh issue view 26 / 7` の原文に突き合わせて検証した。Ruby 処理系がこの環境に無いため spec の実行はしていない（静的検証のみ）。

---

## 0. 結論（先出し）

- **総合1位は案 A。** これをベースにする。事実確認の精度、認可のフェイルクローズ設計、コミット分割の安全性、既存コード（`HistoriesController` / `History.tsx` / request spec の props ホワイトリスト）への追従度が最も高い。
- ただし **案 A には「issue 本文に書かれていない文言を issue の主張として引用している」という重い瑕疵がある**（§1.1）。また `Cache-Control` に関する記述が事実として誤っている。
- **案 B は個々のセキュリティ／テスト論点の解像度が最も高い**（Inertia partial request の認可テスト、`no-store`、決定的ソート、page 正規化）。ここは全面的に取り込む。一方で Capybara/Selenium の新規導入と、緑にならないコミット1がある。
- **案 C は最も短く読みやすいが、`sender` にアカウントの email を含める設計が PII 方針と自己矛盾**しており、しかもそれを spec の契約として固定してしまう。認可の負テストも 3案中で最も薄い。
- 3案そろって見落としている論点が 2 つある（§2.1 末尾、§3.1）。特に **認可の信頼根拠が「OAuth プロバイダが主張する email」1 点に集約されている**ことへの構造的な手当てが誰からも提案されていない。

---

## 1. 事実確認

### 1.0 3案が一致していて、かつ**正しい**事実

先に「争点ではなかった」ことを確定させておく。ユーザーからの依頼にあった「ERB か Inertia+React か」「system spec があるか」は、**3案とも実態を正しく認識している**。割れているのは事実認識ではなく、後述する *issue 本文への帰属* と *system spec を新設するか* である。

| 事実 | 実際 | 3案の記述 |
| --- | --- | --- |
| フロントは ERB ではなく Inertia + React | `app/views/` は `layouts/` と `pwa/` のみ。画面は `app/frontend/pages/*.tsx`（11 ページ + `auth/`） | A・B・C とも正しい |
| system spec / Capybara は存在しない | `spec/` は `channels / factories / models / requests` のみ。`Gemfile` に capybara / selenium なし。`config/application.rb:40` で `config.generators.system_tests = nil` | A・B・C とも正しい |
| 「ブラウザで触るテスト」の代替は Vitest | `vitest.config.ts` に happy-dom + `app/frontend/test/setup.ts` + `@testing-library/react` が完備。spec は 16 本（components 5 / features・stores・lib 11） | A・B・C とも正しい |
| `feedbacks` に既読・対応済み列は無い | `db/schema.rb:41-50` は `body / category / created_at / email / subject / updated_at / user_id` のみ | 3案とも正しい |
| ロール／管理者の概念はゼロ | `users` は `avatar_url / created_at / email / nickname / updated_at`。`admin` / `role` の実装ヒットなし | 3案とも正しい |
| `require_login` は 302 リダイレクト | `application_controller.rb:27-29` | 3案とも正しい |
| ページネーション gem 未導入 | `Gemfile` に pagy / kaminari なし | 3案とも正しい |
| 秘密情報は credentials → `.kamal/secrets` → ENV | `.kamal/secrets:8-18`、`config/deploy.yml:26-33` | 3案とも正しい |

**細かいが重要な補足（3案とも触れていない）**: `app/frontend/pages/` 配下に**ページ単位の Vitest spec は 1 本も無い**（spec があるのは `components/` と `stores/` と `features/`）。案 A と案 B が提案する `pages/admin/Feedbacks.spec.tsx` は「既存の流儀の踏襲」ではなく**この repo で最初のページ spec**になる。案 C だけがこの事実を明示している（「ページ単位の vitest は無い」）。難しくはない（`Header` が `usePage` を使うのでモックが要る程度）が、「手本がある」と言い切るのは正確でない。

### 1.1 案 A の事実誤認

| # | 案 A の記述 | 実際 | 影響 |
| --- | --- | --- | --- |
| A-1 | 「issue には『`app/views/feedbacks/`』とあるが、このアプリに ERB のフィードバック View は存在しない」（§1.1 見出し「issue 本文の前提とズレている点」） | **issue #26 の本文にも #7 の本文にも `app/views/feedbacks/` という文字列は存在しない**（#26 のコメントは 0 件）。#26 の「参考」が挙げるのは `app/models/feedback.rb` / `app/controllers/feedbacks_controller.rb` / `feedbacks` テーブル / enum だけ | **重い。** 存在しない引用に対する反論を節の見出しに据えており、計画書を読んだ人は「issue が間違っている」と誤って学習する。技術的な帰結（＝ Inertia で作る）は正しいので実装は壊れないが、計画書の信頼度を落とす典型的な捏造引用 |
| A-2 | 「issue の依頼にある『system spec』の役割は Vitest のコンポーネント spec が担う」（§5 冒頭） | issue #26 本文に system spec への言及は無い | 中。おそらく計画作成時のプロンプト由来の要求だが、issue の要求として書かれているため出所が追えない。結論（system spec を新設しない）は妥当 |
| A-3 | 「管理ページのレスポンスに `Cache-Control: no-store` を付けることを検討してもよいが、**Rails のデフォルトで `no-store` 相当（`no-cache`）になるため今回は追加しない**」（§6.2） | **誤り。** Rails が動的レスポンスに付ける既定は `Cache-Control: max-age=0, private, must-revalidate`。これは共有キャッシュを止めるだけで、**ブラウザのディスクキャッシュ／戻る操作での再表示は止めない**。`no-store` とは等価でない | **中〜重。** PII（フィードバック本文・返信先 email）の集約ページで、唯一の緩和策を誤った根拠で捨てている。案 B の `no-store` を必ず取り込む |
| A-4 | 「ADR 0002 の『装飾リーフは `__testmocks__` のスタブで越える』の精神に従い」（§5.3） | ADR 0002 は Svelte 時代（`routes/+page.svelte` / `goto`）の決定で、**`__testmocks__` ディレクトリは現リポジトリに存在しない**。案 A 自身が §1.7 で「0001-0003 は Svelte 時代のフロントテスト方針」と書いている | 軽。実装指針としては「`Header` をローカルにモックする」で足り、害は無いが自己矛盾 |
| A-5 | 「フォント指定は `History.tsx:9-10` の `SERIF` / `SANS` 定数」 | `History.tsx:9-10` は `SERIF` と **`MONO`**。`SERIF`/`SANS` の組は `Feedback.tsx` 側 | 軽微 |
| A-6 | 「`README:20` の記述は既存の齟齬」 | `cp .env.example .env` は README の 21 行目（20 行目は `bun install`）。**`.env.example` がリポジトリに無いという指摘自体は正しい**（`.gitignore:11` の `/.env*` が `.env.example` も無視する） | 軽微 |
| A-7 | 「本番は `config.cache_store` がコメントアウトのままでプロセスローカル」 | `production.rb:50` がコメントアウトなのは事実だが、Rails 8 の既定はファイルストア（コンテナローカル）。「プロセスローカル」は不正確 | 軽微（`rate_limit` を付けないという結論は妥当） |
| A-8 | props を `createdAt` / `totalCount` の camelCase で設計 | 手本と称する `HistoriesController` は `as_json(only:)` の **snake_case**（`game_mode` / `created_at`）。camelCase は `BattlesController` / `AchievementsController` の流儀 | 軽微。repo 自体が割れているので誤りではないが、「History をそのまま写す」という説明とは食い違う |

なお **A の行番号引用はサンプル約 20 箇所を検証して ±2 行以内で正確**だった（`application_controller.rb:7-17 / 21-25 / 27-29`、`user.rb:42-57`、`feedback.rb`、`db/schema.rb:21 / 41-50 / 120-127 / 131`、`histories_spec.rb:4-12 / 15-18 / 50-52 / 55-63 / 65-78`、`rails_helper.rb:27 / 44 / 59`、`Header.tsx` の `MenuItem`、`inertia_rails.rb:7` など）。事実誤認は上記の通り「コードベースの読み取り」ではなく「issue 本文の引用」と「Rails 既定挙動の思い込み」に集中している。

### 1.2 案 B の事実誤認・リスク

| # | 案 B の記述 | 実際 | 影響 |
| --- | --- | --- | --- |
| B-1 | 認可の許可リストを `Rails.application.credentials.dig(:admin, :emails)` から読む | **`config/master.key` はリポジトリに無く（`.gitignore:34` の `/config/*.key`）、CI の `backend_test` job にも `RAILS_MASTER_KEY` は渡っていない**（`ci.yml:91-97` の env は `RAILS_ENV` と `DATABASE_URL` のみ）。`config.require_master_key` は未設定＝false なので例外にはならず、credentials は空として読まれる（＝結果的にフェイルクローズは保たれる） | **中。** クラッシュはしないが、(1) 正常系 request spec は **必ず** credentials を stub しないと通らない、(2) master.key を持たない開発者・エージェントはローカルで管理者経路を再現できない、(3) 「ENV を 1 本足すだけ」の案 A / C に比べて開発体験が悪い。計画はこの制約に一言も触れていない。**長所もある**（`RAILS_MASTER_KEY` は既にコンテナへ注入済みなので `deploy.yml` / `.kamal/secrets` を触らずに済む）ので、トレードオフとして明記されるべきだった |
| B-2 | コミット1「routes、`Admin::BaseController`、credentials 設定、認可 request spec」で「許可 email の user だけが index action へ到達できる状態で request spec を緑にする」 | **この時点で `Admin::FeedbacksController` が存在しない。** `namespace :admin { resources :feedbacks, only: :index }` は未定義定数を参照し、ルーティング段階で例外→404 になる。したがって「管理者は 200」は緑にできず、逆に「非管理者は 404」は**コントローラが無いから 404**でも通る＝認可を検証していない偽の緑になる | **重い。** コミット分割の前提が崩れている。案 A / C のように「コントローラ＋最小ページ stub を同じコミットに入れる」が正しい |
| B-3 | コミット4で Capybara / Selenium を新規導入し、`spec/system/admin_feedbacks_spec.rb` を追加 | 技術的には可能（CI runner に Chrome はあり、`bin/vite build` も既に走っている）。ただし **この repo が意図的に持っていないテスト基盤**を、issue 本文が要求していない形で 1 画面のために持ち込むことになる。`config.generators.system_tests = nil` は generator 設定に過ぎない、という B の指摘自体は正しい | 中。スコープ過剰。ただし「XSS が文字列として表示されることをブラウザで確認する」という動機は正当なので、**Vitest のページ spec に降ろす**のが妥当 |
| B-4 | `filter_parameter_logging` に `:body` / `:subject` を追加 | 有効な改善だが、本 issue で作るのは **GET の一覧のみ**でリクエストパラメータに本文は来ない。効くのは書き込み側 POST `/feedback` のログ | 軽微（改善自体は取り込む価値あり。スコープの説明が混ざっている点だけ注意） |
| B-5 | `app/models/feedback.rb:4-5` を「本文は必須かつ最大1000文字」の根拠に引く | 実際は 5-6 行目が定数定義、19 行目が validation。同種の ±2〜4 行のズレが数箇所 | 軽微 |
| B-6 | 「`created_at` は JST 固定表示でよいか」を確認事項として提起 | **これは 3案で B だけが気づいた重要な指摘。** `config.time_zone` は未設定（＝ UTC）で、`created_at` は UTC の ISO 文字列として props に載る。`History.tsx` の `toLocaleString('ja-JP')` は**ブラウザのタイムゾーン依存**であり、`Badge`（`app/models/badge.rb:61-78`）だけが明示的に JST を使っている。ADR 0008 は「タイム（所要時間）」の表記規約で、タイムスタンプの TZ は規定していない | 正しい指摘。加点 |

### 1.3 案 C の事実誤認

| # | 案 C の記述 | 実際 | 影響 |
| --- | --- | --- | --- |
| C-1 | 「一覧で `includes(:user)` するなら、`has_many :feedbacks, dependent: :nullify` を同じ変更に含める」 | **因果が誤り。** `includes(:user)` は `Feedback#belongs_to :user`（`feedback.rb:3`）だけで成立し、`User#has_many :feedbacks` は不要。さらに **アプリにユーザー削除経路は存在しない**（`app/controllers` / `app/models` に user の `destroy` 呼び出しなし。`sessions#destroy` はログアウト）。FK 制約の存在（`add_foreign_key "feedbacks", "users"`）と、`User` に `has_many :feedbacks` が無いという指摘自体は正しい | **中。** 無関係なモデル変更を本 issue に混ぜ込む根拠になっている。退会フローを作るときの別 issue の話 |
| C-2 | 「（許可リスト外が直接 URL を叩く）これが issue 指定の『非管理者は 403/404』」 | **issue #26 本文にその指定は無い**（要判断として「認可モデル」を挙げているだけ） | 中。案 A-1 と同種の、存在しない要求の issue への帰属 |
| C-3 | 「ADR 0007 が『今いらないテーブルを持たない』方向であることとも逆行する」（ロール列の却下根拠） | ADR 0007 の主旨は「保存された解除と導出した解除が食い違う経路を構造的に排除する」。**既読フラグもロール列も導出不能な状態**なので、0007 をそのまま却下根拠に使うのは論理が飛んでいる。案 A はこの点を明示的に区別している（「0007 をそのまま持ち出すのは誤り」）ので、A の方が正確 | 軽〜中。結論（ロール列不要）は支持できるが根拠が弱い |
| C-4 | 「ページの vitest も、History / Feedback に page spec が無いので必須にしない」 | 前提（ページ spec が無い）は**正しい**。ただし `vitest.config.ts` に happy-dom / setup / testing-library が完備という事実を踏まえると、「基盤が無い」ではなく「まだ誰も書いていない」だけであり、コストの見積もりが過大 | 中（テスト計画の薄さに直結。§3.2 参照） |

---

## 2. 要判断 3 点の評価

### 2.1 認可モデル

3案とも **「OAuth ログイン済みユーザーのうち、サーバ側の email 許可リストに載る者」** を推奨。方向性は一致しており、私もこれを支持する。相違点は次の 3 つ。

| 論点 | 案 A | 案 B | 案 C |
| --- | --- | --- | --- |
| 許可リストの置き場 | credentials → `.kamal/secrets` → **ENV**、`User#admin?` が毎回 ENV を読む | **credentials を直接** `dig(:admin, :emails)` | credentials → ENV → **initializer で `config.x.admin_emails` にキャッシュ** |
| 判定の置き場 | `User#admin?`（モデル） | `Admin::BaseController`（コントローラ） | `User#admin?`（モデル）+ initializer |
| 未ログイン時の応答 | **404**（存在を伏せる） | **404** | **302 →`/auth/login`**（既存 `require_login` と揃える） |

**置き場の判断: 案 A / C の ENV 経由を採る。** 理由は B-1 の通り、credentials 直読みは CI にも開発者の手元にも鍵が無い状況で「テストでは常に stub、ローカルでは再現不可」を強いるから。既存の OAuth クレデンシャルと完全に同じ経路（`.kamal/secrets` に 1 行、`deploy.yml` の `env.secret` に 1 行）に乗るので、追加コストは低い。ただし B が指摘した「`RAILS_MASTER_KEY` は既に注入済みだから新しい deploy 変数は不要」という利点は本物なので、`docs/deployment.md` には「credentials に `admin.emails` を書き、`.kamal/secrets` で ENV に落とす」と両方の手順を明記する。

**判定の置き場: 案 A / C の `User#admin?` を採る。** `User#best_scores` / `User#badges` / `User#current_play_streak` と同じで、このコードベースはユーザー由来の派生値をモデルに置く流儀。model spec で境界（大文字小文字、空白、空リスト、部分一致しない）を単体で固定でき、request spec は HTTP の分岐だけを見ればよい二層構造になる。B のようにコントローラに正規化ロジックを埋めると、境界値テストが必ず HTTP を経由することになり重い。

**キャッシュの有無**: 案 C の initializer キャッシュ（`config.x.admin_emails`）は起動時に固定されるので、テストで差し替えたあと戻し忘れると**他の spec に漏れる**（グローバル状態）。案 A のように呼び出しのたびに `ENV` を読み、spec は `around` で `ENV` を退避・復元する方が事故が少ない。パフォーマンス差は無視できる（管理者ページの GET だけ）。

**未ログイン時の応答**: これは低リスクな趣味の問題だが、**404 で統一する案 A / B を推す**。理由は情報量ではなく（`/admin/foo` が 404 を返す以上、`/admin/feedbacks` が 302 を返せばそのパスの存在は漏れるが、それで得られるものは攻撃者にほぼ無い）、**「管理者以外は `/admin/*` の存在を観測できない」という 1 本のルールにした方がテストしやすく、後続の実装者が崩しにくい**から。案 C の「運営者本人がログアウト状態でブックマークを開いたときログイン画面に行ける」という利便は本物なので、404 にするなら `docs/deployment.md` に「まず `/auth/login` でログインしてから `/admin/feedbacks`」と明記して補う。案 A がこの逸脱をコードコメントと未解決質問の両方に残しているのは good practice。

**非管理者（ログイン済み）への応答は 3 案とも 404 で一致**。これは正しい。403 は「ここに管理画面がある」と確定情報を返すうえ、このアプリには権限を申請する手段が無いので 403 の情報価値がゼロ。

#### 認可バイパス経路の検討（依頼された観点）

- **未設定時の挙動（フェイルオープン/クローズ）**: 3案とも「空なら誰も管理者にしない」でフェイルクローズ。**実装上の唯一の罠は `"".split(",")` ではなく `ENV["X"].to_s.split(",")` の結果に空文字列が残るケース**で、`[""].include?("")` が true になると「email が空のユーザー」が通る。`users.email` は `null: false` かつ unique なので実害は出にくいが、案 A だけが `filter_map { .presence }` と `ADMIN_EMAILS=" , "` の回帰テストまで書いており、ここは A が明確に最良。案 B は「設定が欠落／空なら誰も通さない」と方針は書くが空文字要素の話は無し。案 C は「空リストは fail closed」のみ。
- **大文字小文字**: 3案とも両辺 `downcase` で一致。案 A のみ「部分一致（文字列 `include?`）を絶対にしない」＝ `ADMIN_EMAILS=admin@example.com` に `evil-admin@example.com` が通る事故を明示的に禁じている。テストにも落としている。取り込む。
- **OAuth の email 検証**: ここが最大の穴。`User.from_omniauth`（`user.rb:42-56`）は **(b) 既存 Identity が無くても email が一致すれば既存ユーザーに新しい Identity を無条件で紐付ける**。つまり管理者権限の信頼根拠は「Google と GitHub の**両方**で、そのメールアドレスを他人が検証済みにできないこと」に完全に依存する。
  - 案 A はこの依存を最も詳しく書き（§6.3）、2FA 必須・GitHub 側も押さえる、という運用注意と ADR の Consequences 化まで提案している。
  - 案 B は人間確認事項として「provider が返す email が verified であることを運用上確認できるか」を挙げる。
  - 案 C は「OAuth が email を変えない前提」と 1 行触れるのみ。
  - **3案とも構造的な締め方を提案していない。** 後述の §3.1 で補う。
- **複数プロバイダのアカウント乗っ取り**: 上と同じ経路。加えて **3案とも触れていない**が、許可リストに載せた email の `User` 行がまだ存在しない場合、**そのメールで最初にログインできた者が自動的に管理者になる**（`from_omniauth` の (c) 分岐でユーザーが新規作成される）。管理者の「任命」が「先着でメールを証明した者」になる、というのは記述しておくべき性質。
- **クライアント入力からの昇格**: 3案とも「`params` / `session` に管理者フラグを置かず常に `current_user` から計算」で一致。`FeedbacksController:19-20`（`user_id` は session からのみ）と同じ原則。良い。
- **共有 props への漏れ**: 案 A のコミット6（任意）は `inertia_share` の `auth.user` に `admin` を足す案。入れるなら**全ページのレスポンスに管理者フラグが載る**ので、フロントの表示制御に使われて「フラグを消せば認可も消える」誤解を招きやすい。案 B / C は「Header にリンクを出さない」で一貫しており、こちらが安全。**初回は入れないことを推奨**。

#### 3案いずれも見落としている選択肢

1. **provider + uid のピン留め**（推奨: 少なくとも「プロバイダ限定」だけでも入れる）。`ADMIN_EMAILS` の一致に加えて `current_user.identities.exists?(provider: "google_oauth2")` を要求すれば、GitHub 側で当該メールを検証されるという経路が丸ごと閉じる。さらに厳密にやるなら許可リストを `google_oauth2:<uid>` の形にして email を判定から外す（email 変更・プロバイダ間衝突の両方に強い）。コストは条件 1 行 + テスト 1 本。**email 許可リストという結論は変えずに、信頼の幅だけ狭められる**ので費用対効果が高い。
2. **アプリの外で閉じる**（kamal-proxy / VPN / IP 制限）。単一 VPS・単一運営者という前提なら「そもそもアプリに認可を実装しない」も選択肢だが、`current_user` と結びつかず監査もできないので、3案が Basic 認証を却下したのと同じ理由で採らない。**言及が無いこと自体は減点にしない**が、統合案の Considered Options には 1 行残す価値がある。

### 2.2 ページネーション・カテゴリ絞り込み

| | 案 A | 案 B | 案 C |
| --- | --- | --- | --- |
| 取得 | 新しい順 **上限 100 件** + `totalCount` + 打ち切り表示 | **50 件/ページの offset ページネーション**（`page` を正規化・clamp） | 新しい順 **上限 200 件** + `totalCount` |
| 絞り込み | **クライアント側カテゴリタブ**（`Feedback.categories.keys` をサーバから渡す） | 見送り（クライアント絞り込みは「全件を絞った」誤認を生むため却下） | クライアント側タブ「入れてよいが必須ではない」 |
| ソート | `created_at: :desc` のみ | **`created_at: :desc, id: :desc`** | **`created_at desc, id desc`** |

**推奨は案 A をベースにしつつ、ソートは B / C の `id` タイブレークを必ず入れる。** 案 A のソートは同一秒に複数件が入ったとき順序が非決定になり、「新しい順」を主張する spec が偶発的に落ち得る。ここは A の明確な欠落。

案 B の offset ページネーションは「issue が言う『読む手段が `rails console` しか無い』を**完全に**解消できる唯一の案」であり、この論点は軽くない。上限方式は、上限を超えた古い行が**永久に console でしか読めない**という同じ問題を小さく再生産する。とはいえ:

- 公開フォームは `rate_limit 5/分` + honeypot 付きで、実件数は当面数十件のオーダー。上限 100〜200 に到達する前に「本当に必要な絞り込み・検索」の要件が見えてくる。
- 案 A は `totalCount > feedbacks.length` のとき打ち切りを画面に出すので、**取りこぼしが不可視にならない**（案 B が上限方式に対して挙げた懸念はここで潰れている）。
- `limit` を `limit + offset` に一般化するのは後から数十行。`RECENT_LIMIT` を定数のまま残しておけば移行も安い。

したがって「今はやらない、ただし到達不能な行が生まれた事実は画面に出す」という A の立て付けを支持する。**ただし統合案では「上限を超えたら次の issue で page を足す」を Consequences に明記すること**（案 A / C とも「そのときは別 issue」と書いてはいるが、トリガー条件＝`totalCount > RECENT_LIMIT` が実際に起きたら、を明示したい）。

カテゴリ絞り込みは **入れる（案 A）** を支持する。運営の実作業は「バグ報告だけ拾う」でありトリアージ単位がカテゴリだから。案 B の「クライアント絞り込みは全件を絞ったと誤認させる」という批判は正当なので、タブのラベルに**読み込み済み件数**を出し、打ち切り表示と併記して「いま画面にある N 件の中での絞り込み」だと分かるようにする（案 A の「各タブに件数を添える」で概ね解決している）。案 A の「カテゴリ一覧をサーバから props で渡す（フロントにハードコードしない）」は `AchievementsController` の `Badge::CATEGORIES` と同じ流儀で、正しい。

上限値は **100（案 A）** を推す。案 C の 200 は根拠が「ペイロードは小さい」だけで、1 画面で人が読み切れる量ではない。

### 2.3 既読 / 対応済みフラグ

**3案とも「持たない」で一致。全面的に支持する。** 論証の質は案 A が最も高い（issue のコアは読み取り手段の不在である／ADR 0004 の「UI にない設定フィールドを DB スキーマへ先取りしない」と同じ理由／後付けが安い＝`handled_at` nullable ならバックフィル不要で ADR 0005 が却下した移行問題は起きない、の 3 点）。加えて **ADR 0007（バッジは導出）をそのまま持ち出すのは誤りだと明示している**のは、案 C の C-3 と対照的に正確。

**3案とも見落としている中間案**: マイグレーション無しで「前回見た位置」を示す方法がある。管理者のセッション（または `localStorage`）に最終閲覧日時を保存し、それより新しい行に「NEW」を出すだけなら、スキーマも更新エンドポイントも CSRF も要らず、「どこまで読んだか」の実用上の 8 割が埋まる。1 人運用なら十分で、`handled_at` の要否をもう一段先送りできる。統合案では「Considered Options に入れる／初回は入れなくてよい」程度で扱えばよい。

---

## 3. 各案の穴

### 3.1 セキュリティ

| 観点 | 案 A | 案 B | 案 C |
| --- | --- | --- | --- |
| XSS | `dangerouslySetInnerHTML` 禁止 + `whitespace-pre-wrap` + **Vitest に回帰テスト**（`<script>` が要素として現れないこと） | 同左 + **system spec で smoke** | 禁止方針のみ、回帰テスト無し |
| PII（アカウント email） | props に**載せない**（返信先はフォームの `email` 欄が正、と CONTEXT.md に紐づけて論証） | 載せない（「返信先を空にした送信者の意思を迂回しない」と明記） | **`sender: { id, nickname, email }` に載せ、nickname が無ければ画面に表示する** |
| props ホワイトリスト | request spec でキー集合を固定（`histories_spec.rb:50-52` と同形） | serializer で明示 + spec で非許可属性を検査 | `only` キーの契約を spec で固定（**ただし上記の email 込みで固定**） |
| キャッシュ | **`no-store` を誤った根拠で見送り**（A-3） | **`expires_now` + `Cache-Control: no-store`** | 言及なし |
| Inertia の履歴 | 言及なし | 言及なし | **`encrypt_history = true` に言及し、外さないと明記**（`inertia_rails.rb:5`。事実として正しい） |
| ログ | `:email` は params フィルタ済み・**レスポンスボディや `Rails.logger.info` には効かない**と正しく区別。デバッグログ禁止 | `:body` / `:subject` をフィルタに追加（write 側への波及）+ **収集先の保持・アクセス権も運用確認**という指摘 | `:body` 未フィルタの事実を挙げつつスコープ外に整理 |
| CSRF | GET のみなので不要、将来の PATCH では既存機構に乗せる、と明記 | 言及あり（更新経路を作らない） | 実質言及なし（更新経路が無いので実害なし） |
| N+1 | `includes(:user)` + クエリ数を見るテストを任意で推奨 | `includes(:user)` | `includes(:user)` |
| 認可の単一関門 | `Admin::BaseController` 継承を必須化。`Api::` 側に管理者エンドポイントを作らない、まで明記 | 同左 + **Inertia partial request でも同じ before_action を通ることを spec で固定** | 同左 |

**案 C の `sender.email` は明確な設計欠陥。** CONTEXT.md「フィードバック」は「件名と返信先メールアドレスは任意」と定義しており、返信先を空にしたのは送信者の選択である。そこにアカウントの email を出すのは、その選択を迂回する。しかも案 C はこのキー集合を request spec の契約として固定するので、後から気づいて直す圧力が下がる。**統合案では必ず落とす。**

**3案そろって欠けているもの**:

1. **管理者アクセスの監査ログ**。「いつ誰が `/admin/feedbacks` を見たか」を `Rails.logger.info`（user id のみ、PII なし）で残すのは 1 行で、単一運営者でも「乗っ取られたか」を後から見る唯一の手掛かりになる。認可の信頼根拠が OAuth の email 1 点である（§2.1）以上、検知手段はあった方がよい。
2. **`no-store` と `encrypt_history` の両方を押さえた案が無い**（A は両方欠落、B は前者のみ、C は後者のみ）。PII ページの残留経路は「共有キャッシュ / ブラウザキャッシュ・戻る / Inertia の history state」の 3 つで、統合案では 3 つ全部を明示的に閉じる（うち 1 つは既定で閉じている）。

### 3.2 テスト計画の網羅性

**認可の負テスト**（最重要）:

| ケース | A | B | C |
| --- | --- | --- | --- |
| 未ログイン → 404（かつログイン画面へリダイレクト**しない**ことの明示） | ✅（存在を伏せる設計の回帰テストとして明記） | ✅ | ➖（302 を期待する設計なのでこの形では不要） |
| ログイン済み・許可リスト外 → 404 | ✅ | ✅ | ✅ |
| **許可リスト未設定でも 404（フェイルクローズの回帰）** | ✅ | ✅ | ⚠️ model spec の「空リストなら false」のみ。**HTTP 層の回帰テストが無い** |
| 空文字・空白のみの設定でも一致しない | ✅（`" , "` まで） | ➖ | ➖ |
| 部分一致しない（`evil-admin@…`） | ✅（明文の禁止 + テスト） | ✅（「部分一致しない」を明記） | ➖ |
| **Inertia partial request（`X-Inertia-Partial-*`）でも認可が先に走る** | ➖ | ✅ **B だけ** | ➖ |
| 他人のフィードバックも見える（`histories_spec.rb:55-63` の逆向き契約） | ✅ | ✅ | ✅ |
| props キーのホワイトリスト一致 | ✅ | ✅ | ✅（ただし email 込み） |
| 打ち切り / 総件数 | ✅ | ✅（page 正規化まで） | ✅ |
| XSS の回帰（本文が要素として解釈されない） | ✅ Vitest | ✅ system spec | ❌ 無し |
| 空状態・タブで 0 件 | ✅ Vitest | ✅ page spec | ❌（「必須にしない」） |

**案 A が最も厚く、案 B が僅差、案 C が明確に薄い。** 案 C はページの Vitest も system spec も両方見送るので、**UI の退行を止める自動テストがゼロ**になる（「テーブル列を落とす程度」と書いているが、XSS の回帰やゲスト/ユーザー表示の分岐は props の spec では捕まらない）。

案 B の system spec 導入は §1.2 B-3 の通りスコープ過剰だが、**目的（危険な文字列がテキストとして表示されることを実物で確認）は正当**なので、案 A の Vitest 回帰テストに統合する。案 B 自身が「React の escaping を再実装してテストしない」と書いているのは正しい姿勢で、見るべきは「`dangerouslySetInnerHTML` を使っていないこと」の代理としての描画結果。

案 B の **`page` パラメータ正規化テスト（0 / 負数 / 文字列 / 過大）** は、ページネーションを採らない統合案では不要になる。

### 3.3 コミット分割の安全性

| | 評価 |
| --- | --- |
| 案 A | **最良。** 1: `User#admin?` + model spec（画面が無いので挙動不変）→ 2: routes + `Admin::BaseController` + controller + **最小 TSX** + request spec → 3: 画面本実装 + Vitest → 4: デプロイ設定/ドキュメント → 5: CONTEXT.md + ADR。各時点で緑になり、**認可の無いページが公開される瞬間が無い**（認可はページと同じコミット2で入る）。1 と 2 を分ける意図（認可判定だけを単独でレビューできる）も妥当 |
| 案 B | **コミット1が緑にならない**（B-2）。コミット4（Capybara 導入）を製品コードと分けているのは良い設計だが、そもそも導入自体が過剰。コミット5（コード変更なしの統合検証）は有用 |
| 案 C | 妥当。コミット2で「ページファイルが無いと開発サーバでは壊れるので stub を置いてもよい」と**任意**にしているのが弱い。**必須**にすべき（`render inertia: "admin/Feedbacks"` に対応する tsx が無いと、request spec は通っても実ブラウザで壊れる＝コミット2時点は「緑だが動かない」） |

3案とも「認可が無い状態でページだけ先に出る」順序にはなっていない。ここは全案合格。

### 3.4 スコープの妥当性

- **案 A**: ほぼ適正。`CONTEXT.md` への「管理者」追加と ADR 0011 は、`AGENTS.md` / `docs/agents/domain.md` が明示する repo のルール（「用語集に無い概念を output で名指しするのはシグナル」「ADR で決定を残す」）に沿っており、スコープ内と見るべき。任意コミット6（ヘッダー導線）は入れないのが正解で、A 自身も「先送り可」としている。`.kamal/secrets` / `deploy.yml` / `docs/deployment.md` / `README` の更新は**必須**（入れないと本番で誰も管理者になれない 404 のままになる）で、これを独立コミットにしているのは良い。
- **案 B**: Capybara/Selenium + CI の browser 保守が過剰。offset ページネーションも「今は要らない」寄り（ただし §2.2 の通り主張自体は筋が通る）。一方 **`CONTEXT.md` の用語追加にも ADR にも触れていない**のは、この repo の規約に照らして不足。
- **案 C**: `has_many :feedbacks, dependent: :nullify`（C-1）が本 issue と無関係。`CONTEXT.md` 用語追加・ADR を「任意」に落としているのも規約に対して弱い。逆に UI テストを一切書かないのは不足。

### 3.5 実装のしやすさ（既存の流儀への追従度）

- **案 A** が最も高い。`HistoriesController`（`limit` + 総件数 + `recentLimit` props）と `History.tsx`（クライアントタブ・空状態・打ち切り表示・`toLocaleString('ja-JP')`）をそのまま写せる形に落としており、新しい設計判断がほぼゼロ。`pages/auth/Login.tsx` という既存のサブディレクトリ前例を根拠に `pages/admin/Feedbacks.tsx` を置くのも正しい。ログインヘルパを `feedbacks_spec.rb:7-14` から写す指示も具体的（`spec/support/**` の自動 require がコメントアウトのままである事実まで押さえている）。
- **案 B** は serializer / pagination / TZ 明示など「正しいが新規」の判断が多く、実装者が既存コードを参照して迷わない度合いでは A に劣る。ただし `Intl.DateTimeFormat` で `Asia/Tokyo` を明示する提案は、`config.time_zone` 未設定（UTC）という事実に照らすと **A / C の `toLocaleString('ja-JP')` 素通しより正確**。
- **案 C** は方針の粒度は適切だが、props 契約が疑似コードで型やキー命名（snake / camel）が確定していない。付録のチェックリストは実装者に渡す成果物として実用的で、これは取り込む価値がある。

---

## 4. 判定

### 総合順位

1. **案 A（`issue-26-plan-opus.md`）— ベースにすべき 1 本**
2. 案 B（`issue-26-plan-gpt.md`）
3. 案 C（`issue-26-plan-grok.md`）

**A を選ぶ理由**: 認可のフェイルクローズ（空文字要素・部分一致・未設定）を唯一きちんと詰めており、テスト計画の負テストが最も厚く、コミット分割が各時点で緑かつ「認可の無いページが露出しない」。既存コードの参照が具体的で正確（サンプル約 20 箇所の行番号が ±2 行以内）、`CONTEXT.md` / ADR という repo 規約への対応も含んでいる。**A の瑕疵（issue 本文の捏造引用、`no-store` の誤り、ソートのタイブレーク欠落）はいずれも局所的で、B / C から機械的に補える。** 逆に B の欠陥（緑にならないコミット1、テスト基盤の新規導入）と C の欠陥（アカウント email の露出、UI テストゼロ）は、計画の骨格に近い場所にある。

### 他案から取り込むべき具体的要素

**案 B から（優先度順）**

1. **`Cache-Control: no-store`（+ `expires_now`）を `Admin::BaseController` に入れる。** A の「Rails 既定で no-store 相当」は誤り（A-3）。
2. **決定的ソート `order(created_at: :desc, id: :desc)`。** A のソートは同一 `created_at` で非決定。
3. **Inertia partial request（`X-Inertia-Partial-Data` / `X-Inertia-Partial-Component` ヘッダ付き）でも認可の `before_action` が先に走ることの request spec。** 3案で B だけが挙げた経路。
4. **`raise ActionController::RoutingError` ではなく `head :not_found`。** A の raise でも request spec は 404 になる（`test.rb:26` の `show_exceptions = :rescuable` + `rescue_responses`）が、本番では認可拒否のたびに例外がログに積まれる。将来エラートラッキングを入れたとき、URL 総当たりがそのままアラートになる。`head :not_found` の方が安く、意図も読みやすい。
5. **日時は `Intl.DateTimeFormat` で `Asia/Tokyo` を明示。** `config.time_zone` は未設定（UTC）で、`Badge` だけが JST を明示している現状に合わせる。
6. **`filter_parameter_logging` への `:body` / `:subject` 追加**（本 issue の GET には効かないが、write 側 POST `/feedback` のログに本文が残る問題の 1 行修正。別コミットに分けるか、別 issue に切る）。
7. **「画面を作っても誰も見に行かなければ #7 の見逃しリスクは残る」という指摘**を、未解決の疑問 or ADR の Consequences に残す。issue の出発点そのものなので、確認頻度の運用合意は成果物に含める価値がある。

**案 C から**

8. **`config.encrypt_history = true`（`inertia_rails.rb:5`）を外さないこと**を、セキュリティ注意点に明記する。PII ページの props が history state に平文で残らない現状を、将来の変更から守る。
9. **付録の実装チェックリスト形式**。実装エージェントへの引き渡しに実用的。
10. **`users` に `has_many :feedbacks` が無く FK があるため、ユーザー削除は将来 FK 違反になる**という指摘自体は正しい。**本 issue では入れない**（削除経路が存在しない・`includes(:user)` とは無関係）が、退会フローの別 issue として書き残す。

**取り込まないもの（明示的に却下）**

- 案 B の Capybara / Selenium 導入と `spec/system/`（スコープ過剰。XSS の実物確認は Vitest のページ spec に降ろす）。
- 案 B の credentials 直読み（CI に `RAILS_MASTER_KEY` が無く、master.key を持たない開発者がローカル再現できない）。ただし deploy 手順の記述は credentials 起点で書く。
- 案 B の offset ページネーション（初回は上限方式。`totalCount > RECENT_LIMIT` が実際に起きたら次の issue で足す、を Consequences に明記）。
- 案 C の `sender.email`（アカウント email の露出。CONTEXT.md の「返信先は任意」と矛盾）。
- 案 C の `has_many :feedbacks, dependent: :nullify`（本 issue と無関係）。
- 案 A の任意コミット6（`inertia_share` への `admin` フラグ追加とヘッダー導線）。全ページのレスポンスに認可情報を載せる利益が薄い。

**3案に無く、統合案で足すべきもの**

11. **管理者を「許可リストの email」かつ「特定プロバイダの Identity を持つ」に絞る**（例: `current_user.identities.exists?(provider: "google_oauth2")`）。`User.from_omniauth` の email 一致分岐（`user.rb:49`）に依存した権限昇格経路を、運用注意ではなくコードで閉じる。条件 1 行 + テスト 1 本。
12. **許可リストに載せた email の `User` 行がまだ無い場合、そのメールで最初にログインした者が管理者になる**という性質を ADR の Consequences に明記する。
13. **管理者アクセスの監査ログ**（`Rails.logger.info` に user id のみ。PII は載せない）。
14. **既読フラグの代替として「最終閲覧日時をセッション/localStorage に持ち、新着に NEW を出す」**をスキーマ変更なしの選択肢として Considered Options に残す（初回は実装しなくてよい）。
15. **props のキー命名を snake / camel のどちらかに決めて明記する。** repo が割れている（`HistoriesController` は snake、`BattlesController` / `AchievementsController` は camel）。一覧テーブルという用途では `History.tsx` に揃えるのが読み手に親切。

---

## 5. 統合案への引き渡しメモ（要約）

- 認可: `User#admin?` = ENV 由来の許可リスト（`downcase` + `strip` + 空要素除去、配列 `include?`）**かつ** 特定プロバイダの Identity を持つ。判定は 1 メソッド、関門は `Admin::BaseController#require_admin` のみ。未ログイン・非管理者とも `head :not_found`。`ADMIN_EMAILS` 未設定なら誰も管理者にならない。
- 取得: `Feedback.includes(:user).order(created_at: :desc, id: :desc).limit(100)`。props は `feedbacks`（`id / category / subject / body / email / created_at / sender{id,nickname}`）/ `totalCount` / `recentLimit` / `categories`。**アカウント email は載せない。**
- 画面: `app/frontend/pages/admin/Feedbacks.tsx`。`History.tsx` の骨格（ヒーロー・テーブル・クライアントタブ・空状態・打ち切り表示）。本文は `whitespace-pre-wrap` のテキスト。日時は `Asia/Tokyo` 明示。ヘッダーに導線を足さない。
- マイグレーション: **無し**（既読フラグ・ロール列とも見送り）。
- レスポンス: `expires_now` + `Cache-Control: no-store`。`encrypt_history` は現状維持。
- テスト: model spec（許可リストの境界・フェイルクローズ）/ request spec（認可マトリクス・partial request・props ホワイトリスト・並び・打ち切り・他人の分も見える）/ Vitest ページ spec（カテゴリラベル・ゲスト/ユーザー・空状態・タブ・打ち切り・**HTML 文字列がテキストとして出る**）。system spec は追加しない。
- ドキュメント: `.kamal/secrets` / `config/deploy.yml` / `docs/deployment.md` / `README.md` / `CONTEXT.md`（「管理者」）/ `docs/adr/0011`。
