/**
 * 対戦モードの型定義。
 * 対戦は既存 2 モード（random / timeattack）を 2 人で個別同時プレイする（ADR 0010）。
 */

export type BattleMode = 'random' | 'timeattack';

export type BattleRoomStatus = 'waiting' | 'matched' | 'finished' | 'canceled';

/** BattlesController#show が渡す room props のワイヤ形状 */
export interface BattleRoomProps {
	id: number;
	gameMode: BattleMode;
	deck: string[]; // カード id の配列。両者同一順序（サーバがマッチ成立時に確定）
	hostId: number;
	guestId: number | null;
}

/** 最終スコア（クライアント申告値。BattleChannel がホワイトリストして中継する） */
export interface BattleStats {
	score: number | null; // random 用
	timeMs: number | null; // timeattack 用
	taken: number;
	accuracy: number;
	wpm: number | null;
	maxCombo: number;
}

/** 勝敗。walkover = 不戦勝（相手の離脱・結果未着） */
export type BattleOutcome = 'win' | 'lose' | 'draw' | 'walkover';

export type BattlePhase =
	| 'idle'
	| 'matching' // マッチング待機（合言葉送信済み）
	| 'readyWait' // マッチ成立〜両者 ready 待ち
	| 'playing'
	| 'waitingOpponent' // 自分は終了、相手の結果待ち
	| 'finished';

/** BattleChannel から届くメッセージ */
export type BattleServerMessage =
	| { type: 'state'; status: BattleRoomStatus; players: number[] }
	| { type: 'matched'; roomId: number }
	| { type: 'ready'; userId: number }
	| { type: 'progress'; userId: number; taken: number }
	| { type: 'player_finished'; userId: number; stats: BattleStats }
	| { type: 'match_decided'; winnerId: number }
	| { type: 'opponent_left'; userId: number };
