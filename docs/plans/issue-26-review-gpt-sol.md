---
issue: 26
author_model: gpt-5.6-sol-xhigh
kind: plan-review
---

# Issue #26 三プラン比較レビュー

## 1. 総評

3案のどれも、そのままでは採用しない。採用の骨格は Opus 案だが、次の修正が必要である。

- 認可判定を `User` に持たせず、運用上のアクセス方針を隠す `AdminAccess.granted?(user)` に閉じ込める。
- 許可リストは `ADMIN_EMAILS` のみをアプリから読み、本番では既存 OAuth と同様に Rails credentials から Kamal の secret ENV へ注入する。
- 未ログインを含む運営以外はすべて 404 とし、運営向け成功レスポンスには `Cache-Control: no-store` を付ける。
- 送信者は `"user"` / `"guest"` の種別だけを props に出す。アカウントのメール、nickname、`user_id` は出さない。
- 50件単位のサーバー側ページ送りと、採用するなら必ずサーバー側のカテゴリ絞り込みを組み合わせる。
- 長文を多列テーブルに押し込まず、縦型カードで全文を表示する。
- ヘッダー導線、`User` の関連追加、日時共通化、ADR、読み順インデックスは本 issue の必須変更にしない。

Issue 本文が確定しているのは「新しい順」「category / body / email / 送信者種別 / created_at」「読み取り手段の新設」であり、認可方式、ページ送り・絞り込み、既読状態は明示的に未決である。Opus 案は自案の判断を受け入れ条件へ昇格しており、Terra 案は逆に「リダイレクト」を受け入れ条件として固定している。どちらも issue の確定事項と設計判断を分けて記述すべきである。

各案の評価は次のとおり。

| 案 | 評価 | 良い点 | 採用を妨げる問題 |
| --- | --- | --- | --- |
| Opus | 最も近いが要修正 | 全員404、ENV経由、安定順序、50件ページ、サーバー絞り込み、回帰テストが具体的 | アカウントPIIの過剰な props、`no-store` 欠落、`User#admin?`、ヘッダーへの全画面共有 props、CONTEXTへの実装詳細、不要な周辺リファクタ |
| Terra | 部分採用 | 最小 props、`no-store`、カード UI、50件ページ、認可済み後にだけDBを読む構造 | ゲスト・一般ユーザーへのリダイレクトが存在隠蔽に反する。`config/application.rb` で credentials を読む案が鍵なし環境と Docker build を壊す |
| Grok | モジュール案のみ強い | `AdminAccess.granted?` の小さい interface、公開コントローラとの分離、用語の扱い | ゲストだけ302、ENV/credentials二重読込、全件PII返却、クライアント絞り込み、アカウントPII、無関係な `User` 間連追加 |

## 2. 3プランの一致点

3案が一致しており、そのまま採用できる点は次のとおり。

- 公開の `FeedbacksController` に `index` を足さず、`Admin::FeedbacksController` と `/admin/feedbacks` を別にする。
- 汎用 RBAC、`users.role`、Basic 認証、管理画面 gem は、運営向け1画面には過剰である。
- OAuth で得た `current_user` とメール許可リストを組み合わせ、許可リストが空なら誰も通さない。
- 認可は Rails 側で action 実行前に強制し、クライアント側の表示制御を認可として扱わない。
- 一覧は `created_at DESC, id DESC` とし、同時刻でも順序を安定させる。
- `Feedback` を丸ごと props にせず、明示した項目だけを直列化する。
- 件名は issue の列挙外だが、既に保存されている任意項目なので表示する。
- 本文は React のテキストとして描画し、`dangerouslySetInnerHTML` を使わない。
- 既読・対応済み状態、返信、削除、通知、検索、エクスポートは入れない。
- request spec で認可、Inertia component、props、順序を守り、既存 `/feedback` の request spec を回帰テストとして残す。
- ゲスト送信を許す既存 `GET/POST /feedback` のコントローラ、検証、rate limit、honeypot は変更しない。

既読状態を見送る理由は「状態遷移、操作主体、監査要件が未定だから」で十分である。Opus 案が引用する ADR-0007 は導出可能なバッジの話であり、閲覧という新しい事実を保存するかどうかには直接適用できない。

## 3. 対立点ごとの判定（採用 / 却下と理由）

### 3.1 運営以外への応答

**採用: Opus 案の「未ログインを含め全員404」**

**却下: Terra 案の全員リダイレクト、Grok 案のゲスト302・一般ユーザー404**

フィードバック本文と返信先メールは非公開情報である。ログイン画面やトップへのリダイレクトは、未登録パスとは異なる応答を返して URL の存在を知らせる。運営は URL とログイン手順を運用文書で把握できるため、利便性を理由に存在隠蔽を弱める必要はない。

テストはステータスだけでなく、ゲスト・一般ユーザーのレスポンスに本文、メール、件数が一切含まれないことも確認する。404 の実装方式は共通 guard の中に隠し、各 action に条件分岐を散らさない。

**追加採用: Terra 案の `Cache-Control: no-store`**

認可済みレスポンスにも複数人の自由記述とメールが含まれる。既存の `config.encrypt_history = true` は Inertia の履歴 state を保護するが、HTTP キャッシュ禁止の代わりではない。運営向けレスポンス全体に `no-store` を付け、request spec でヘッダーを固定する。

### 3.2 認可モジュール

**採用: Grok 案の `AdminAccess.granted?(user)` という interface**

**却下: Opus 案の `User#admin?`**

メール許可リストはプレイヤーである `User` 自身の属性ではなく、デプロイ運用で決まるアクセス方針である。`User` に `admin?` と `.admin_emails` を足すと、プレイヤーのモデルへ運営ポリシーと設定形式が混ざる。`AdminAccess` は nil、正規化、複数メール、default-deny を1メソッドの裏に隠せるため、小さい interface に対して十分な実装を持つ。

**現時点では却下: Terra 案の `Admin::BaseController`**

運営向け controller が1つしかない段階では、継承時の callback 順序まで interface に含む基底クラスは先回りである。`Admin::FeedbacksController` の1つの before action が `AdminAccess` を呼べば、認可はまだ散らばらない。2つ目の運営向け controller ができた時点で、404 と `no-store` を含めて `Admin::BaseController` へ上げる方が実在する重複に基づく seam になる。

### 3.3 許可リストの供給元

**採用: Opus 案の ENV 一本**

アプリは `ENV["ADMIN_EMAILS"]` だけを読む。本番の値は Rails credentials の `admin.emails` から `.kamal/secrets` を経由して注入する。これは OAuth の `GOOGLE_CLIENT_ID` 等で既に使っている経路であり、credentials と ENV に値を二重保存する設計ではない。credentials は保管元、ENV はコンテナへの配送手段である。

**却下: Terra 案の `config/application.rb` で credentials を起動時に読む方式**

このリポジトリでは `config/*.key` が gitignore され、現在の開発環境にも `config/master.key` と `RAILS_MASTER_KEY` がない。一方、Dockerfile の `assets:precompile` は意図的に `RAILS_MASTER_KEY` なしでアプリを boot する。`config/application.rb` で encrypted credentials に触れると、通常の開発・test と本番イメージ build が `ActiveSupport::EncryptedFile::MissingKeyError` で止まる。`SECRET_KEY_BASE_DUMMY=1` は credentials の復号鍵を提供しない。

**却下: Grok 案の「ENV がなければ credentials」**

鍵のない開発・test で `ADMIN_EMAILS` が未設定のとき、空リストとして拒否する前に credentials の復号で例外になり得る。これは default-deny ではなく 500 である。供給元を二重化すると優先順位とテスト行列も増える。

値はカンマ区切りの単一文字列として定義し、前後空白除去・小文字化・空要素除去を `AdminAccess` 内で行う。`ADMIN_EMAILS` が nil、空文字、区切り文字だけの場合を明示的に false とする。

### 3.4 ページ送り、カテゴリ絞り込み、インデックス

**採用: Opus / Terra 案の50件サーバー側ページ送り**

Grok 案の全件返却は、保存件数に比例して自由記述とPIIのレスポンス量を無制限にする。固定上限だけで古い項目へ到達不能にするのも issue の目的に反するため、50件単位で全件へ到達できるページ送りが妥当である。

ページ値は `to_i` に任せず、正の整数として厳密に正規化する。空一覧、非数値、0、負数、最終ページ超過の契約を1つに決めて request spec にする。`created_at, id` のタイブレークは同時刻の不定順を防ぐが、ページ移動中の新規投稿による offset のずれまでは防がない。投稿頻度が低い現状では offset 方式を許容するが、「重複・消失が絶対にない」とは記述しない。

**採用: Opus 案のサーバー側カテゴリ絞り込み**

カテゴリはフィードバックの中核的な4分類であり、ページ送りを実装するなら絞り込みも同じ query に適用する。絞り込み後の `total` でページを計算し、ページリンクはカテゴリを保持する。

**却下: Grok 案のクライアント側絞り込み**

全件返却を前提にしか正しく動かず、PIIの無制限返却と結び付いている。サーバー側ページ送りへ後から移行すると「現在の50件内だけを絞る」誤動作になる。

**今回は見送り: Terra 案の読み順複合インデックス**

現在の件数規模を示す測定がなく、機能成立には不要である。まず既存テーブルで実装し、実データ量と `EXPLAIN` に基づいて追加する。追加する場合は `ORDER BY created_at DESC, id DESC` と一致する複合インデックスを別の明示的な変更として扱う。

### 3.5 props と送信者のPII

**採用: Terra 案の `senderType: "user" | "guest"`**

**却下: Opus / Grok 案の関連 User の id・nickname・email**

Issue が要求する送信者は「`user` or ゲスト」の区別であり、返信先として明示的に入力されたのは `Feedback#email` だけである。OAuth アカウントのメールは別目的で取得したPIIで、返信先と異なる可能性がある。運営の利便性だけで props に追加すると、誤送信と目的外利用の余地を増やす。

各行は controller が明示的な hash にし、次だけを出す。

- `id`
- `category`
- `subject`
- `body`
- `email`
- `senderType`
- `createdAt`

`senderType` は `user_id` の有無から導出できるため、`includes(:user)` も関連 User の直列化も不要である。もし issue の「user」がアカウント本人の識別までを意味するなら、それは実装前に確認すべき仕様差であり、必要な項目と利用目的を決めてから追加する。

### 3.6 UI、XSS、日時

**採用: Terra / Grok 案の縦型カード**

1000文字の本文、件名、返信先、送信者、日時を多列テーブルへ入れると、狭い画面で本文が極端に細くなる。カードのメタ情報と本文領域を分け、`whitespace-pre-wrap` と `break-words` で改行・長い連続文字を安全に表示する。折り畳みや省略はしない。

本文・件名は React のテキスト子として描画し、HTMLへ変換しない。HTMLタグ、改行、1000文字、長いURL相当の文字列をブラウザ確認に含める。

運営時刻をJSTとするなら `toLocaleString("ja-JP", { timeZone: "Asia/Tokyo", ... })` のように明示する。`ja-JP` だけでは閲覧端末のタイムゾーンに依存する。ADR-0008 はゲームの計測時間表記を扱うもので、受信日時の根拠にはならない。

カテゴリのキー・日本語ラベルだけを frontend module にまとめる案は採用できる。フォーム固有の icon・説明・色は移さない。既存 `Feedback.tsx` を触るため、独立コミットで型検査と公開フォームの4カテゴリ送信を確認する。Opus 案の日時共通化は、既存 `History` が端末時刻、新画面がJSTという異なる要件になり得るため採用しない。

### 3.7 導線と既存モデルへの変更

**今回は却下: Opus 案のヘッダー導線と共有 `auth.is_admin`**

Issue は導線を要求していない。全ページの `inertia_share`、共有型、共通 Header を変更すると公開画面の回帰面が広がる。運営は deployment 文書から保護 URL を開く運用とし、実運用で見逃しが残るなら導線を別判断する。クライアントへ渡した `is_admin` は認可根拠にしてはならない。

**却下: Grok 案の `has_many :feedbacks, dependent: :nullify`**

現在は退会経路がなく、一覧表示にも不要である。既存 FK が将来の削除を妨げる点は別 issue で、フィードバック保持方針と退会時のPII削除要件を決めて扱うべきである。

### 3.8 ドメイン用語と ADR

ドキュメントと画面では、既に `CONTEXT.md` のフィードバック定義にある **運営** を使う。`Admin::`、`admin`、`/admin` はコード上の識別子として許容する。新しい文書で「管理者」「運営者」を混在させない。

**却下: Opus 案の CONTEXT 追記案**

提案された「誰が運営かは許可リストで決まる」「既読状態を持たない」は実装・現時点のスコープであり、用語集へ置く内容ではない。「管理者」を Avoid と断定することも、まだ合意されたドメイン判断ではない。現行のフィードバック定義だけで本 issue の語彙は足りる。将来「運営」を独立項目にするなら、人の役割だけを定義し、認可方式や画面仕様を書かない。

**今回は却下: 認可 ADR**

Opus 案自身が「元に戻しにくい」を△と評価しているのに、ADR作成の3条件をすべて満たすと結論しているのは矛盾する。許可リストは `AdminAccess` の内部を差し替えれば変更でき、現時点では deployment 文書とテストで十分である。複数の運営機能や権限レベルが生まれ、ロール方式への移行が高コストになった時点で ADR を検討する。

ADR-0001〜0003 は旧 Svelte ルートのテスト方針であり、現行 Inertia page のテスト構成を直接規定しない。新規 page-level Vitest を省く根拠は、現行コードでページテストがなく、表示ロジックが薄いことと、request spec・型検査・ブラウザ確認で責務を分けることに置くべきである。

### 3.9 実装ステップの安全性

Opus 案は最もテストが具体的だが、P1 の日時共通化、P2 の公開フォーム変更、ヘッダー変更、CONTEXT、ADRまで同じ issue に含め、回帰面を広げすぎている。また `.kamal/secrets` が存在しない `admin.emails` を取得するコミットは、CI が緑でもデプロイを失敗させるため、認可値の投入と順序をコード外の前提にしてはならない。

Terra 案の「認可基盤」コミットは、`config/application.rb` の credentials 読み込みにより route がなくても boot / asset build を壊し得る。単体で緑という主張は成立しない。完成した frontend と backend を同一コミットにする縦スライスはよい。

Grok 案は各コミットが小さいが、最終形が全件PII返却である。また途中で空一覧だけの公開 route を作る必要はなく、`User` 関連の追加も本体から独立していない。機能を小さく見せるために不完全な本番経路を作らない方がよい。

## 4. 推奨する合成プラン（短い）

1. `AdminAccess.granted?(user)` を追加し、ENV の正規化、nil、未設定、空、大小文字、複数指定を unit spec で固定する。アプリは credentials を直接読まない。
2. frontend のカテゴリ型・ラベルだけを共有 module へ移し、公開 `Feedback.tsx` の送信値が変わらないことを確認する。完成形の運営向けカード page を、まだ route なしで追加して型検査する。
3. `Admin::FeedbacksController#index` と route を完成形で追加する。全運営外404、成功時 `no-store`、`created_at DESC, id DESC`、50件ページ、サーバー側カテゴリ絞り込み、最小 props、空状態を同じ縦スライスに含める。
4. request spec で認可マトリクス、default-deny、PII非漏洩、props allowlist、安定順序、51件、絞り込みとの併用、不正ページ、空状態、`no-store` を確認する。既存 feedback request spec と全体検査も通す。
5. `ADMIN_EMAILS` の開発・本番設定を deployment 文書に追記し、本番では credentials のカンマ区切り値から Kamal secret ENV へ配線する。許可値を先に用意してからデプロイ設定を有効化し、運営200・ゲスト404・一般ユーザー404・公開 `/feedback` の維持を確認する。

## 5. ブロッカーと質問

1. **本番許可リストの投入主体と値が必要。** 最初に許可する OAuth アカウントの正確なメールを人間が決め、`admin.emails` を `.kamal/secrets` から取得可能にしてからデプロイ配線を有効化する必要がある。未設定なら安全に全員404となるが、機能の運用受け入れは完了しない。
2. **Issue の「送信者（user or ゲスト）」の意味が曖昧。** 本レビューは最小権限として種別だけを推奨する。アカウント本人の識別が必要なら、nickname、内部ID、アカウントメールのどれが何の目的で必要かを先に決める。返信先としてアカウントメールを暗黙利用してはならない。
3. **運営導線を持たない運用で見逃しリスクを十分下げられるか。** 本 issue では共有 props と Header 変更を避け、URLを運用文書・ブックマークで管理する案を推奨する。定期確認が定着しないなら、運営だけの導線を別スコープで決める。
4. **受信日時をJST固定とするか。** 日本向け運営画面としてはJST固定を推奨するが、issue はタイムゾーンを指定していない。
5. **現在件数と増加見込み。** 複合インデックスは現時点でブロッカーではない。実データ量または query plan が必要性を示した場合に追加する。
