/**
 * 対戦進行ストアのテスト。
 * Action Cable / API / Inertia router はモックし、受信ハンドラ（handleReceived）を直接叩く。
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { BattleMode, BattleStats } from '@/types/battle';
import { HttpError } from '@/lib/http';

const mockSubscription = {
	perform: vi.fn(),
	unsubscribe: vi.fn()
};

vi.mock('@/lib/cable', () => ({
	getConsumer: () => ({
		subscriptions: {
			create: vi.fn(() => mockSubscription)
		}
	})
}));

vi.mock('@/lib/api/battle-rooms', () => ({
	createOrJoinBattleRoom: vi.fn(),
	cancelBattleRoom: vi.fn()
}));

vi.mock('@inertiajs/react', () => ({
	router: {
		visit: vi.fn(),
		on: vi.fn()
	}
}));

import { router } from '@inertiajs/react';
import { createOrJoinBattleRoom, cancelBattleRoom } from '@/lib/api/battle-rooms';
import {
	battleStore,
	createBattleStore,
	handleNavigateAway,
	READY_FAILSAFE_MS,
	WALKOVER_TIMEOUT_MS
} from './battle-store';

const ME = 1;
const OPPONENT = 2;

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

async function startMatched(
	store: ReturnType<typeof createBattleStore>,
	mode: BattleMode = 'random'
) {
	vi.mocked(createOrJoinBattleRoom).mockResolvedValue({
		success: true,
		status: 'matched',
		room: { id: 42 }
	});
	await store.startMatching(mode, 'gunma', ME);
}

beforeEach(() => {
	vi.clearAllMocks();
	vi.useFakeTimers();
});

afterEach(() => {
	vi.useRealTimers();
});

describe('BattleStore - マッチング', () => {
	it('待機部屋を作ったら matching のまま購読して待つ', async () => {
		const store = createBattleStore();
		vi.mocked(createOrJoinBattleRoom).mockResolvedValue({
			success: true,
			status: 'waiting',
			room: { id: 7 }
		});

		await store.startMatching('random', 'gunma', ME);

		const state = store.store.getState();
		expect(state.phase).toBe('matching');
		expect(state.roomId).toBe(7);
		expect(router.visit).not.toHaveBeenCalled();
	});

	it('既存の待機部屋に参加して成立したら対戦ページへ遷移する', async () => {
		const store = createBattleStore();
		await startMatched(store);

		expect(store.store.getState().phase).toBe('readyWait');
		expect(router.visit).toHaveBeenCalledWith('/battle/42');
	});

	it('API エラー時は idle に戻してエラーメッセージを保持する', async () => {
		const store = createBattleStore();
		vi.mocked(createOrJoinBattleRoom).mockRejectedValue(
			new HttpError(422, '合言葉を入力してください', {})
		);

		await store.startMatching('random', '', ME);

		const state = store.store.getState();
		expect(state.phase).toBe('idle');
		expect(state.matchingError).toBe('合言葉を入力してください');
	});

	it('待機中に matched broadcast を受けたら対戦ページへ遷移する', async () => {
		const store = createBattleStore();
		vi.mocked(createOrJoinBattleRoom).mockResolvedValue({
			success: true,
			status: 'waiting',
			room: { id: 7 }
		});
		await store.startMatching('random', 'gunma', ME);

		store.handleReceived({ type: 'matched', roomId: 7 });

		expect(store.store.getState().phase).toBe('readyWait');
		expect(router.visit).toHaveBeenCalledWith('/battle/7');
	});

	it('subscribe 時の state スナップショットが matched なら遷移する（broadcast 取りこぼし救済）', async () => {
		const store = createBattleStore();
		vi.mocked(createOrJoinBattleRoom).mockResolvedValue({
			success: true,
			status: 'waiting',
			room: { id: 7 }
		});
		await store.startMatching('random', 'gunma', ME);

		store.handleReceived({ type: 'state', status: 'matched', players: [ME, OPPONENT] });

		expect(router.visit).toHaveBeenCalledWith('/battle/7');
	});

	it('キャンセルすると購読を解除して idle に戻る', async () => {
		const store = createBattleStore();
		vi.mocked(createOrJoinBattleRoom).mockResolvedValue({
			success: true,
			status: 'waiting',
			room: { id: 7 }
		});
		vi.mocked(cancelBattleRoom).mockResolvedValue(undefined);
		await store.startMatching('random', 'gunma', ME);

		await store.cancelMatching();

		expect(cancelBattleRoom).toHaveBeenCalledWith(7);
		expect(mockSubscription.unsubscribe).toHaveBeenCalled();
		expect(store.store.getState().phase).toBe('idle');
	});

	it('キャンセルが参加と競合して 409 になったら対戦ページへ進む', async () => {
		const store = createBattleStore();
		vi.mocked(createOrJoinBattleRoom).mockResolvedValue({
			success: true,
			status: 'waiting',
			room: { id: 7 }
		});
		vi.mocked(cancelBattleRoom).mockRejectedValue(
			new HttpError(409, 'matched', { status: 'matched', room: { id: 7 } })
		);
		await store.startMatching('random', 'gunma', ME);

		await store.cancelMatching();

		expect(router.visit).toHaveBeenCalledWith('/battle/7');
	});
});

describe('BattleStore - ready 同期', () => {
	it('sendReady でチャンネルへ ready を送る', async () => {
		const store = createBattleStore();
		await startMatched(store);

		store.sendReady();

		expect(mockSubscription.perform).toHaveBeenCalledWith('ready', {});
		expect(store.store.getState().myReady).toBe(true);
	});

	it('相手の ready を受けたら opponentReady になる（自分の echo は無視）', async () => {
		const store = createBattleStore();
		await startMatched(store);

		store.handleReceived({ type: 'ready', userId: ME });
		expect(store.store.getState().opponentReady).toBe(false);

		store.handleReceived({ type: 'ready', userId: OPPONENT });
		expect(store.store.getState().opponentReady).toBe(true);
	});

	it('相手の ready が届かなくてもフェイルセーフで単独開始できる', async () => {
		const store = createBattleStore();
		await startMatched(store);

		store.sendReady();
		vi.advanceTimersByTime(READY_FAILSAFE_MS);

		expect(store.store.getState().opponentReady).toBe(true);
	});
});

describe('BattleStore - プレイ中', () => {
	it('相手の progress で取得札数が更新される（自分の echo は無視）', async () => {
		const store = createBattleStore();
		await startMatched(store);
		store.markPlaying();

		store.handleReceived({ type: 'progress', userId: OPPONENT, taken: 3 });
		expect(store.store.getState().opponentTaken).toBe(3);

		store.handleReceived({ type: 'progress', userId: ME, taken: 9 });
		expect(store.store.getState().opponentTaken).toBe(3);
	});

	it('sendProgress でチャンネルへ taken を送る', async () => {
		const store = createBattleStore();
		await startMatched(store);

		store.sendProgress(5);

		expect(mockSubscription.perform).toHaveBeenCalledWith('progress', { taken: 5 });
	});
});

describe('BattleStore - 決着（random）', () => {
	it('自分が先に終わると相手の結果待ちになり、届いたらスコアで勝敗が決まる', async () => {
		const store = createBattleStore();
		await startMatched(store);
		store.markPlaying();

		store.sendFinished(stats({ score: 8450, taken: 12 }));
		expect(store.store.getState().phase).toBe('waitingOpponent');

		store.handleReceived({
			type: 'player_finished',
			userId: OPPONENT,
			stats: stats({ score: 6920, taken: 9 })
		});

		const state = store.store.getState();
		expect(state.outcome).toBe('win');
		expect(state.phase).toBe('finished');
	});

	it('相手が先に終わっていた場合は自分の終了と同時に決着する', async () => {
		const store = createBattleStore();
		await startMatched(store);
		store.markPlaying();

		store.handleReceived({
			type: 'player_finished',
			userId: OPPONENT,
			stats: stats({ score: 9000 })
		});
		store.sendFinished(stats({ score: 100 }));

		const state = store.store.getState();
		expect(state.outcome).toBe('lose');
		expect(state.phase).toBe('finished');
	});

	it('同点は引き分けになる', async () => {
		const store = createBattleStore();
		await startMatched(store);
		store.markPlaying();

		store.sendFinished(stats({ score: 500 }));
		store.handleReceived({
			type: 'player_finished',
			userId: OPPONENT,
			stats: stats({ score: 500 })
		});

		expect(store.store.getState().outcome).toBe('draw');
	});

	it('相手の結果が届かないままタイムアウトしたら不戦勝になる', async () => {
		const store = createBattleStore();
		await startMatched(store);
		store.markPlaying();

		store.sendFinished(stats({ score: 500 }));
		vi.advanceTimersByTime(WALKOVER_TIMEOUT_MS);

		const state = store.store.getState();
		expect(state.outcome).toBe('walkover');
		expect(state.phase).toBe('finished');
	});
});

describe('BattleStore - 決着（timeattack）', () => {
	it('サーバ裁定で自分が勝者なら win になる', async () => {
		const store = createBattleStore();
		await startMatched(store, 'timeattack');
		store.markPlaying();

		store.sendFinished(stats({ timeMs: 58320, taken: 10 }));
		store.handleReceived({ type: 'match_decided', winnerId: ME });

		const state = store.store.getState();
		expect(state.outcome).toBe('win');
		expect(state.phase).toBe('finished');
	});

	it('相手が先着したら自分の終了報告後に lose で確定する', async () => {
		const store = createBattleStore();
		await startMatched(store, 'timeattack');
		store.markPlaying();

		store.handleReceived({ type: 'match_decided', winnerId: OPPONENT });
		expect(store.store.getState().outcome).toBe('lose');

		store.sendFinished(stats({ taken: 7 }));
		expect(store.store.getState().phase).toBe('finished');
	});
});

describe('BattleStore - 相手の離脱', () => {
	it('決着前に相手が離脱したら不戦勝になる', async () => {
		const store = createBattleStore();
		await startMatched(store);
		store.markPlaying();

		store.handleReceived({ type: 'opponent_left', userId: OPPONENT });

		const state = store.store.getState();
		expect(state.opponentLeft).toBe(true);
		expect(state.outcome).toBe('walkover');
	});

	it('相手の結果が届いた後の離脱は通常の決着に任せる', async () => {
		const store = createBattleStore();
		await startMatched(store);
		store.markPlaying();

		store.handleReceived({
			type: 'player_finished',
			userId: OPPONENT,
			stats: stats({ score: 100 })
		});
		store.handleReceived({ type: 'opponent_left', userId: OPPONENT });

		expect(store.store.getState().outcome).toBeNull();

		store.sendFinished(stats({ score: 200 }));
		expect(store.store.getState().outcome).toBe('win');
	});

	it('leaveBattle で購読を解除して初期状態に戻る', async () => {
		const store = createBattleStore();
		await startMatched(store);

		store.leaveBattle();

		expect(mockSubscription.unsubscribe).toHaveBeenCalled();
		expect(store.store.getState().phase).toBe('idle');
	});

	it('プレイ開始前（readyWait）に相手が離脱したら成績なしのままリザルトへ進む', async () => {
		const store = createBattleStore();
		await startMatched(store);

		store.handleReceived({ type: 'opponent_left', userId: OPPONENT });

		const state = store.store.getState();
		expect(state.outcome).toBe('walkover');
		expect(state.phase).toBe('finished');
		expect(state.myStats).toBeNull();
	});
});

describe('BattleStore - ページ遷移での離脱判定（handleNavigateAway はシングルトンを対象にする）', () => {
	afterEach(() => {
		battleStore.reset();
	});

	async function singletonMatched() {
		vi.mocked(createOrJoinBattleRoom).mockResolvedValue({
			success: true,
			status: 'matched',
			room: { id: 42 }
		});
		await battleStore.startMatching('random', 'gunma', ME);
	}

	it('対戦中に対戦ページ以外へ遷移したら離脱して初期状態に戻る', async () => {
		await singletonMatched();
		battleStore.markPlaying();

		handleNavigateAway('/');

		expect(mockSubscription.unsubscribe).toHaveBeenCalled();
		expect(battleStore.store.getState().phase).toBe('idle');
	});

	it('対戦ページ自身への遷移（マッチ直後の入場）では離脱しない', async () => {
		await singletonMatched();

		handleNavigateAway('/battle/42');

		expect(battleStore.store.getState().phase).toBe('readyWait');
	});

	it('マッチング待機中に別ページへ遷移したら待機をキャンセルする', async () => {
		vi.mocked(createOrJoinBattleRoom).mockResolvedValue({
			success: true,
			status: 'waiting',
			room: { id: 7 }
		});
		vi.mocked(cancelBattleRoom).mockResolvedValue(undefined);
		await battleStore.startMatching('random', 'gunma', ME);

		handleNavigateAway('/ranking');
		await vi.waitFor(() => {
			expect(cancelBattleRoom).toHaveBeenCalledWith(7);
		});
	});
});

describe('BattleStore - 再戦', () => {
	it('決着後の startMatching で結果がリセットされ、購読が張り直される', async () => {
		const store = createBattleStore();
		await startMatched(store);
		store.markPlaying();
		store.sendFinished(stats({ score: 500 }));
		store.handleReceived({
			type: 'player_finished',
			userId: OPPONENT,
			stats: stats({ score: 100 })
		});
		expect(store.store.getState().phase).toBe('finished');

		vi.mocked(createOrJoinBattleRoom).mockResolvedValue({
			success: true,
			status: 'waiting',
			room: { id: 99 }
		});
		await store.startMatching('random', 'gunma', ME);

		const state = store.store.getState();
		expect(mockSubscription.unsubscribe).toHaveBeenCalled();
		expect(state.phase).toBe('matching');
		expect(state.roomId).toBe(99);
		expect(state.myStats).toBeNull();
		expect(state.opponentStats).toBeNull();
		expect(state.outcome).toBeNull();
		expect(state.opponentTaken).toBe(0);
	});
});
