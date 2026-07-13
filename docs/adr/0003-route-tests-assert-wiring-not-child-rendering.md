# ストア所有ルートでも、子に専用specがある描画はルートで再アサートしない（ADR 0002 の精緻化）

ストアを所有するルート（`/game`）の統合テストは、ADR 0001/0002 の「実コンポーネント駆動 + 末端スタブ」「ルートが所有する契約を守る」を引き継ぐが、**子コンポーネントに専用の component spec がある描画は route 側で再アサートしない**。route が守るのは ①打鍵→`gameStore.updateInput`→ページが `inputStates`/`romajiGuide` を再計算→子へプロップ伝播、②`pause`/`skip`→store→UI ゲート、という**配線契約**だけ。文字色・オーバーレイ内容など子の描画は `InputHighlight.spec.ts` / `PauseOverlay.spec.ts` に委譲し、**本番マークアップへ新しいテストフックを足さない**。旧来の DOM 網羅テストが見ていた描画カバレッジは component spec 層へ降ろす。

**理由**: route 層で捕捉する価値がある退行の本体は「配線ズレ」（打鍵が store に届かない／store の score が子に渡らない／pause/skip が状態に反映されない）であって、子の描画そのものではない。#29 が「復活」を求めた入力ハイライト・ローマ字ガイド・一時停止内容は、すでに `InputHighlight.spec.ts`（TC-001/002/003/006/007）と `PauseOverlay.spec.ts`（TC-011/012/013/015）で担保済み。旧 `game.spec.ts`（commit `4b1b811`, 1533行）の該当テストは `gameStore.gameStore.update(...)` で状態注入して DOM を直接アサートする **ADR 0001 が却下した「ストア丸ごとモック＝ビューテスト」** そのものであり、素直に復活させると却下済み方式への逆戻り＋ component spec との二重管理になる。

## Considered Options

- **旧 DOM 網羅テストを #29 原文どおり復活（`input-highlight-N` / `romaji-guide` / `error-indicator` / `wpm-display` 等のフックを本番マークアップへ再導入）** — 却下。ADR 0001 が却下した方式への逆戻りであり、`InputHighlight`/`PauseOverlay` の component spec と描画を二重検証する。さらに旧フックの多くは既に改名・現存（`char-N` / `romaji-char-N`）しており、別名フックの追加は非整合を生む。
- **route と component の両層で描画を二重に検証** — 却下。契約と無関係な手保守。色スキーム変更（旧 `text-green-600` → 現 `text-gray-200`）のたびに2箇所を直す負債になる。

## Consequences

- 「復活させたい」テスト要望は、まず描画が子の component spec で担保済みかを確認し、**未担保の配線だけ**を route に書く。観測は既存の子 testid（`char-N` / `romaji-char-N` / `pause-overlay`）＋ store 状態＋可視テキスト（`getByText`）で行い、本番マークアップに新 testid を原則足さない。page 専有で `getByText` が脆い箇所（card-count 進捗）に限り testid 1個を許容する。
- 製品に存在しない表示（入力進捗バー・ライブ WPM）は**テストの穴ではなく機能の不在**。テストではなく別の製品 issue で扱う。ライブと最終の区別は CONTEXT.md「ライブスコア / 最終スコア」を参照（WPM はライブには無く最終スコアのみ）。
- 誤入力等の**時間依存 DOM**（500ms の赤フラッシュ・2s のヒント）はアサートせず、store 由来のライブスコア（`combo` / `accuracy`、既存の `combo-display` / `accuracy-display`）で観測する。これは ADR 0001 のフェイクタイマー回避と一貫する。
- `/settings`＝`settingsStore` など他のストア所有ルートも、子に component spec がある描画は同様に route で再アサートしない。
