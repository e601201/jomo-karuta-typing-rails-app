---
issue: 26
author_model: claude-opus-5-thinking-max
kind: implementation-plan
---

# issue #26 実装プラン: 運営用フィードバック一覧ページ

## 0. 要約

`/feedback`（#7）で書き込み側は実装済みだが、`feedbacks` テーブルを読む手段が `rails console` しかない。読み取り側として `/admin/feedbacks` を新設する。

推奨アプローチは 3 つの判断からなる:

1. **認可は「メールアドレスの許可リスト」**。`users` にロール列は足さない。判定は `User#admin?` の 1 箇所に閉じ込め、許可リストは環境変数 `ADMIN_EMAILS`（本番は Kamal が Rails credentials から注入 = OAuth クレデンシャルと同じ経路）で与える。未設定なら誰も運営にならない（fail closed）。
2. **運営以外には 404**。ログイン有無に関わらず同じ 404 を返し、ページの存在自体を伏せる。
3. **絞り込み・ページ送りはサーバ側**。カテゴリ絞り込みとページ送りが互いに矛盾しない唯一の実装になる。既読フラグは今回入れない。

---

## 1. 問題定義

### 現状

- 送信経路（`GET/POST /feedback` → `feedbacks` テーブル）は #7 で完成している。ゲストも送れる。
- 読み取り経路が存在しない。運営が内容を見るには `bin/kamal console` で本番コンソールに入り `Feedback.order(created_at: :desc)` を打つしかない。
- #7 のグリルで「まずは保存のみ、DB を読む管理者ページは後日」と明示的に決めており、その際「送信されても誰も見に行かず埋もれる」リスクを承知で書き込み側を先行させた。本 issue はその負債の返済。

### ユーザー影響

一次利用者は運営（1 人想定）だが、影響を受けるのはフィードバックを送るプレイヤー側でもある。

- **運営**: SSH + 本番コンソールという心理的コストのせいで確認頻度が下がる。整形されていない ActiveRecord の inspect 出力は 1000 文字の本文を読むのに向かない。
- **プレイヤー**: フォームには「ご意見・ご要望をお聞かせください」「送信された内容はサービス改善のためにのみ利用されます」と書いてあるのに、実際には読まれない可能性がある。返信先メールを任意で書けるのに返信は届かない。この乖離が本 issue の実質的な損害。

### 受け入れ条件

- [ ] 運営が `/admin/feedbacks` を開くと、フィードバックが **新しい順**（`created_at DESC`）で一覧表示される。
- [ ] 各行に **カテゴリ / 件名 / 本文 / 返信先メール / 送信者（アカウント or ゲスト）/ 受信日時** が出る。
- [ ] 本文は改行を保って全文が読める（1000 文字でもレイアウトが壊れない）。
- [ ] **運営以外**（ゲスト・一般ログインユーザー）は 404。リダイレクトや「権限がありません」ではなく、存在を伏せる。
- [ ] 許可リストが**未設定・空**の環境では誰も運営にならない。
- [ ] 1 ページ 50 件、ページ送りで**全件に到達できる**。
- [ ] カテゴリ（4 種類）で絞り込める。絞り込みとページ送りが両立する（絞り込み後の件数でページが割られる）。
- [ ] 0 件のときは空状態が出る（エラーや空テーブルではない）。
- [ ] 既存の `/feedback`（送信フォーム）はゲストのまま使えて、挙動が一切変わらない。

### スコープ外

- **既読 / 対応済みフラグ**（マイグレーション + 書き込み経路 + UI 状態が必要。§4.6 で理由）
- **返信機能**（ActionMailer が未設定。SMTP クレデンシャルも無い）
- **新着通知**（メール・Slack・Web Push）
- **削除・エクスポート・全文検索・期間絞り込み・並び順の変更**
- **ロール管理 UI / 複数の権限レベル / 監査ログ**
- **運営向けの他のデータ画面**（ユーザー一覧、スコア管理、ランキングの手動削除など）
- **`feedbacks(created_at DESC)` のインデックス追加**（現状 `index_feedbacks_on_user_id` のみ。件数が数千を超えたら検討。前例: `idx_game_results_user_recent`）

### スコープの解釈（issue の記述からの差分）

| 項目 | issue の記述 | 本プラン | 理由 |
| --- | --- | --- | --- |
| 件名 (`subject`) | 表示項目に挙がっていない | **表示する** | フォームが受け取り DB に入っている値。出さないと `rails console` より情報が減る。issue の列挙は「最低限」と読む |
| 送信者 | 「`user` or ゲスト」 | **アカウントのニックネームとメールを出す**（ゲストは「ゲスト」チップ） | 運営が自分の受信箱として使う以上、誰からかが分からないと意味が薄い。返信先メールとアカウントメールは別物なので**別列にして明示的にラベル分けする** |
| ページ送り | 「要否を判断」 | **入れる** | 受信箱で古い行に到達できない = 埋もれる、という本 issue が潰したいリスクそのもの |
| カテゴリ絞り込み | 「要否を判断」 | **入れる（サーバ側）** | 実装コストが数行。ただしクライアント側フィルタは不可（§4.5） |
| 既読フラグ | 「持たせるか判断」 | **入れない** | §4.6 |

---

## 2. ドメイン用語との対応

### 既存の語（`CONTEXT.md`）

- **フィードバック** — 「プレイヤーがアプリ内フォームから運営へ送る連絡。バグ報告・機能リクエスト・使い方の質問・その他 の 4 種類を、種類を選んで 1 つのフォームで送る単一チャネル。（略）送信内容は公開されず、他のプレイヤーからは見えない」。本 issue は**この定義の「運営へ送る」の受け手側**を初めて実装する。「送信内容は公開されず、他のプレイヤーからは見えない」という既存の定義が、そのまま「運営以外に見せてはならない」という認可要件になっている。
- **ゲスト** — 「未ログインのプレイヤー」。送信者列でこの語を使う（「匿名ユーザー」「非会員」は Avoid）。
- Avoid 語の注意: **「お問い合わせ」「問い合わせ」はドキュメント・コードでは使わない**（`CONTEXT.md` の Avoid）。ただし `Feedback.tsx` の左パネル見出しは既に画面文言として「お問い合わせ」を使っているため、既存表示は触らない。新しいページの見出し・変数名では使わない。

### 新しく必要になる語（グロッサリの穴）

`CONTEXT.md` に「管理者」も「運営」も**項目としては無い**。ただし「フィードバック」の定義文の中で **運営** が既に使われている。ここは `docs/agents/domain.md` の言うところの「本当の穴」なので、実装と同時に glossary を更新する。

用語の選択に迷いがある。issue のタイトルは「**管理者**用フィードバック閲覧ページ」だが、glossary の本文は「**運営**へ送る連絡」。1 語 1 意味の原則から、どちらかに寄せる必要がある。

**推奨: 「運営」を正典にする。** 既存の glossary 本文がそう書いているのを後追いで壊すより、既に書かれている語を昇格させるほうが破壊が小さい。コード上の識別子（`admin?` / `Admin::` / `ADMIN_EMAILS`）は英語として自然な `admin` を使ってよい ——「不戦勝」の項が `walkover` について、「ルーム」の項が「部屋」について、既に同じ扱い（コード識別子と表示語の分離）を認めている。

追記案（`CONTEXT.md` の「### フィードバック」節に追加）:

```markdown
**運営**:
アプリを管理・改善する側の人。プレイヤーとは別で、フィードバックの唯一の受け手。
誰が運営かは許可リスト（メールアドレス）で決まり、プレイヤー向けの画面には一切現れない。
_Avoid_: 管理者（コード内の識別子 admin / Admin:: は可、ドキュメント・issue・画面文言では「運営」）、アドミン、モデレーター

**フィードバック一覧**:
運営だけが開ける、送られたフィードバックを新しい順に読むページ。既読・対応済みといった状態は持たない。
_Avoid_: 管理画面、ダッシュボード、受信箱、インボックス
```

> **ADR との整合**: 既存 ADR に矛盾するものは無い。ADR-0007（バッジは導出、テーブルを持たない）と ADR-0005（記録は保存する）の対比が「状態を持つべきか」の判断軸として効くので、既読フラグの見送り（§4.6）はその線上にある。

### ADR を 1 本書く

`domain-modeling` スキルの 3 条件で判定する:

1. **元に戻しにくいか** — △。`User#admin?` の実装差し替えで戻せるが、許可リストの ENV は本番の deploy.yml / .kamal/secrets / credentials に波及するので、剥がすと 3 ファイル + credentials 編集が要る。
2. **文脈なしに読むと驚くか** — ○。「Rails アプリなのに `users.admin` 列が無い」「認可が環境変数に書いてある」は、将来の読み手が必ず理由を探す。
3. **本当のトレードオフの結果か** — ○。ロール列 / Basic 認証 / 管理画面 gem という現実的な代替がある。

3 つとも満たすので **ADR-0011「運営の識別は許可リスト方式にし、ロール列を持たない」** を書く。404 で存在を伏せる判断も同じ ADR に含める（同じ決定の裏表なので分けない）。

---

## 3. 推奨アプローチ

### 3.1 全体像

```
ブラウザ ──GET /admin/feedbacks?category=&page= ──> Admin::FeedbacksController#index
                                                      │ before_action :require_admin
                                                      │   └─ current_user&.admin?  ← 認可はここ 1 点
                                                      │        └─ ENV["ADMIN_EMAILS"] の許可リスト
                                                      └─ Feedback.includes(:user)
                                                           .order(created_at: :desc, id: :desc)
                                                           .where(category:) / .offset.limit
                                                      ↓ Inertia props（ホワイトリスト済み）
                                                 app/frontend/pages/admin/Feedbacks.tsx
```

### 3.2 認可: メールアドレスの許可リスト

判定のインターフェースは **`current_user&.admin?` という述語ひとつ**にする。呼び出し側が知るべきことはこれだけで、以下はすべて `User#admin?` の内側に隠す。

- 許可リストの出どころ（環境変数）
- カンマ区切りのパース、前後の空白除去、空要素の除去
- 大文字小文字を無視した比較
- 未設定・空文字なら誰も真にならない（fail closed）

```ruby
# app/models/user.rb
# 運営（フィードバック一覧を読める人。CONTEXT.md「運営」）かどうか。
# 許可リストは ENV["ADMIN_EMAILS"]（カンマ区切り）。dev/test は .env、
# 本番は Kamal が credentials(admin.emails) から注入する（OAuth クレデンシャルと同じ経路）。
# 未設定・空なら誰も運営にならない（fail closed）。
def admin?
  return false if email.blank?

  self.class.admin_emails.include?(email.downcase)
end

# メモ化しない（プロセス内で ENV は変わらないが、テストが ENV を差し替えて実挙動を検証するため）
def self.admin_emails
  ENV.fetch("ADMIN_EMAILS", "").split(",").filter_map { |e| e.strip.downcase.presence }
end
```

なぜ環境変数か（credentials 直読みではなく）:

このリポジトリは既に **「アプリは常に ENV を読む / 本番だけ Kamal が credentials から ENV へ注入する」** という経路を OAuth で確立している（`config/initializers/omniauth.rb` は `ENV["GOOGLE_CLIENT_ID"]`、`.kamal/secrets` は `$(bin/rails credentials:fetch google.client_id)`）。credentials を直読みすると `config/master.key` を持たない開発クローンでページが開けなくなる（`config/*.key` は gitignore 済み）。既存経路に乗せるのが正解。

なぜ `env.clear` ではなく `env.secret` か: 運営のメールアドレスは厳密には秘密ではないが、`config/deploy.yml` は git に入るので、運営の個人メールをリポジトリに平文で置かないため。

### 3.3 運営以外の応答: 404

```ruby
# app/controllers/application_controller.rb（require_login の隣）
# 運営以外にはページの存在を伏せる。未ログインもログイン済み一般ユーザーも同じ 404。
def require_admin
  raise ActionController::RoutingError, "Not Found" unless current_user&.admin?
end
```

`require_login` のようにログインへリダイレクトすると「その URL は存在する」と教えてしまう。一覧にはプレイヤーのメールアドレスと自由記述が載るので、発見可能性を下げるコストがほぼゼロならそうする。`ActionController::RoutingError` は Rails の `rescue_responses` が 404 にマップし、本番では `public/404.html`、test 環境では `show_exceptions = :rescuable` により 404 レスポンスとして観測できる。

（`head :not_found` でも 404 は返せるが、ブラウザで直接叩いたときに真っ白になる。上記を推奨。）

### 3.4 一覧の取得

```ruby
# app/controllers/admin/feedbacks_controller.rb
module Admin
  class FeedbacksController < ApplicationController
    before_action :require_admin

    PER_PAGE = 50

    def index
      # 未知の値・未指定は「すべて」。enum のキー由来でホワイトリストし、生値を SQL に通さない
      category = Feedback.categories.key?(params[:category]) ? params[:category] : nil
      page = [ params[:page].to_i, 1 ].max

      scope = Feedback.includes(:user).order(created_at: :desc, id: :desc)
      scope = scope.where(category: category) if category
      total = scope.count

      render inertia: "admin/Feedbacks", props: {
        feedbacks: scope.offset((page - 1) * PER_PAGE).limit(PER_PAGE).as_json(
          only: %i[id category subject body email created_at],
          include: { user: { only: %i[id nickname email] } }
        ),
        # カテゴリの列挙はフロントにハードコードしない（#21 の Badge::CATEGORIES と同じ方針）
        categories: Feedback.categories.keys,
        category: category,
        page: page,
        perPage: PER_PAGE,
        total: total
      }
    end
  end
end
```

設計上の要点:

- **並び順は `created_at DESC, id DESC`**。`created_at` だけだと同一秒の行の順序が不定で、ページ境界で行が重複・消失する。`scores` のリーダーボードが既にタイブレークを明示しているのと同じ考え方。
- **`includes(:user)`** で N+1 を潰す。50 行 × 1 クエリになる。
- **props のホワイトリスト**は `HistoriesController` に倣う（`as_json(only:)`）。うっかり `Feedback` を丸ごと渡さない。
- **props の命名**は既存慣習に合わせる: 自前で組む値は camelCase（`perPage`）、`as_json` が生む行のフィールドは snake_case（`created_at`）。
- 認可はコントローラ 1 行（`before_action`）だけ。`Admin::BaseController` は作らない（サブクラスが 1 つしかない継承は Middle Man）。2 つ目の運営ページができた時点で抽出する。

### 3.5 画面 `app/frontend/pages/admin/Feedbacks.tsx`

`docs/design/design.pen` を検索したが、**管理者 / admin に相当するノードは無い**。デザインカンプが無いので、既存の語彙で組む:

- レイアウト骨格・テーブル・空状態・切り替えタブ → `History.tsx` を踏襲
- カテゴリの見せ方（4 種のラベル）→ `Feedback.tsx` を踏襲
- 配色トークン: 背景 `#0A1A35` / 枠 `#C9A961` / 強調 `#E5C875` / 本文 `#F5E9C8` / テーブルヘッダ `#132D57` / 赤 `#C8302A`、見出し Noto Serif JP・本文 Noto Sans JP、背景画像 `@/assets/images/background.webp`
- ヘッダー（`Header`）は他ページ同様に載せる

props の型:

```ts
type FeedbackCategory = 'bug_report' | 'feature_request' | 'usage_question' | 'other';

interface FeedbackRow {
	id: number;
	category: FeedbackCategory;
	subject: string | null;
	body: string;
	email: string | null; // 返信先（任意）— アカウントのメールとは別物
	created_at: string;
	user: { id: number; nickname: string | null; email: string } | null; // null = ゲスト
}

interface AdminFeedbacksProps {
	feedbacks: FeedbackRow[];
	categories: FeedbackCategory[];
	category: FeedbackCategory | null; // null = すべて
	page: number;
	perPage: number;
	total: number;
}
```

表示上の決めごと:

- **本文は `whitespace-pre-wrap break-words`** で改行を保つ。1000 文字が入る前提でセル幅を固定しない。「最初の N 行だけ表示 + 展開」は入れない（読むためのページで畳むのは本末転倒）。
- **返信先メールとアカウントメールは別列**にし、ラベルで区別する。取り違えると別人に返信する事故になる。
- **`dangerouslySetInnerHTML` は使わない。** 本文はプレイヤーの自由記述。React の既定エスケープに任せる。
- 返信先メールは `mailto:` リンクにしてよい（モデル側で `URI::MailTo::EMAIL_REGEXP` 検証済み）。
- **カテゴリタブ・ページ送りは Inertia の `<Link href="/admin/feedbacks?category=...&page=...">`** で組む。`Ranking.tsx` は `router.get` + `only:` の部分リロードを使っているが、ここでは使わない（§8 の回帰ポイント参照）。`Link` なら URL が状態を持つので、ブックマークもブラウザバックも素直に効く。

### 3.6 導線（ヘッダー）

`inertia_share` に `auth.is_admin` を足し、`Header.tsx` のログイン済みドロップダウンに「フィードバック一覧」を運営にだけ出す。

```ruby
auth: {
  user: current_user&.as_json(only: %i[id email nickname avatar_url created_at]),
  is_admin: current_user&.admin? || false
},
```

必須要件ではないが、**入れることを推奨**する。URL を覚えていないと見に行かない = 埋もれる、が本 issue の元凶なので、導線が無いと問題が半分しか解けない。運営以外には `false` が入るだけで、何も漏れない。

### 3.7 却下した代替案

**認可の置き場所**

| 案 | 却下理由 |
| --- | --- |
| `users.admin` boolean / `role` enum 列を足す | マイグレーション + セキュリティ上重要な列の追加に対して、得られるのは「デプロイなしで運営を増やせる」だけ。しかもロール付与 UI は作らないので、結局 `bin/kamal console` を叩く必要があり、コンソール依存は消えない。運営 1 人想定の現状では、ドメインモデルに「ロール」という概念を増やすコストが勝つ。将来必要になったら `User#admin?` の中身だけ差し替えれば済むように設計している |
| HTTP Basic 認証（`http_basic_authenticate_with`） | OAuth と並ぶ**第 2 の認証機構**を持ち込むのが最大の問題。`current_user` が立たないので Inertia の共有 props（ヘッダー・ベストスコア）がゲスト表示になり、ページだけ世界観から浮く。ブラウザ標準のダイアログはデザインと合わず、ログアウトもできない |
| メールドメインの許可（`@example.com` なら全員運営） | 個人開発でドメインを持っていない。Gmail アカウント運用と噛み合わない |
| `Rails.application.credentials` を直読み | `config/master.key` を持たない開発クローンで永久にアクセス不能になる。リポジトリ既存の「アプリは ENV を読む」経路からも外れる |
| 定数としてソースにハードコード | 運営のメールが git 履歴に永久に残る |
| `pundit` / `cancancan` などの認可 gem | 保護対象が 1 ページ 1 アクション。ポリシークラス機構は明らかに過剰 |
| `ActiveAdmin` / `Avo` などの管理画面 gem | 独自のアセットパイプライン・レイアウト・認証を連れてくる。Vite + Inertia 構成と衝突し、読み取り専用のテーブル 1 枚に対して依存が重すぎる |

**運営以外への応答**

| 案 | 却下理由 |
| --- | --- |
| `/auth/login` へリダイレクト（`require_login` と同じ） | URL の存在を教えてしまう。一覧の中身が PII なので、隠せるなら隠す |
| 403 + 「権限がありません」画面 | 同上に加えて、専用画面を 1 枚作るコストが要る |

**一覧の取得**

| 案 | 却下理由 |
| --- | --- |
| `History` 方式（最新 50 件だけ・ページ送り無し） | 履歴は「古い記録の価値が低い個人ログ」なので上限で足りるが、受信箱で 51 件目に到達できないのは、本 issue が潰そうとしている「埋もれる」そのもの |
| 無限スクロール | 実装量とテスト難度が上がるうえ、運営 1 人が読む画面に体験上の利点が無い |
| `kaminari` / `pagy` を導入 | `offset` / `limit` 数行で足りる規模。gem 追加は依存更新の面倒を恒久的に増やす |
| カーソル（keyset）ページング | この件数では `offset` の性能問題は発生しない。実装が複雑になるだけ |
| **クライアント側でカテゴリ絞り込み**（`History.tsx` のモードタブ方式） | サーバ側ページングと組み合わせると「現在ページの中だけ絞る」ことになり、件数表示と実際の結果が食い違う。`History` は上限 50 件・ページ送り無しだから成立していた前例であって、ここには持ち込めない |

**通知・状態管理**

| 案 | 却下理由 |
| --- | --- |
| 一覧ページを作らず、新着をメールで運営に飛ばす | ActionMailer が未設定（`config/environments/production.rb` の SMTP 設定はコメントアウト、credentials に SMTP 鍵も無い）。そもそも過去分を読み返せないので issue の要求を満たさない |
| 既読 / 対応済みフラグを今回入れる | §4.6 |

---

## 4. 変更するモジュールと責務の境界

| ファイル | 種別 | 責務 | 隠すもの / 出さないもの |
| --- | --- | --- | --- |
| `app/models/user.rb` | 変更 | `#admin?` — 「この人は運営か」を答える唯一の場所 | 許可リストの出どころ、パース、正規化、fail closed。**呼び出し側に「メールアドレスで判定している」ことを漏らさない** |
| `app/controllers/application_controller.rb` | 変更 | `require_admin` フィルタ（`require_login` の隣）／ `inertia_share` に `auth.is_admin` | 404 の出し方 |
| `app/controllers/admin/feedbacks_controller.rb` | 新規 | 一覧のクエリ（並び順・絞り込み・ページ）と props の組み立て | ActiveRecord のスコープ、ホワイトリスト外のカラム。**認可ロジックは持たない**（`before_action` 1 行だけ） |
| `config/routes.rb` | 変更 | `namespace :admin { resources :feedbacks, only: :index }` | — |
| `app/frontend/pages/admin/Feedbacks.tsx` | 新規 | 表示のみ。props をそのまま描く | ドメイン判断は持たない。絞り込み・ページの決定はサーバ |
| `app/frontend/lib/format-datetime.ts` | 新規（任意・推奨） | 「日時」の表示形式を 1 箇所に集約 | `toLocaleString` のオプション |
| `app/frontend/lib/feedback-categories.ts` | 新規（任意・推奨） | カテゴリのキー ↔ 日本語表示名の対応と型 | — |
| `app/frontend/components/layout/Header.tsx` | 変更（任意・推奨） | 運営にだけ導線を出す | — |
| `app/frontend/types/index.ts` | 変更 | `SharedProps.auth.is_admin` を型に足す | — |
| `CONTEXT.md` | 変更 | 「運営」「フィードバック一覧」の定義 | 実装詳細は書かない（glossary であって仕様書ではない） |
| `docs/adr/0011-*.md` | 新規 | 許可リスト方式と 404 の判断を残す | — |
| `docs/deployment.md` / `README.md` | 変更 | `ADMIN_EMAILS` の設定手順 | — |
| `config/deploy.yml` / `.kamal/secrets` | 変更 | 本番への `ADMIN_EMAILS` 注入 | — |

### 4.6 既読 / 対応済みフラグを入れない理由

- **ドメインモデルが変わる。** `CONTEXT.md` の「フィードバック」は現在「送る連絡」であって状態機械ではない。状態を足すと「未読 / 既読 / 対応済み」という語彙・遷移・誰が変えられるかを全部決める必要が出る。issue が「要判断」に置いているのは、まさにそこが軽くないから。
- **書き込み経路が増える。** 読み取り専用だった運営ページに POST/PATCH が生まれ、CSRF・楽観ロック・UI の楽観更新の話がついてくる。今回のスコープが 2 倍以上になる。
- **必要性の証拠がまだ無い。** 件数が 1 日 1 桁のうちは、新しい順に並んだ一覧を上から読めば足りる。ADR-0007（バッジは導出、テーブルを持たない）が示した「保存された状態と実際が食い違う経路を作らない」という判断の線上にある。

**将来入れるときの推奨**: boolean `read` ではなく **`read_at`（nullable timestamp）**。「いつ読んだか」から「読んだか」は導けるが逆は導けない。ADR-0008 の「情報を落とさない側を選ぶ」判断と同じ。

---

## 5. 実装ステップ（コミット単位）

各コミットは単体で CI が緑・アプリが動く状態を保つ。コミットメッセージはリポジトリ慣習（日本語・「〜する」）に合わせる。

### 準備（任意だが推奨・先にやると後の差分が素直になる）

**P1. `日時` 表記を `format-datetime.ts` に共通化する**

`History.tsx` の `formatDate`（年月日 + 時分）をそのまま `app/frontend/lib/format-datetime.ts` へ切り出し、`History.tsx` を差し替える。新ページはこれを import する。前例: コミット `80e2ba5`「PauseOverlay と Game の mm:ss 表記を format-clock.ts に共通化する」。呼び出し側が 2 つになる時点で切るのが「2 つ目で seam を作る」の実践。

> `Profile.tsx`（`toLocaleDateString` 既定）と `Achievements.tsx`（年月日のみ）にも日付整形があるが、**書式が違うので今回は触らない**。無理に 1 関数へ寄せると引数で書式を切り替える浅い関数になる。

**P2. フィードバックのカテゴリ表示名を `feedback-categories.ts` に切り出す**

`Feedback.tsx` が持つ 4 カテゴリの日本語ラベルと `FeedbackCategory` 型を `app/frontend/lib/feedback-categories.ts` へ移し、`Feedback.tsx` を差し替える。**アイコンと色は移さない**（フォームのボタン・情報パネル・一覧のチップで必要な見た目が違う。共有するのはラベルと型だけ）。

### 本体

**1. `CONTEXT.md` に「運営」「フィードバック一覧」を追加し ADR-0011 を書く**

- `CONTEXT.md`: §2 の追記案
- `docs/adr/0011-admin-identified-by-email-allowlist.md`: 許可リスト方式 / 却下案（ロール列・Basic 認証・管理画面 gem）/ 帰結（運営追加にデプロイが必要・fail closed・将来のロール列移行は `User#admin?` 1 箇所・監査ログ無し・非運営には 404）
- ドキュメントのみ。コード変更なし。

**2. `User#admin?` を追加する（許可リスト・fail closed・大文字小文字無視）**

- `app/models/user.rb` に `#admin?` と `.admin_emails`
- `spec/models/user_spec.rb` に `describe "#admin?"` を追加
- まだどこからも呼ばれない。挙動変化ゼロ。

**3a. `admin/Feedbacks.tsx` を追加する（一覧テーブルと空状態）**

- ページコンポーネントを完成形で追加（props 型・テーブル・空状態）。まだルートが無いので誰も到達しない = 壊れない。
- 絞り込みタブ・ページ送りはこの時点では置かない。
- `bun run lint` / `bun run check` が通ること。

**3b. `/admin/feedbacks` を新設して運営だけに見せる**

- `require_admin` を `ApplicationController` に追加
- `namespace :admin` のルートと `Admin::FeedbacksController#index`（並び順 + props、絞り込み・ページ無し）
- `spec/requests/admin/feedbacks_spec.rb`（認可 3 パターン・並び順・props ホワイトリスト・送信者の user / nil）
- **ここで受け入れ条件の中核が満たされる。**

**4. フィードバック一覧をカテゴリで絞り込めるようにする**

- コントローラにホワイトリスト付き `category` パラメータ、props に `categories` / `category`
- ページにタブ（`<Link>`）
- request spec に絞り込みケース（該当のみ・不正値は全件・件数が絞り込みに追随）

**5. フィードバック一覧にページ送りを付ける（50 件 / ページ）**

- コントローラに `PER_PAGE` / `offset` / `limit` / `total`
- ページに「全 N 件中 x–y 件」と前後リンク（絞り込みを保持したクエリを組む）
- request spec にページングケース（2 ページ目・範囲外ページ・絞り込みとの併用）

**6. ヘッダーに運営向けの導線を出す**

- `inertia_share` に `auth.is_admin`、`SharedProps` 型を更新
- `Header.tsx` のログイン済みドロップダウンに条件付きで「フィードバック一覧」
- request spec に「一般ユーザーでは `is_admin` が false」を 1 本

**7. `ADMIN_EMAILS` の設定手順を書き Kamal に配線する**

- `config/deploy.yml` の `env.secret` に `ADMIN_EMAILS`
- `.kamal/secrets` に `ADMIN_EMAILS=$(bin/rails credentials:fetch admin.emails)`
- `docs/deployment.md`「4. シークレットの設定」に `admin.emails` を追記
- `README.md` の開発セットアップに `.env` の `ADMIN_EMAILS` を追記（`.env.example` は `.gitignore` の `/.env*` に含まれていてリポジトリに存在しないため、README が実質の手順書になっている）

> **注意**: `.kamal/secrets` は `credentials:fetch` の失敗で非ゼロ終了するため、**credentials に `admin.emails` を入れる前にこのコミットをデプロイするとデプロイが落ちる**。credentials の編集（`bin/rails credentials:edit`、`config/master.key` 保持者のみ）を先に行う。

---

## 6. テスト計画

### どの層に何を置くか

| 層 | 何を守るか | ファイル | 近い前例 |
| --- | --- | --- | --- |
| モデル (RSpec) | 許可リストの意味論。認可の真実はここ 1 箇所 | `spec/models/user_spec.rb` | `spec/models/user_badges_spec.rb` |
| リクエスト (RSpec) | 認可の結果（404 / 200）、並び順、props 契約、絞り込み、ページ送り | `spec/requests/admin/feedbacks_spec.rb` | **`spec/requests/histories_spec.rb`**（`log_in` ヘルパー、`inertia.props` の検証、`records.first.keys` のホワイトリスト検証がそのまま使える） |
| フロント (Vitest) | 切り出した純関数のみ | `app/frontend/lib/format-datetime.spec.ts`（P1 を実施する場合） | `app/frontend/lib/data/karuta-cards.spec.ts` |
| 手動 | コンポーネント名とファイルパスの一致、見た目 | — | — |

**ページ本体（`.tsx`）の Vitest テストは追加しない。** 既存の `app/frontend/pages/*` には 1 つも spec が無く（spec があるのはコンポーネント・ストア・純関数のみ）、このページに固有ロジックはほぼ無い。ADR-0001〜0003 のルート統合テストは旧 SvelteKit 構成のもので、現構成には引き継がれていない。慣習に従う。

### モデル spec（`#admin?`）

ENV をスタブせず、実際に差し替えて実挙動を検証する。`spec/support` は `rails_helper` で読み込まれていない（glob がコメントアウト）ので、ヘルパーは spec 内に置く。

```ruby
def with_admin_emails(value)
  original = ENV["ADMIN_EMAILS"]
  ENV["ADMIN_EMAILS"] = value
  yield
ensure
  ENV["ADMIN_EMAILS"] = original
end
```

ケース:

- 許可リストに載っているメール → true
- 載っていないメール → false
- **未設定（nil）→ 誰も true にならない**（fail closed の要）
- **空文字 / `","` だけ → 誰も true にならない**（空要素にマッチしないこと）
- 大文字小文字が違う（`Admin@Example.com` vs `admin@example.com`）→ true
- カンマ区切りに空白がある（`"a@x.com , b@x.com"`）→ 両方 true
- 複数指定のうち 2 人目 → true

### リクエスト spec（`GET /admin/feedbacks`）

`histories_spec.rb` の `log_in` ヘルパーを踏襲（`OmniAuth.config.mock_auth` + `/auth/google_oauth2/callback`）。運営として入るときは許可リストに入れたメールでログインする。

認可:

- 未ログイン → 404
- ログイン済み一般ユーザー → 404
- 運営 → 200 かつ `render_component("admin/Feedbacks")`
- **`ADMIN_EMAILS` 未設定のとき、以前は運営だったメールでも 404**

一覧:

- 新しい順に並ぶ（`created_at` を明示的にずらした 3 件で検証）
- `created_at` が同一の 2 件でも順序が安定する（`id DESC` のタイブレーク）
- 行のキーがホワイトリストと一致（`match_array(%w[id category subject body email created_at user])`）
- ゲスト送信の行は `user` が nil
- ログインユーザー送信の行は `user` に `id / nickname / email` だけが入る（`avatar_url` などが漏れない）
- 0 件のとき `feedbacks` が `[]`、`total` が 0（例外にならない）

絞り込み:

- `?category=bug_report` → 該当行のみ、`total` も絞り込み後の件数
- `?category=bogus` / 未指定 → 全件（500 にならない）
- `categories` prop が `Feedback.categories.keys` と一致（フロントのハードコード防止）

ページ送り:

- 51 件作って 1 ページ目 50 件・2 ページ目 1 件
- `?page=0` / `?page=-1` / 非数値 → 1 ページ目として扱う
- 範囲外ページ（`?page=999`）→ 空配列、`total` は正しい、例外なし
- 絞り込みとページの併用

共有 props（ステップ 6）:

- 一般ユーザーで `auth.is_admin` が false（既存の `histories_spec` などの props を壊さないこと）

### 既存テストで守られること

`spec/requests/feedbacks_spec.rb` の先頭コメントが「`/feedback` に `require_login` を付けてはならない（`profiles_controller` を写して認証を足す事故を防ぐ回帰テスト）」と明示している。今回 `ApplicationController` に `require_admin` を足すが、この spec が既存の送信経路の無認証アクセスを守り続ける。**変更不要**。

---

## 7. リスク

| # | リスク | 影響 | 対策 |
| --- | --- | --- | --- |
| R1 | **fail open**（許可リスト未設定時に全員が運営になる） | 全プレイヤーのフィードバックと連絡先が誰にでも見える。最悪の失敗 | `email.blank?` と空要素除去の両方でガード。専用テスト 2 本（未設定・空文字）を必ず入れる |
| R2 | メールの大文字小文字違いで運営が自分のページに入れない | 運営がロックアウト。`users.email` の unique index は PG では大小区別する | 両辺 `downcase` して比較。テストあり |
| R3 | 本番の `ADMIN_EMAILS` 配線忘れ | デプロイ後、運営自身も 404。しかも「隠している」ので気づきにくい | ステップ 7 を実装と同じ PR に含める。デプロイ後の動作確認手順に「運営でログインして一覧が開ける」を追加 |
| R4 | credentials に `admin.emails` が無い状態でデプロイ | `.kamal/secrets` の `credentials:fetch` が失敗し**デプロイ自体が落ちる** | credentials 編集を先に行う。ステップ 7 の注記のとおり |
| R5 | Inertia のコンポーネント名 `admin/Feedbacks` とファイルパスの不一致 | **request spec は緑のままブラウザだけ壊れる**（Inertia はサーバ側では名前しか送らない） | 手動ブラウザ確認を必須にする。`auth/Login` → `pages/auth/Login.tsx` の既存前例に厳密に合わせる |
| R6 | 部分リロード（`router.get` + `only: ['feedbacks']`）を使うと `total` が更新されず件数表示が嘘になる | 「全 3 件」と出ているのに 50 件並ぶ | `Ranking.tsx` の部分リロード方式を**採用しない**。`<Link>` で通常遷移する（§3.5） |
| R7 | `user` の N+1 | 50 行で 51 クエリ | `includes(:user)` |
| R8 | 長文本文でのレイアウト崩壊 | 読めない | `whitespace-pre-wrap break-words`、テーブルを `overflow-x-auto` で包む（`History.tsx` と同じ） |
| R9 | XSS | 運営のブラウザで任意スクリプト実行 | `dangerouslySetInnerHTML` を使わない。React の既定エスケープに任せる。レビュー時のチェック項目にする |
| R10 | 一覧の PII がブラウザ履歴に残る | 端末を共有していると漏れる | `config.encrypt_history = true` が既に全体で有効（`config/initializers/inertia_rails.rb`）。鍵はセッションにあり、ログアウト時の `reset_session` で無効化される。**新たな対応は不要だが、この前提を壊さないこと** |
| R11 | ユーザー削除時の FK 違反 | `User` に `has_many :feedbacks` が無く、`feedbacks.user_id` の FK は制限付き。退会機能を作ると外部キー違反で落ちる | **今回は退会機能が存在しないため実害なし。** 発見事項として記録し、`has_many :feedbacks, dependent: :nullify` の追加は別途判断（`scores` が `:nullify`、`game_results` が `:destroy` という前例あり。フィードバックは運営の受信箱なので `:nullify` が妥当） |
| R12 | 件数増加時の全表スキャン | `feedbacks` には `created_at` の索引が無い | 数千件までは無視できる。閾値を超えたら `feedbacks(created_at DESC)` の索引を追加（スコープ外） |

### 回帰ポイント（既存挙動を壊しやすい箇所）

1. **`ApplicationController#inertia_share`** — 全ページの共有 props。`auth` に鍵を足す変更なので後方互換だが、`SharedProps` 型の更新漏れで `bun run check` が落ちる。既存の request spec が props を検証しているので CI で検出できる。
2. **`ApplicationController` にフィルタメソッドを追加** — メソッド定義だけで `before_action` を書かなければ他コントローラに影響しない。`config.action_controller.raise_on_missing_callback_actions = true`（test 環境）に注意し、`only:` を付けない。
3. **`Feedback.tsx`**（P2 を実施する場合）— 送信フォームのカテゴリ選択に手が入る。`spec/requests/feedbacks_spec.rb` はサーバ側しか見ないので、**フォームからの送信をブラウザで 1 回試す**こと。
4. **`History.tsx`**（P1 を実施する場合）— 日付表示。目視確認 1 回。
5. **`Header.tsx`** — 全ページに出る。一般ユーザー・ゲストでメニューが変わっていないことを確認。

---

## 8. 検証方法

### 自動

```sh
bundle exec rspec spec/models/user_spec.rb spec/requests/admin
bundle exec rspec                 # 全体（既存の回帰を見る）
bundle exec rubocop
bin/brakeman --no-pager           # 新規コントローラの静的解析
bun run lint && bun run check && bun run test
```

CI（`.github/workflows/ci.yml`）は `scan_ruby` / `lint` / `backend_test` / `frontend` の 4 ジョブ。request spec はレイアウト経由で Vite マニフェストを読むため、CI は RSpec の前に `bin/vite build` を走らせる。ローカルで request spec が「マニフェストが無い」で落ちる場合は同じことをする。

### 手動（`bin/dev` でサーバ起動）

1. `.env` に `ADMIN_EMAILS=<自分の Google アカウントのメール>` を書いてサーバを再起動する。
2. **データを作る** — `/feedback` からゲストとして 1 件、ログインしてから 1 件（返信先メールあり / なしの両方、本文に改行を含むもの、1000 文字ちょうどのもの）を送る。件数を増やすなら `bin/rails console` で `51.times { FactoryBot.create(:feedback) }`。
3. **運営としてログインして `/admin/feedbacks`** — 新しい順、送信者列（アカウント名 / 「ゲスト」）、返信先メールとアカウントメールが別物として読めること、改行が保たれること、1000 文字でも崩れないこと。
4. **カテゴリタブ** — URL に `?category=` が乗る、件数表示が絞り込みに追随する、ブラウザバックで前のタブに戻る。
5. **ページ送り** — 2 ページ目に進んでも絞り込みが維持される。`?page=999` を手打ちしても落ちない。
6. **ヘッダー導線** — 運営のドロップダウンにだけ項目が出る。
7. **認可** — ログアウトして `/admin/feedbacks` を開き 404。別アカウントでログインして 404。
8. **fail closed** — `.env` の `ADMIN_EMAILS` を消して再起動し、運営アカウントでも 404 になること。

```sh
# セッション無しで 404 になること（Inertia を介さない素の確認）
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:3000/admin/feedbacks   # => 404

# 送信フォームは無認証のまま 200（回帰確認）
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:3000/feedback          # => 200
```

### デプロイ後

`docs/deployment.md`「動作確認」に 1 行追加する: **運営アカウントでログインして `/admin/feedbacks` が開けること**（開けなければ `ADMIN_EMAILS` の注入失敗）。

---

## 9. 未決事項と仮定

### 未決（実装前に決めたい / 決めながら進められる）

1. **用語を「運営」にするか「管理者」にするか** — 推奨は「運営」（既存 glossary が既にその語を使っている）。issue のタイトルは「管理者用」なので、ここだけは決めてから `CONTEXT.md` に書く。どちらに決めても、コード識別子は `admin` のままでよい。
2. **ヘッダー導線を出すか** — 推奨は出す（ステップ 6）。落とすなら受け入れ条件から外し、URL 直打ち運用になることを承知する。
3. **1 ページの件数** — 50（`HistoriesController::RECENT_LIMIT` と揃える）を提案。運用してみて多すぎ / 少なすぎなら定数 1 つ。
4. **`subject` を出すか** — 出す提案（§1 のスコープ解釈）。issue の列挙に忠実にするなら落とせる。
5. **運営は将来複数人になるか** — 現状 1 人想定。複数でも許可リストで足りる想定だが、「運営を頻繁に入れ替える」なら前提が変わり、ロール列が正解になる。
6. **`has_many :feedbacks, dependent: :nullify` を今回入れるか**（R11）— 退会機能が無いので実害ゼロ。1 行なのでついでに入れてもよいが、スコープ外の変更としてレビューで指摘される可能性がある。**別 issue に切るのが無難**。
7. **P1 / P2 の共通化リファクタを含めるか** — 推奨は含める（コミットを分けておけば落とすのも容易）。落とすと日付整形とカテゴリラベルが重複し、`/code-review` の Standards 軸で Duplicated Code として挙がる。

### 仮定

- 運営は Google または GitHub の OAuth でログインでき、そのアカウントのメールアドレスが許可リストと一致する。OAuth プロバイダがメールを返さないケース（`User::EmailUnavailableError`）はそもそもログインできないので考慮不要。
- フィードバックの件数は当面、数十〜数百件のオーダー。全文検索・索引追加・アーカイブは不要。
- スパムはハニーポットと `rate_limit`（5 回 / 分）で十分に抑えられており、一覧に削除機能は要らない。溜まったら `rails console` で消す。
- 本番の credentials 編集（`config/master.key` が必要）は人間の運営が行う。**エージェントは実装・ドキュメント整備まで**で、実際の値の投入とデプロイは運営の作業。
- `docs/design/design.pen` に運営ページのデザインノードは無い（`管理者` / `admin` で検索して確認済み）。既存ページのトークンを流用して組む。
