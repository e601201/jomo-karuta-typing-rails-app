# 本番デプロイ手順（Kamal + VPS 1台構成）

Rails 8 標準の [Kamal](https://kamal-deploy.org) で、VPS 1台にアプリと PostgreSQL を同居させてデプロイする。
PostgreSQL はアプリ DB と Solid Cable（対戦モードの pub/sub）を兼ねる（ADR 0009）。Redis は不要。

```
ユーザー ──HTTPS/WSS──> kamal-proxy（Let's Encrypt 自動）──> Rails（Thruster + Puma）
                                                              │ Docker ネットワーク (kamal)
                                                        PostgreSQL（Kamal accessory）
```

## 事前準備（初回のみ）

### 1. VPS

- 要件: **amd64 / Ubuntu LTS または Debian / メモリ 2GB 推奨（1GB でも可）/ SSH 鍵でログイン可能**
- Docker は `kamal setup` が自動インストールするので事前準備不要
- ファイアウォール（さくら VPS のパケットフィルタ等）で **22 / 80 / 443** を開放する
- root 以外のユーザーで SSH する場合は `config/deploy.yml` の `ssh: user:` を有効化する

### 2. ドメイン

- A レコードを VPS の IP に向ける（Let's Encrypt の証明書取得と OAuth コールバックの前提）

### 3. OAuth クレデンシャル（本番用）

開発用とは別に、本番ドメインのコールバック URL で発行する。

| プロバイダ | 発行場所                                                                  | コールバック URL                                 |
| ---------- | ------------------------------------------------------------------------- | ------------------------------------------------ |
| Google     | [Google Cloud Console](https://console.cloud.google.com/apis/credentials) | `https://<ドメイン>/auth/google_oauth2/callback` |
| GitHub     | [Developer settings](https://github.com/settings/developers)              | `https://<ドメイン>/auth/github/callback`        |

### 4. シークレットの設定

秘密情報はすべて Rails credentials（`config/credentials.yml.enc`）に集約している。
`.kamal/secrets` がデプロイ時に `credentials:fetch` で取り出す。手元に必要な鍵は `config/master.key` だけ。

```sh
bin/rails credentials:edit
```

- `db.password` … 生成済み（変更不要）
- `google.client_id` / `google.client_secret` … `REPLACE_ME` を本番用の値に置き換える
- `github.client_id` / `github.client_secret` … 同上
- `admin.emails` … 運営のメールアドレス（カンマ区切り、大小文字無視）。アプリは ENV `ADMIN_EMAILS` として受け取る

> **順序**: `.kamal/secrets` は `credentials:fetch admin.emails` の失敗で非ゼロ終了する。**Kamal の `ADMIN_EMAILS` 配線をデプロイする前に**、必ず `bin/rails credentials:edit` で `admin.emails` を入れておく。未投入のままデプロイするとデプロイ自体が落ちる。

### 5. config/deploy.yml の TODO を置き換え

- `servers.web` と `accessories.db.host` … VPS の IP アドレス（2箇所、同じ値）
- `proxy.host` … 取得したドメイン

## 初回デプロイ

```sh
bin/kamal setup
```

サーバーへの Docker インストール → PostgreSQL accessory 起動 → イメージビルド → デプロイまで一括で行う。
起動時に `bin/docker-entrypoint` が `db:prepare` を実行するため、DB スキーマ（Solid Cable 含む）は自動で入る。

> **Apple Silicon の場合**: `builder.arch: amd64` のためエミュレーションでビルドされ、初回は時間がかかる。
> 遅すぎる場合は VPS 自体をビルダーにできる:
>
> ```yaml
> builder:
>   arch: amd64
>   remote: ssh://root@<VPS の IP>
> ```

### 動作確認

- `https://<ドメイン>/up` が 200 を返す
- Google / GitHub ログインが通る
- 対戦モードでマッチングできる（WebSocket 接続。ブラウザ 2 窓で確認）
- 運営アカウントでログインして `/admin/feedbacks` が開ける（開けなければ `ADMIN_EMAILS` の注入失敗）

## 2回目以降のデプロイ

```sh
bin/kamal deploy
```

## 日常運用

```sh
bin/kamal logs        # ログを tail
bin/kamal console     # 本番 Rails コンソール
bin/kamal dbc         # 本番 DB コンソール
bin/kamal shell       # コンテナ内 bash
bin/kamal rollback <version>   # 直前イメージへ切り戻し（kamal audit で version 確認）
bin/kamal accessory logs db    # PostgreSQL のログ
```

## バックアップ

DB はサーバー上の Docker volume にしか無いため、定期バックアップを必ず仕込む。
サーバーの root crontab に登録する例（毎日 4:00 JST、14 世代保持）:

```sh
mkdir -p /root/backups
crontab -e
```

```cron
0 4 * * * docker exec jomo_karuta_typing_rails_app-db pg_dump -U jomo_karuta_typing_rails_app jomo_karuta_typing_rails_app_production | gzip > /root/backups/karuta-$(date +\%F).sql.gz && ls -t /root/backups/karuta-*.sql.gz | tail -n +15 | xargs -r rm
```

サーバー障害に備えるならさらに rclone 等でオブジェクトストレージ（S3 / R2 など）へ転送する。

リストア:

```sh
gunzip -c karuta-<日付>.sql.gz | docker exec -i jomo_karuta_typing_rails_app-db psql -U jomo_karuta_typing_rails_app jomo_karuta_typing_rails_app_production
```
