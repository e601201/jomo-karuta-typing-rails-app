# ルート統合テストは実ストア駆動 + 末端モック、実タイマー演出はスタブで越える

ゲームルート（`routes/game`）の統合テストは、`gameStore` を丸ごとモックするビューテストではなく、実 `gameStore` を駆動し末端の副作用（`ImagePreloader` / `TypingSoundManager` / `$app/paths`）だけをモックする。実タイマーを持つ開始カウントダウンは、フェイクタイマーではなく `__testmocks__` のスタブコンポーネントで `onComplete` を発火させて越える。

**理由**: ルート↔ストアの契約ズレ（CI が緑のまま見逃す退行の本体）を捕捉でき、フェイクタイマー × happy-dom × userEvent のフレーキーさを避けられるため。#27（メインメニュー）や今後のルートテストも同方針。

## Considered Options

- **`gameStore` を丸ごとモック（旧来方式）** — 却下。ルート↔ストアの契約ズレを捕捉できず、実状態の形状をテスト側で手保守し続ける負債になる。
- **フェイクタイマーで実 `Countdown` を駆動** — 却下。`vi.useFakeTimers()` × `@testing-library/svelte` のフラッシュ × async `onMount` × 入れ子の `setTimeout` × `userEvent`（v14）が噛み合わず不安定。実 `Countdown` のタイマー描画は単体テストの責務とする。

## Consequences

- 実 `gameStore` は module-level singleton のため、テストは `beforeEach` で状態をリセットする必要がある（テスト間の状態汚染を防ぐ）。
- `.svelte` コンポーネントの `vi.mock`（`() => import('./__testmocks__/Countdown.svelte')`）はこのリポジトリ初の用法。配線が変換を通ることを着手時に確認する。
- 末端モックは `$app/paths` を含み、`src/test/setup.ts` に共有で置く（#27 と共用）。
