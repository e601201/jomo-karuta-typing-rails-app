import { describe, it, expect } from 'vitest';
import { decideOutcome } from './outcome';
import type { BattleStats } from '@/types/battle';

function stats(overrides: Partial<BattleStats> = {}): BattleStats {
	return {
		score: null,
		timeMs: null,
		taken: 0,
		accuracy: 100,
		wpm: 60,
		maxCombo: 5,
		...overrides
	};
}

describe('decideOutcome - random', () => {
	it('スコアが高い方が勝ち', () => {
		expect(
			decideOutcome({
				mode: 'random',
				myUserId: 1,
				myStats: stats({ score: 8450 }),
				opponentStats: stats({ score: 6920 }),
				decidedWinnerId: null
			})
		).toBe('win');
	});

	it('スコアが低ければ負け', () => {
		expect(
			decideOutcome({
				mode: 'random',
				myUserId: 1,
				myStats: stats({ score: 100 }),
				opponentStats: stats({ score: 200 }),
				decidedWinnerId: null
			})
		).toBe('lose');
	});

	it('同点は引き分け', () => {
		expect(
			decideOutcome({
				mode: 'random',
				myUserId: 1,
				myStats: stats({ score: 500 }),
				opponentStats: stats({ score: 500 }),
				decidedWinnerId: null
			})
		).toBe('draw');
	});

	it('相手の結果が届くまでは決められない', () => {
		expect(
			decideOutcome({
				mode: 'random',
				myUserId: 1,
				myStats: stats({ score: 500 }),
				opponentStats: null,
				decidedWinnerId: null
			})
		).toBeNull();
	});
});

describe('decideOutcome - timeattack', () => {
	it('サーバが裁定した先着完走者が勝ち', () => {
		expect(
			decideOutcome({
				mode: 'timeattack',
				myUserId: 1,
				myStats: null,
				opponentStats: null,
				decidedWinnerId: 1
			})
		).toBe('win');
	});

	it('相手が先着したら負け', () => {
		expect(
			decideOutcome({
				mode: 'timeattack',
				myUserId: 1,
				myStats: stats(),
				opponentStats: null,
				decidedWinnerId: 2
			})
		).toBe('lose');
	});

	it('裁定が届くまでは決められない', () => {
		expect(
			decideOutcome({
				mode: 'timeattack',
				myUserId: 1,
				myStats: stats(),
				opponentStats: stats(),
				decidedWinnerId: null
			})
		).toBeNull();
	});
});
