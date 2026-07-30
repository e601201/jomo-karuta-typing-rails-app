# 対戦のリアルタイム通信は Action Cable + solid_cable（プライマリ DB）で行う

対戦モード（#39 相当の機能）のマッチング通知と対戦中の相手状態共有は、Rails 標準の Action Cable を WebSocket 層とし、本番の pub/sub アダプタには **solid_cable をプライマリ PostgreSQL 上で**使う。専用の cable データベースは作らず（cable.yml で `connects_to` を指定しない）、`solid_cable_messages` テーブルを通常のマイグレーションでプライマリ DB に置く。開発は `async`、テストは `test` アダプタのまま。

**理由**: このアプリは PostgreSQL 一本・Kamal 単一サーバ構成で、対戦は友達同士の1対1（同時接続はごく少数）。Redis を足すと Kamal のアクセサリ運用が1つ増えるのに対し、solid_cable なら新しいミドルウェアなしで済む。solid_cable のポーリング遅延（0.1秒）は、共有する情報が取得札数と決着通知だけの本対戦では体感に影響しない。認証は既存の cookie セッションを `ApplicationCable::Connection` がそのまま読む（`session[:user_id]`）ため、新しい認証経路も生まれない。

## Considered Options

- **(却下) Redis アダプタ** — 従来型で情報も多いが、redis gem の追加に加えて本番に Redis コンテナ（Kamal アクセサリ）の追加・監視が必要。この規模では運用コストに見合わない。将来スケールが必要になったら cable.yml の差し替えだけで移行できる。
- **(却下) HTTP ポーリング** — WebSocket 不要で最も単純だが、マッチング成立・相手の進捗・決着のたびにポーリング間隔ぶんの遅延と無駄なリクエストが発生する。「リアルタイムで確認できる」という要件に正面から反する。
- **(却下) 専用 cable DB（Rails 8 標準の solid_cable 構成）** — Rails 標準は cable 専用 DB を分けるが、database.yml・deploy.yml の複雑化と引き換えに得られる分離がこの書き込み量（2人×札取得ごと）では意味を持たない。`message_retention: 1.day` の自動トリムでテーブル肥大も抑えられる。

## Consequences

- **`solid_cable_messages` はプライマリ DB の通常テーブル。** スキーマは gem 同梱の cable_schema.rb と同一内容を通常のマイグレーションで管理する（`db/migrate/20260730000000_create_solid_cable_messages.rb`）。
- **チャンネルは `BattleChannel` 1本。** マッチング待機とプレイ中を分けない。subscribe 時に状態スナップショットを transmit し、broadcast の取りこぼし（subscribe 前に matched が流れた場合）を塞ぐ。
- **サーバは原則リレー。** 成績はクライアント申告値を数値フィールドだけホワイトリストして中継する。サーバが裁定するのはタイムアタックの先着完走（行ロック）だけ（ADR 0010）。
- **開発の `async` アダプタは単一プロセス限定。** Procfile.dev は puma 1プロセスなので成立する。プロセスを分ける構成にするなら開発も solid_cable に切り替えること。
- **購読解除＝離脱の検知に使う。** フロントの購読は battle-store（モジュールスコープ）が保持し、Inertia の SPA 遷移では切れない。タブを閉じる・リロードで `unsubscribed` が発火し、ルームの終了処理と相手への通知が走る。
