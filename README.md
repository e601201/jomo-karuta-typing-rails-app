# 上毛かるたタイピング (Rails + React)

上毛かるた44札の読みをローマ字でタイピングするゲーム。
[jomo-karuta-typing-front-app](https://github.com/e601201/jomo-karuta-typing-front-app) (SvelteKit + Supabase) を **Rails 8 + inertia_rails + React 19** で再構築したものです。旧アプリは並行稼働しており、本リポジトリへのデータ移行は行っていません。

## 技術スタック

- **Rails 8.1** — ルーティング / コントローラ / PostgreSQL (スコア・ランキング・ユーザー)
- **inertia_rails + React 19 + TypeScript** — Rails が React SPA をホスト (API 分離なし)
- **zustand** — ゲームエンジン / 設定ストア (旧 Svelte store の 1:1 移植)
- **OmniAuth** — Google / GitHub OAuth (旧 Supabase Auth の置き換え)
- **Tailwind CSS 4 / Vite (vite_rails) / bun**
- **Vitest + Testing Library / RSpec + FactoryBot**

## セットアップ

```bash
bundle install
bun install
cp .env.example .env   # Google/GitHub OAuth クレデンシャルを設定
bin/rails db:prepare
bin/dev                # Rails (PORT 環境変数、デフォルト3000) + Vite dev server
```

PostgreSQL がローカルで起動している必要があります (`config/database.yml` は localhost デフォルト、`DATABASE_URL` で上書き可)。

## 開発コマンド

| コマンド | 内容 |
| --- | --- |
| `bin/dev` | 開発サーバ (Rails + Vite) |
| `bun run test` | フロントエンドテスト (Vitest) |
| `bun run test:unit` | Vitest watch モード |
| `bun run check` | TypeScript 型チェック |
| `bun run lint` / `bun run format` | Prettier + ESLint |
| `bundle exec rspec` | バックエンドテスト |
| `bundle exec rubocop` | Ruby lint |

## アーキテクチャ

- `app/frontend/pages/` — Inertia ページ (Home / Game / Ranking / Settings / PracticeSpecific / Profile / auth)
- `app/frontend/features/game/` — 旧 `+page.svelte` から抽出したタイピング判定・ローマ字ガイドの純関数群
- `app/frontend/lib/typing/input-validator.ts` — ローマ字判定エンジン (旧リポジトリから無変更移植。spec が挙動契約)
- `app/frontend/stores/game-store.ts` — ゲームエンジン (zustand)
- `CONTEXT.md` — ドメイン用語集 (撥音ルール・ライブ/最終スコア等)。挙動パリティの正典
- `docs/adr/` — テスト戦略の ADR (旧リポジトリから引き継ぎ)

## ゲームモード

| モード | URL | 内容 |
| --- | --- | --- |
| 練習 | `/game?mode=practice` | 全44札を順番に |
| 特定札 | `/practice/specific` → `/game?mode=specific&cards=...` | 選択した札 (繰り返し・シャッフル) |
| ランダム | `/game?mode=random&difficulty=beginner\|standard\|advanced` | 60秒制限。beginner は短縮読み、advanced はブラインド入力 |
| タイムアタック | `/game?mode=timeattack` | 10枚。ミス+2秒 / スキップ+10秒ペナルティ |
