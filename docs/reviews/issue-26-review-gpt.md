# issue #26 実装計画 3案レビュー

対象:

- 案A: `docs/plans/issue-26-plan-opus.md`
- 案B: `docs/plans/issue-26-plan-gpt.md`
- 案C: `docs/plans/issue-26-plan-grok.md`

作成モデル名は評価に用いず、以下では内容だけを案A/B/Cとして比較する。issue #26 原文、実装、RSpec/Vitest 構成、`CONTEXT.md`、ADR 0001〜0010を照合した。

## 結論

総合順位は **1位 案B、2位 案A、3位 案C**。ベースにすべきなのは案Bである。

案Bは、(1) 全フィードバックへ到達できる依存なしページネーション、(2) `created_at DESC, id DESC` の決定的順序、(3) `body` / `subject` のパラメータログ対策、(4) `Cache-Control: no-store`、(5) Inertia partial request を含む認可負テスト、という管理画面に重要な点を最も多く押さえている。

ただし、そのまま実装してはならない。3案共通の email 認可の穴を直し、Capybara/Selenium 導入を外し、コミット分割を組み替える必要がある。案Aから ADR・用語更新、`User` 全体を渡さない serializer、Vitest の画面テスト、最小ページをサーバ実装と同時に置く分割を取り込む。案Cからは未ログイン時のログイン誘導という運用上の視点だけを取り込む。案Cの account email 表示と無関係な association 変更は取り込まない。

## 1. 事実確認

### 1.1 実装スタックとテスト基盤

3案とも、issue 本文にある `app/views/feedbacks/` を鵜呑みにせず、実体を概ね正しく認識している。

- 画面本体は ERB ではなく **Rails + Inertia + React/TypeScript**。`app/views/` にある画面用 ERB は `layouts/application.html.erb` で、Vite と `inertia.tsx` を読み込む。ページは `app/frontend/pages/*.tsx`、resolver root は `app/frontend/entrypoints/inertia.tsx` の `pages: '../pages'`。
- `app/views/` は layout と PWA 用ファイルだけで、フィードバック固有 ERB はない。案Aの「layouts と pwa しかない」は、mailer layout も `layouts/` に含むという意味なら実質正しい。
- frontend は `package.json` の Vitest + Testing Library + happy-dom。実際に `app/frontend/components/**/*.spec.tsx` がある。
- 一方、**ページ単位の spec は現在ない**。案Aの「ブラウザで画面を触るテストの役割は Vitest component spec が担っている」は方向としては妥当だが、実在するのは部品 spec であり、ブラウザ・session・routing・初期 Inertia JSON まで通す system test と同等ではない。
- `spec/system` はなく、`Gemfile` に Capybara/Selenium もない。`config.generators.system_tests = nil` でもある。したがって案Bの system spec は「既存基盤」ではなく、新規基盤の導入提案である。技術的に不可能ではないが、本issueには重い。
- backend の既存流儀は RSpec request/model spec。Inertia matcher、FactoryBot、OmniAuth test mode は `spec/rails_helper.rb` にある。support 自動 require はコメントアウト済み。

「ERB か Inertia + React か」「既存 system spec か Vitest か」について、3案に致命的な事実誤認はない。差は、新しい system spec 基盤をこのissueで導入するかどうかである。

### 1.2 Feedback、User、routing

各案の主要な現状認識は正しい。

- `Feedback` は `belongs_to :user, optional: true`。
- category は4値の Rails enumかつ PostgreSQL native enum。
- `body` は必須・最大1000字、`subject` は任意・最大100字、`email` は任意。
- `feedbacks` に既読・対応済み列はなく、index は `user_id` だけ。
- 公開側は `FeedbacksController#new/#create` のみ。POST は5件/分の rate limit と honeypot を持ち、`user_id` は session からだけ設定する。
- `User` に role/admin 列はない。`current_user` は `session[:user_id]` から取得し、通常の `require_login` は `/auth/login` へ redirect する。
- `config/routes.rb` に管理者 namespace はない。
- `HistoriesController` は新しい順の直近50件だけ返し、`History.tsx` がクライアント側タブ、空状態、打ち切り表示を持つ。

ただし次は修正が必要である。

1. **案Cの「`includes(:user)` するなら `User has_many :feedbacks, dependent: :nullify` を同じ変更に含める」は誤り。** `Feedback.belongs_to :user` だけで eager loading は動く。現状 User を destroy すると feedbacks のFKで失敗し得ること自体は正しいが、退会 endpoint は存在せず、この一覧実装とは独立した既存問題である。別issueにすべき。
2. **案Aの「Rails default の `no-cache` は `no-store` 相当」は誤り。** Rails の `expires_now`/`no-cache` でさえ再検証を要求するだけで、browser cache はレスポンスを保存できる。PII 管理画面では明示的な `no_store` が必要で、ここは案Bが正しい。
3. **「実質1人運用」はコードやデプロイ構成から確定できない。** VPS 1台、単一repo owner、crontab運用はシステム構成の事実だが、閲覧担当者数の証拠ではない。3案とも少人数の仮定を置くこと自体は合理的だが、人間確認事項として扱うべきで、認可設計の確定事実にはできない。
4. 案A/Cの「History と同じ上限付き一覧」は既存実装への追従としては正しいが、**フィードバック閲覧の目的まで同じとは限らない**。History は要約が全件を表し、古いプレイ明細を省略する設計である。issue #26 は console 以外から保存済みフィードバックを読むことが目的なので、古い行を引き続き console でしか読めない案は要件充足が弱い。

### 1.3 認証メールの実際

`User.from_omniauth` は次の順でユーザーを解決する。

1. `(provider, uid)` が一致する既存 `Identity`
2. `auth.info.email` が完全一致する既存 `User`
3. 新規 `User` と `Identity`

session に残るのは `user_id` だけで、どの Identity で今回ログインしたかは残らない。

固定されている gem の実装も確認した。

- `omniauth-google-oauth2` 1.2.2 は `raw_info['email_verified']` が真のときだけ `info.email` に email を入れる。偽なら `unverified_email` にだけ入り、このアプリでは `EmailUnavailableError` になる。
- `omniauth-github` 2.0.1 は、現在の `scope: "user:email"` では `primary && verified` のメールだけを `info.email` に採用する。

したがって、現バージョン・現設定では「未検証 email をそのまま信頼している」と断定するのは正しくない。案Aは複数 provider の信頼境界を最も具体的に指摘しているが、現在の upstream の verified 条件まで確認できていない。案Bの「人間が verified を確認」、案Cの「OAuth が email を変えない前提」も不十分である。

ただし、3案の email 許可リストには別の実在する穴がある。

- DB の `users.email` unique indexと `User.find_by(email:)` は通常の PostgreSQL文字列比較で**大文字小文字を区別する**。
- 3案の `admin?`/allowlist 比較はすべて email を lowercase する。
- よって `Admin@example.com` と `admin@example.com` という2つの User 行が存在すると、DBとログイン処理は別ユーザーとして扱うのに、管理者判定だけは両方を同じ管理者として扱う。case variant の別アカウントが作れる provider/domain では認可昇格になる。
- email 一致で新しい provider Identity を自動連結するため、email を許可したつもりでも、実際にはその User に連結済み・今後連結される **Google/GitHub の全 Identity** が管理権限を得る。現在は両 provider が verified email を返すため任意の第三者が直ちに奪えるわけではないが、信頼する credential が暗黙に増え、メール再割当てや provider 側アカウント侵害時の失効境界も曖昧になる。
- `(provider, uid)` 既存 Identity の経路では現在の provider email を再確認せず User を返す。これは通常のOAuthログインとして自然だが、「毎回 allowlist email の所有を確認している」という説明にはならない。

このため、email 認可を採るなら、少なくとも User email の保存時正規化、case-insensitive uniqueness、verified email 契約の回帰確認、許可する provider の限定が必要である。3案ともここまで届いていない。

### 1.4 ADR とユビキタス言語

- ADR 0001〜0003 は旧Svelteルートのテスト責務に関する決定。React component testへ「実コンポーネント＋末端mock」という原則を参考適用することはできるが、本ページに直接 system spec を要求・禁止するADRではない。
- ADR 0004の「UIにない設定フィールドをDBへ先取りしない」は**ユーザー設定**の境界についての決定で、role列や feedback status を直接禁止していない。
- ADR 0007は、バッジが既存 `game_results` から導出可能だから解除テーブルを持たない決定。管理者roleや既読は導出できないため、直接の根拠にはならない。

したがって3案とも既存ADRへの正面衝突はない。一方、案Aの「role列はADR 0004に反する」、案Cの「role列はADR 0007の方向と逆行」は射程を広げすぎている。あくまで「必要になるまで状態を増やさない」という設計上の類推に留めるべきである。案Aが既読について「ADR 0007をそのまま適用できない」と明記した点は正確。

`CONTEXT.md` は「フィードバック」「ユーザー」「ゲスト」を定義するが、「管理者」は定義していない。認可モデルを確定するなら案Aのように用語とADRを追加する価値がある。ただし `CONTEXT.md` 既存文は「運営へ送る」と書いているため、案Aの `_Avoid_: 運営者` は既存語彙との関係を再整理してから決めるべきである。

## 2. 要判断3点

### 2.1 認可モデル

#### 3案の比較

3案とも「既存OAuthログイン + encrypted credentials/ENV の email 許可リスト」を推奨し、未設定・空設定は拒否する。DB roleやBasic認証を避けるスコープ判断は妥当で、fail-closed を明記した点も良い。

差は次のとおり。

- 案A: `User#admin?` に閉じ、空要素除外までコードを示す。複数providerのIdentity連結も認識している。ただし対策が「2FA」「同じemailでGitHubも押さえる」という運用注意だけで、認可境界自体は直らない。`raise ActionController::RoutingError` は単なる権限拒否を例外としてログ/エラートラッキングへ流し得るため、`head :not_found` より悪い。
- 案B: credentialsを直接読み、追加ENVを不要にするのは簡潔。partial Inertia requestまで負テストするのも良い。ただし判定を BaseController 内に置く記述で、認可ポリシーの独立した seam が弱い。email/Identity問題は「人間確認」で止まる。
- 案C: initializer + `User#admin?` はテストしやすい。ただし同じ User に連結された複数Identityの問題をほぼ扱わず、sender account email まで返すため最小権限の姿勢も一段弱い。

#### 推奨

3案にない最も安全な小規模向け選択肢は、**encrypted credentials に `(provider, uid)` の許可リストを置き、今回ログインした Identity を session に保持して認可する方式**である。

- email の大小文字、変更、再割当てに依存しない。
- Googleを許可したのに、同じUserへ自動連結されたGitHub Identityまで暗黙に管理者になることを防げる。
- 未設定/空なら誰も通さず fail-closed にできる。
- role migrationや任命UIは不要。

実装上は `session[:identity_id]` などを `SessionsController#create` で保存し、`AdminAccess` のような小さなポリシーが credentials の完全一致を見る。client propやparamsは認可に使わない。将来DB roleへ移行してもcontrollerの境界を保てる。

email allowlistで進める場合は最低条件として以下が必要である。

1. emailを保存時に一貫して正規化する。
2. DBもcase-insensitive uniquenessにする。
3. 許可providerを明示し、Google/GitHub strategyのverified email契約をテストまたはADRに固定する。
4. 同一emailによるIdentity自動連結が管理権限も共有することを、意図した仕様として明示する。

#### 404 / 403 / redirect

推奨は **未ログインは302でログインへ誘導、ログイン済み非管理者は403** である。管理URLは秘密ではなく、404は認可の代わりにならない。403の方が運用・監査・障害切り分けで明確で、レスポンスbodyを空にすればPIIは漏れない。未ログインを404にすると、Headerに導線を置かない設計では正規の管理者もログイン方法を得られない。

ただし現在の login callback は常にrootへ戻るので、302を選ぶなら固定した内部 `return_to` またはログイン後に管理URLへ戻れる導線が必要。任意URLを受ける open redirect は作らない。存在隠しを明示的な製品方針にするなら、案B/Cの `head :not_found` を未ログイン・非管理者へ統一する方が案Cの302/404混在より一貫する。いずれにせよ案Aの `raise RoutingError` は使わない。

### 2.2 ページネーション・カテゴリ絞り込み

**案Bの依存なし offset pagination（50件）を採るべき**である。

- 公開投稿なのでレスポンス/DOMを有界にする。
- すべての保存済みフィードバックへUIから到達でき、issueの「consoleしかない」を解消する。
- `created_at DESC, id DESC` で同時刻も安定する。
- 現規模ではoffset/countで十分で、新gemも複合indexも不要。

案A/Cの「最近100/200件だけ + client filter」は History の見た目を流用しやすいが、上限超過後の古いデータがconsole専用のまま残る。さらにclient category filterは「全件のカテゴリ絞り込み」ではなく「取得済み直近N件の絞り込み」で、誤解を招く。案Aは打ち切り表示を出すため隠蔽はしないが、目的達成度で案Bに劣る。

カテゴリ絞り込みは初回は見送ってよい。必要なら `?category=` を4 enum値に限定した **server-side filter + pagination** として追加する。current page/直近N件だけをclientで絞る案は採らない。page値は非数・0・負数・過大値を正規化し、並び順とpage境界をrequest specで固定する。

### 2.3 既読 / 対応済み

3案共通の「今回は持たない」が最も妥当である。

- issueの中心は閲覧経路。
- 「既読」と「対応済み」は異なる状態で、自動既読か手動か、誰が対応したかも未決定。
- 追加するとmigration、更新endpoint、CSRF、競合、絞り込み、監査の設計が必要。

必要性が実運用で確認されたら、booleanより `handled_at`（必要なら `handled_by_id`）または明示的statusを別issueで設計する。「既読」を安易に「対応済み」の代理にしない。

## 3. 各案の穴

### 3.1 案A

良い点:

- 実コードの調査が最も細かく、Inertia/History/request specの流儀に追従している。
- serializer whitelist、account emailを返さない、`includes(:user)`、React text node、fail-closedの境界値テストが具体的。
- ADRと「管理者」用語の追加、最小TSXをcontrollerと同時に置くコミット分割は安全。
- XSS用component test、未設定ENVのmodel/request両テストは有用。

問題:

- 上限100件は古いフィードバックへの閲覧経路を作らず、issueを部分的にしか解決しない。
- `created_at DESC` だけで同時刻の順序が不定。`id DESC` が必要。
- `raise ActionController::RoutingError` は予想された拒否を例外化し、ログ/エラートラッキングのノイズになる。`head`を使うべき。
- `no-cache`を`no-store`相当とする説明は誤り。明示的な `no_store` とそのheader testが必要。
- 現在のPOST `/feedback` は `email` しかfilterされず、`body`/`subject` がrequest logへ出得る。この既存漏洩を見落としている。
- case-insensitive admin判定とcase-sensitive User一意性の衝突を見落としている。
- provider連結リスクは認識したが、運用注意だけで技術的に制限していない。
- factory trait、categories prop、任意のHeader導線などはコアに対してやや広い。category値は既存 `Feedback.tsx` もfrontend定数で持っており、backendからkeysを渡しても日本語labelの重複は消えない。
- ADR/用語コミットが実装後になっている。認可決定は認可実装と同時か先に置くべき。

### 3.2 案B

良い点:

- 全件へ到達できるbounded paginationと安定順序が、issue目的に最も合う。
- explicit serializer、N+1防止、account email非公開、category filter見送りの理由が明確。
- `body`/`subject`をparameter filterへ加え、`no-store`を提案した唯一の案。
- 未設定/空/部分一致、異常page、partial Inertia request、props whitelistなどrequest specが最も強い。
- frontend testとsystem smokeの責務を分けて考えている。

問題:

- Capybara/Seleniumをこの1画面のために導入するのは過剰。Gemfile/lock/CI/browser保守を増やし、既存のRSpec request + Vitest構成から外れる。今回はrequest spec + page component spec、実ブラウザ手動確認で十分。system基盤は別issueで判断する。
- コミット1は routes と `Admin::BaseController` を追加するのに `Admin::FeedbacksController` はコミット2としており、route先が存在しない。記述どおりでは許可ユーザーがindexへ到達するrequest specも書けず、緑にならない。
- コミット2は `render inertia: "admin/Feedbacks"` するのにTSXをコミット3まで置かない。request specだけは通っても、許可管理者の実ブラウザは壊れる。最小TSXを同じコミットへ入れるべき。
- 認可判定の独立したseamが弱く、email/Identityの穴は解消していない。
- `expires_now` と `no-store` の両方ではなく、最終headerが確実に `no-store` になる実装とtestを指定すべき。
- ADRと`CONTEXT.md`更新がない。新しい権限概念は記録すべき。
- JST固定は管理者向けとしてあり得るが、既存Historyはbrowser timezoneであり、issue要件ではない。変更するなら理由を明示し、日時表示に既存ADR 0008（durationの表記）を誤適用しない。

### 3.3 案C

良い点:

- 現行スタック、system spec不在、Historyの流儀を正しく把握している。
- initializer + `User#admin?` のseam、fail-closed、最小TSXをserver契約と同時に置く分割は実装しやすい。
- 未ログインの正規管理者をログインへ誘導する運用上の視点は、全員404の案より実用的。

問題:

- sender propsに account `email` を含め、nicknameがなければ表示するとしている。issueが必要とするemailはフォームで明示された返信先であり、account emailの追加露出は本人の意思を迂回する。案A/Bの `{id, nickname}` が妥当。
- `has_many :feedbacks, dependent: :nullify` は一覧に不要な既存問題の修正で、scope creep。`includes(:user)` の前提でもない。
- 上限200件は古いデータをconsole専用のままにし、client category filterも取得範囲内にしか効かない。
- page component testを「既存ページにない」だけで省くのは弱い。このページは攻撃者入力とPIIを管理者sessionで描画するため、通常ページよりテスト価値が高い。
- POSTの本文ログ漏洩を認識しながら別issueへ送っている。管理画面で同じPIIを扱う時点で一緒に閉じる方が安全。
- `encrypt_history = true` は有益だが、HTTP/browser cacheの保存禁止にはならない。`no-store`がない。
- email case collision、verified provider契約、Identity自動連結を十分扱っていない。
- 未ログイン302は現在rootへ戻るだけで、管理URLへの復帰設計がない。
- ADR 0007をrole列抑制の根拠にするのは射程外。
- category tabを「入れてよいが必須でない」、上限を「全件でもよい」としており、実装者が決めるべき契約が残りすぎている。

## 4. 統合時に採る要素

### 案Bを土台として維持

- `/admin/feedbacks` の独立namespace
- 明示serializerとaccount email非公開
- `includes(:user)`
- 50件の依存なしpagination
- `created_at DESC, id DESC`
- 初回category filterなし
- `Cache-Control: no-store`
- `body` / `subject` / `email` のparameter filtering
- partial Inertiaを含むrequest spec
- 異常page、props whitelist、全件到達性のテスト

### 案Aから取り込む

- 認可決定のADRと`CONTEXT.md`の「管理者」定義
- 最小TSXをroute/controllerと同じコミットに置く
- Vitest page component spec
- XSS文字列、空状態、ゲスト/ユーザー表示のUIテスト
- fail-closedをmodel/policy層とrequest層の双方で固定
- 本番設定手順を明文化

### 案Cから取り込む

- 未ログイン管理者のログイン導線。ただし安全な復帰先を伴わせる。
- frontendにadmin flagを配らず、Headerへ一般向け管理リンクを足さない最小方針。

### 3案すべてから変更

- emailだけの認可ではなく、可能なら今回利用した `(provider, uid)` を許可する。
- emailを使うならcase-insensitive DB uniquenessとprovider制限を先に解決する。
- 通常の認可拒否で例外をraiseしない。
- system spec基盤はこのissueへ入れない。
- 既読/対応済み状態は追加しない。

## 5. 安全なコミット構成

1. **管理者の認証主体と認可方針を定義する**  
   ADR、`CONTEXT.md`、Identityをsessionへ保持する変更、認可policyと単体/request test。まだ管理routeは作らない。
2. **保護されたフィードバック一覧のサーバ契約を追加する**  
   route、BaseController、FeedbacksController、pagination、serializer、`no_store`、parameter filtering、request spec、最低限表示できるTSXを同時に入れる。未認可ページが存在する瞬間も、許可管理者の画面が壊れる瞬間も作らない。
3. **管理者フィードバック一覧UIを完成する**  
   table、空状態、pagination link、XSS-safeなtext描画、Vitest page spec。
4. **本番設定と運用手順を追加する**  
   encrypted credentials/必要なdeploy配線、管理者の追加・失効、provider accountの2FA、確認頻度を文書化する。

各コミットでRSpec/RuboCop/Brakeman、およびfrontendを触るコミットではtypecheck/lint/Vitestを通す。

## 最終判定

| 順位 | 案 | 判定 |
| --- | --- | --- |
| 1 | 案B | ベースに採用。pagination、ログ、cache、負テストが最も強い。system specとコミット分割、認可主体は修正必須。 |
| 2 | 案A | 調査・serializer・用語/ADR・Vitestは優秀。ただし直近N件打ち切り、RoutingError、cache/log対策不足が重大。 |
| 3 | 案C | 既存流儀への追従は良いが、account email漏洩、UI自動テスト不足、scope creep、打ち切りで総合的に劣る。 |

最も重大な共通見落としは、**emailを小文字化して認可する一方で、Userの一意性とOAuth email照合がcase-sensitiveなこと**、および **email一致で複数providerのIdentityが同じ管理者Userへ自動連結されること**である。次に重大なのは、案A/Cの件数上限が「consoleしかない古いフィードバック」を将来も残すこと。統合案ではこの2点を先に直さなければならない。
