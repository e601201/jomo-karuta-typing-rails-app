/**
 * タイムアタックモードのペナルティ定数（旧 game/+page.svelte および
 * stores/game.ts に埋め込まれていた値の抽出）。
 * 最終タイム = 経過時間 + ペナルティ合計。
 */

/** 誤入力1回あたりのペナルティ（旧 +page.svelte handleCharacterInput 内の +2000ms） */
export const TIMEATTACK_MISTAKE_PENALTY_MS = 2000;

/** スキップ1回あたりのペナルティ（旧 stores/game.ts skipCard 内の +10000ms） */
export const TIMEATTACK_SKIP_PENALTY_MS = 10000;
