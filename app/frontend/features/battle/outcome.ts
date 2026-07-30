import type { BattleMode, BattleStats } from '@/types/battle';

/**
 * 対戦の勝敗導出（不戦勝を除く通常決着のみ）。
 * - random: スコアが高い方が勝ち。同点は引き分け
 * - timeattack: 先に 10 枚を打ち切った方が勝ち（サーバが裁定した winnerId に従う）
 * まだ決められない場合は null を返す。
 */
export function decideOutcome(input: {
	mode: BattleMode;
	myUserId: number;
	myStats: BattleStats | null;
	opponentStats: BattleStats | null;
	decidedWinnerId: number | null;
}): 'win' | 'lose' | 'draw' | null {
	if (input.mode === 'timeattack') {
		if (input.decidedWinnerId === null) return null;
		return input.decidedWinnerId === input.myUserId ? 'win' : 'lose';
	}

	if (!input.myStats || !input.opponentStats) return null;
	const mine = input.myStats.score ?? 0;
	const theirs = input.opponentStats.score ?? 0;
	if (mine === theirs) return 'draw';
	return mine > theirs ? 'win' : 'lose';
}
