---
issue: 26
author_model: composer-2.5
kind: plan-review
---

# Issue #26 プラン比較レビュー（Composer）

対象: [e601201/jomo-karuta-typing-rails-app#26](https://github.com/e601201/jomo-karuta-typing-rails-app/issues/26)「管理者用フィードバック閲覧ページを作る」

レビュー対象プラン:

- `docs/plans/issue-26-plan-opus.md`（以下 **Opus**）
- `docs/plans/issue-26-plan-gpt.md`（以下 **GPT**）
- `docs/plans/issue-26-plan-grok.md`（以下 **Grok**）

照合した一次情報: issue 本文（コメントなし）、`CONTEXT.md`、`docs/adr/`、`docs/agents/domain.md`、および `FeedbacksController` / `Feedback` / `User` / `ApplicationController` / `config/deploy.yml` / `.kamal/secrets` / `config/initializers/omniauth.rb` / `spec/requests/feedbacks_spec.rb` / `HistoriesController` / `History.tsx`。

---

## 1. 総評

**最も issue の意図・ドメイン・コードベースに整合するのは Opus。** 受け入れ条件の解釈（件名表示・ページ送り・サーバ側絞り込み）、セキュリティ（default-deny・存在隠蔽・props ホワイトリスト）、既存の Kamal/credentials/ENV 経路、コミット粒度の安全性まで、コードと食い違う前提が少ない。

**GPT** はモジュール分割（`Admin::BaseController`）と `Cache-Control: no-store` など良い点があるが、**非管理者へのリダイレクト＋フラッシュ**は PII を含む管理 URL の脅威モデルに合わず、**「credentials 直読み・ENV 複製不要」という前提がリポジトリ実装と矛盾**する。受け入れ条件の「送信者」解釈も運用実態に対して弱い。

**Grok** は `AdminAccess` による認可の局所化、`User` への `has_many :feedbacks`、ゲストと非許可ユーザーの HTTP 応答の使い分けなど筋が良い箇所がある。一方で **ページネーション無し・クライアント側カテゴリ絞り込み**は、issue が解消しようとしている「埋もれる」問題を再発させる。`History` のモードタブ前例の転用は、履歴（上限 50 件・ページ送り無し）と受信箱（全件到達が要件）では前提が異なる。

3 プランとも **既読フラグは見送り**、`FeedbacksController`（公開 `/feedback`）を触らない、`users` にロール列を足さない、という大枠は一致しており、実装の方向性自体はぶれていない。対立は主に認可の置き場・HTTP 応答・一覧のデータ契約・運用導線の 4 点に集中する。

---

## 2. 3 プランの一致点

| 項目 | 内容 |
| --- | --- |
| スコープ | 読み取り専用の `/admin/feedbacks`（`namespace :admin`）。書き込み `/feedback` はゲスト可のまま |
| 認可の骨格 | メール許可リスト。未設定・空は **default deny**（fail closed） |
| ロール列・Basic 認証・管理画面 gem | いずれも却下（YAGNI） |
| 並び順 | `created_at DESC, id DESC`（タイブレーク） |
| 表示フィールドの核 | `category` / `body` / 任意 `email` / 送信者（ユーザー or ゲスト）/ `created_at`。`subject` はスキーマに存在し Opus・Grok は表示する |
| XSS | React テキスト描画。`dangerouslySetInnerHTML` 不使用 |
| props | `as_json(only:)` 等のホワイトリスト。`histories_spec` パターンの request spec |
| 既読・返信・通知・削除 | スコープ外 |
| テスト方針 | request spec が主契約。ページコンポーネントの Vitest は必須にしない（現行慣習・ADR 0003 の精神） |
| 回帰 | `spec/requests/feedbacks_spec.rb` が「`require_login` を付けない」ことを既に監視 |

---

## 3. 対立点ごとの判定

### 3.1 許可リストの保管場所（ENV vs credentials 直読み）

| 判定 | **採用: Opus（ENV `ADMIN_EMAILS`、本番は Kamal が credentials から注入）** |
| --- | --- |
| 却下 | GPT（アプリが credentials を直読みし、ENV を増やさない） |
| 部分採用 | Grok（ENV 優先・credentials フォールバック）— 開発体験は良いが、二重経路はテストと運用の分岐を増やす |

**理由:** `config/initializers/omniauth.rb` は `ENV["GOOGLE_CLIENT_ID"]` を読み、`.kamal/secrets` は `credentials:fetch` で **デプロイ用 ENV に注入**している。`docs/deployment.md` も「秘密情報は credentials に集約、`.kamal/secrets` が取り出す」と書くが、**アプリ実行時の読み口は ENV** である。GPT の「ENV 複製は不要」はデプロイパイプラインの実態と食い違う。Grok のフォールバックは master.key 無し開発者向けには親切だが、本番と開発で読み口が分岐するコストがある。**単一の `ENV["ADMIN_EMAILS"]`（本番注入・開発 `.env`）が既存 OAuth と同型で最も安全。**

---

### 3.2 認可の seam（`User#admin?` vs `AdminAccess` vs `Admin::BaseController`）

| 判定 | **採用: Opus の `User#admin?`（1 述語に閉じ込め）** |
| --- | --- |
| 次点 | Grok の `AdminAccess.granted?(user)` — `User` 集約を汚さない点は codebase-design 的に正当 |
| 却下（v1） | GPT の `Admin::BaseController` + `config.x.admin_emails` — 管理ページが 1 つだけの時点では Middle Man（Opus の指摘どおり） |
| 却下 | コントローラが ENV を直接読む（Grok が設計 C として却下している通り） |

**理由:** 呼び出し側の interface は `current_user&.admin?` または `AdminAccess.granted?(current_user)` のどちらも **深いモジュール**になりうる。`User` には既に `best_scores` / `badges` などプレイヤー向けだがドメイン寄りのメソッドがあり、`#admin?` を足すのはこのリポジトリの慣習と整合する。Grok の「プレイヤー集約に運用フラグが混ざる」懸念は妥当だが、**許可リストは「ユーザーの属性」ではなく設定の照合**であり、`#admin?` のコメントと ADR で誤読を防げば足りる。`AdminAccess` は第二の運営機能が増えた時点で `User#admin?` から抽出すればよい。

`Admin::BaseController` は **2 つ目の運営ルートができた時点で抽出**（3 プラン中 Opus・Grok が一致）。

---

### 3.3 非許可時の HTTP 応答（404 vs リダイレクト）

| 判定 | **採用: ハイブリッド — 未ログインは `/auth/login` へ（Grok/GPT）、ログイン済み非運営は 404（Opus/Grok）** |
| --- | --- |
| 却下 | GPT（非管理者をトップへフラッシュ付きリダイレクト）— URL の存在と「管理領域がある」ことを漏らす |
| 却下 | Opus の「未ログインも含め一律 404」— 運営本人の初回アクセスでログイン導線が無く、`Header` 導線も無いと詰まりやすい |

**理由:** issue は明示していないが、`CONTEXT.md` のフィードバック定義（非公開・運営が受け手）と一覧に載る PII（本文・メール）から、**ログイン済み一般ユーザーには存在を伏せる**のが妥当。一方、運営は OAuth ログインが前提なので、**未ログイン時だけ `require_login` 相当の 302** は利便性と `HistoriesController` との一貫性を保てる。ゲスト 302 / 非許可 404 の組み合わせは「パスは存在しうる」情報をわずかに漏らすが、**中身は出ない**限りこのアプリの脅威モデルでは許容範囲（Grok の整理は妥当）。

GPT の「権限がありません」フラッシュは、攻撃者・好奇心旺盛なプレイヤーに **管理機能の存在**を教える。専用 403 画面を作らないという GPT 自身の却下理由とも矛盾する。

---

### 3.4 ページネーション

| 判定 | **採用: Opus / GPT（50 件・サーバ側 `offset`/`limit`）** |
| --- | --- |
| 却下 | Grok（全件返却） |

**理由:** issue の未決項目だが、背景は「コンソールしかなく埋もれる」。`History` は `RECENT_LIMIT = 50` で足りる**個人ログ**だが、フィードバックは**運営の受信箱**であり古いバグ報告に到達できないと issue の目的を半分しか満たさない。レート制限（5 件/分）で急増は緩やかでも、**ページ送りは数行で足り、gem も不要**（Opus）。GPT も同方針で正しい。

---

### 3.5 カテゴリ絞り込み

| 判定 | **採用: Opus（サーバ側 `?category=` + ページ送りと併用）** |
| --- | --- |
| 却下 | Grok（クライアント側タブのみ）— ページネーションと両立しない |
| 許容 | GPT（絞り込み無し）— 4 種・件数少なら運用可能だが、コスト数行で足せる |

**理由:** `History.tsx` のモードタブは **サーバから最大 50 件だけ**渡し、クライアントで絞る前例である（`records.filter`）。フィードバック一覧にサーバページングを入れた後、同パターンを持ち込むと **「今のページ内だけ絞る」罠**に落ちる（Opus §4.5 の指摘はコード確認済みで正しい）。絞り込みを入れるならサーバ側が唯一一貫した実装。

---

### 3.6 送信者の props 契約

| 判定 | **採用: Opus / Grok（`user` ネストまたは `sender` 判別子 + nickname + アカウント email）** |
| --- | --- |
| 弱い | GPT（`senderType` のみ。アカウント email なし） |

**理由:** issue 本文は「`user` or ゲスト」としか書かないが、運営が返信先 `email`（任意）と混同しないよう **アカウント側の識別子**があると実務上必要（Opus §1 の「コンソールより情報が減らない」は妥当）。`includes(:user)` で N+1 は回避可能（現状 `User` に `has_many :feedbacks` は無いが、読み取りは `Feedback.includes(:user)` で足りる）。GPT の最小 props は漏洩リスクは低いが、**運用価値が issue の背景（ちゃんと読む）に対して不足**。

---

### 3.7 ヘッダー導線と `auth.is_admin`

| 判定 | **採用: Opus（`inertia_share` に `is_admin`、Header に条件付きリンク）** |
| --- | --- |
| 却下 | GPT / Grok（導線無し・`isAdmin` をクライアントに送らない） |

**理由:** issue の背景は「送っても誰も見に行かない」。URL 直打ちのみでは再発しやすい。`is_admin: false` を一般ユーザーに渡すことは「管理者という概念が存在する」ことの微弱な漏洩だが、**boolean 1 つと導線の運用価値のトレードオフは導線側が勝つ**。GPT が懸念する「クライアントの `isAdmin` に依存した認可」は誰も提案しておらず、表示制御のみなら問題にならない。design.pen に項目が無い点は 3 プラン共通で、既存 Header ドロップダウンへの追加で足りる。

---

### 3.8 ドメイン用語（運営 vs 管理者）

| 判定 | **採用: Opus（`CONTEXT.md` に「運営」を正典化。「管理者」は Avoid）** |
| --- | --- |
| 却下 | GPT（「管理者」表記のまま）— issue タイトルに引きずられ glossary と乖離 |
| 保留 | Grok（`CONTEXT.md` 更新しない）— 用語の穴を残す |

**理由:** `CONTEXT.md`「フィードバック」定義文に **運営** が既に出てくる。issue タイトルは「管理者用」だが、`domain.md` の指針どおり glossary の語を優先すべき。コード識別子 `admin` / `Admin::` は CONTEXT の「walkover」「部屋」前例と同型で許容（Opus §2）。

---

### 3.9 ADR・ドキュメント

| 判定 | **採用: Opus（ADR-0011 + deployment/README 手順）** |
| --- | --- |
| 任意 | Grok（短い ADR は任意） |

**理由:** `domain-modeling` の 3 条件（戻しにくい・文脈なしで驚く・トレードオフの結果）を満たす。許可リスト + 404 は将来の読み手が必ず理由を探す。**credentials 投入前に `.kamal/secrets` を更新するとデプロイが落ちる**（Opus ステップ 7 注記）は `.kamal/secrets` の `credentials:fetch` 実装から正しい。

---

### 3.10 `feedbacks` インデックス migration

| 判定 | **採用: Opus（v1 では見送り）** |
| --- | --- |
| 過剰（v1） | GPT（複合インデックスを必須化） |

**理由:** `schema.rb` には `user_id` 索引のみ。件数が数十〜数百のうちは全表スキャンでも実害小。インデックス追加はデプロイ・マイグレーションリスクを増やすだけのメリットが薄い。

---

### 3.11 `User has_many :feedbacks, dependent: :nullify`

| 判定 | **採用: Grok（1 行追加。別 issue に切らなくてよい）** |
| --- | --- |
| 保留 | Opus（退会機能無しのため別 issue） |

**理由:** 現状 `User` に関連が無く FK は `feedbacks.user_id` に存在。退会 UI は無いが、`scores` の `:nullify` 前例と「フィードバックは運営の私信として残す」方針に合う。**マイグレーション不要**の関連追加はリスクが極小。

---

### 3.12 実装ステップの安全性

| 判定 | **採用: Opus のコミット分割（認可→ルート→絞り込み→ページング→導線→Kamal）** |
| --- | --- |
| 許容 | Grok（5 コミット） |
| 粗い | GPT（縦スライス 1 コミットで route+UI+spec）— 動くが差分レビューと bisect が難しい |

**理由:** Opus は **3a（UI 先行・ルート無し）→ 3b（ルート接続）** で Inertia 名とパスの不一致（R5）を段階的に検証できる。各段階で `feedbacks_spec` の回帰が維持される。P1/P2（`format-datetime` / `feedback-categories` 共通化）は必須ではないが、2 画面目で seam を切る Opus の判断は codebase-design と一致。

---

### 3.13 その他（GPT のみの良い点）

| 項目 | 判定 |
| --- | --- |
| `Cache-Control: no-store` on admin routes | **合成プランに追加推奨**（PII レスポンスのブラウザキャッシュ抑止。3 プランで唯一明示） |
| props の camelCase 統一（`createdAt`, `senderType`） | **却下** — `HistoriesController` は `as_json` の snake_case（`created_at`）と自前 camelCase（`totalPlays`）の混在が既存慣習。無理な統一は scope 外 |

---

### 3.14 誤った前提・やりすぎ・欠け

| プラン | 問題 |
| --- | --- |
| **GPT** | credentials 直読みが OAuth の ENV 経路と矛盾。非管理者リダイレクトが存在隠蔽に反する。送信者情報が薄い |
| **Grok** | ページネーション省略が issue 背景と逆行。クライアント絞り込みは将来負債。`head :not_found` は Inertia 体験が真っ白になりうる（Opus が `RoutingError` を推す点は有効） |
| **Opus** | 一律 404 は運営 UX を損ねる。P1/P2 リファクタは issue 本体からは外れる（コミット分離なら許容）。`is_admin` 全ページ配信は軽微な情報漏洩 |
| **共通の欠落** | 本番 `admin.emails` / `ADMIN_EMAILS` 設定は **人間作業**としてどのプランも残す。自動テストではカバー不可 |

---

## 4. 推奨する合成プラン（短い）

Opus を骨格に、以下だけ差し替え・追加する。

1. **認可:** `User#admin?` + `ENV["ADMIN_EMAILS"]`（本番は `.kamal/secrets` → `credentials:fetch admin.emails`）。未設定・空は fail closed。
2. **HTTP:** `before_action` は `Admin::FeedbacksController` のみ。未ログイン → `redirect_to "/auth/login"`。ログイン済み非運営 → `ActionController::RoutingError`（404）。許可時レスポンスに `Cache-Control: no-store`（GPT から採用）。
3. **一覧:** `Feedback.includes(:user).order(created_at: :desc, id: :desc)`。50 件ページング + サーバ側カテゴリ絞り込み（`Feedback.categories` ホワイトリスト）。props は Opus のホワイトリスト + 送信者 nickname / アカウント email。`subject` は表示。
4. **UI:** `admin/Feedbacks.tsx`（`History` / `Feedback` のトークン流用）。カテゴリタブ・ページ送りは Inertia `<Link>`（部分リロードは使わない）。
5. **導線:** `inertia_share` に `auth.is_admin`、`Header` に「フィードバック一覧」（運営のみ）。
6. **モデル:** `User has_many :feedbacks, dependent: :nullify`（Grok から 1 行）。
7. **ドキュメント:** `CONTEXT.md` に「運営」「フィードバック一覧」。`docs/adr/0011-*.md`。`docs/deployment.md` / README に許可リスト手順。**credentials 投入を Kamal 変更より先に**。
8. **共通化（任意）:** `feedback-categories.ts` 抽出は 2 画面でラベル共有するなら推奨。`format-datetime.ts` は必須ではない。
9. **触らない:** `FeedbacksController`、`users.role`、既読フラグ、インデックス migration（v1）、`Admin::BaseController`（2 ページ目まで）。

**コミット順:** Opus §5（P1/P2 任意 → ドキュメント → `#admin?` → UI → ルート+認可 → 絞り込み → ページング → Header → Kamal）。

---

## 5. ブロッカーと質問

### ブロッカー（実装前にプロダクトオーナーが決めること）

1. **画面・ドキュメントの呼称:** 「運営」（glossary 整合）で確定してよいか。issue タイトルの「管理者」との差をどう扱うか。
2. **未ログイン時の応答:** 本レビュー推奨の「ログインへ 302」でよいか、それとも存在隠蔽優先で一律 404 か（Opus 案）。Header 導線を入れるなら 302 で足りることが多い。
3. **本番許可リスト:** 最初の OAuth メールアドレスと、`bin/rails credentials:edit` を誰が行うか。未設定のままデプロイすると運営自身も一覧に入れない（fail closed は正しいが運用事故になる）。

### 質問（実装中に迷ってもよいが、早めに揃えたいこと）

4. **送信者列:** アカウント email まで出すか（推奨: 出す）。返信先 `email` とのラベル分けは Opus どおり必須。
5. **ヘッダー導線:** URL 直打ち運用に割り切るか（issue 背景からは導線推奨）。
6. **`has_many :feedbacks`:** 合成プランどおり同一 PR で入れてよいか。
7. **カテゴリ絞り込み:** ページングとセットでサーバ側に入れる前提でよいか（4 種・件数少でもコストは小さい）。

### 実装者向け注意（ブロッカーではないが見落としやすい）

- `spec/requests/feedbacks_spec.rb` を壊さない（`ApplicationController` に global `before_action :require_admin` を付けない）。
- Inertia コンポーネント名 `admin/Feedbacks` とファイルパス `pages/admin/Feedbacks.tsx` の一致を request spec + 手動で確認。
- `config.encrypt_history = true` は維持（Opus R10）。ログアウトで `reset_session` される前提。
- Brakeman / rubocop / CI の 4 ジョブは Opus §8 どおり。request spec 前に `bin/vite build` が必要な環境あり。

---

*レビュー日: 2026-09-02 / 実装・コミット・PR は本タスクのスコープ外*
