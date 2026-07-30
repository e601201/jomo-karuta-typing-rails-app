/**
 * 対戦モードの進行管理ストア（zustand vanilla）。
 *
 * BattleChannel の購読はこのモジュール（ストアのクロージャ）が保持する。
 * Inertia の SPA 遷移では購読が生き続けるため、タブを閉じる・リロードする・
 * leaveBattle() を呼ぶ、のいずれかだけが購読解除（＝サーバから見た離脱）になる。
 * ローカルのタイピング進行は game-store が担い、このストアは相手側の状態と勝敗だけを持つ。
 */

import { createStore, type StoreApi } from 'zustand/vanilla';
import { useStore } from 'zustand';
import { router } from '@inertiajs/react';
import type { Subscription } from '@rails/actioncable';
import { getConsumer } from '@/lib/cable';
import { createOrJoinBattleRoom, cancelBattleRoom } from '@/lib/api/battle-rooms';
import { HttpError } from '@/lib/http';
import { decideOutcome } from '@/features/battle/outcome';
import type {
	BattleMode,
	BattleOutcome,
	BattlePhase,
	BattleServerMessage,
	BattleStats
} from '@/types/battle';

/** 相手の ready が届かないときに単独でカウントダウンを始めるまでの猶予 */
export const READY_FAILSAFE_MS = 10000;
/** 自分の終了後、相手の結果を待つ猶予。超えたら不戦勝（ウォークオーバー） */
export const WALKOVER_TIMEOUT_MS = 20000;

export interface BattleState {
	phase: BattlePhase;
	mode: BattleMode | null;
	passphrase: string | null;
	roomId: number | null;
	myUserId: number | null;
	myReady: boolean;
	opponentReady: boolean;
	opponentTaken: number;
	opponentStats: BattleStats | null;
	opponentLeft: boolean;
	myStats: BattleStats | null;
	decidedWinnerId: number | null;
	outcome: BattleOutcome | null;
	matchingError: string | null;
}

const initialState: BattleState = {
	phase: 'idle',
	mode: null,
	passphrase: null,
	roomId: null,
	myUserId: null,
	myReady: false,
	opponentReady: false,
	opponentTaken: 0,
	opponentStats: null,
	opponentLeft: false,
	myStats: null,
	decidedWinnerId: null,
	outcome: null,
	matchingError: null
};

export function createBattleStore() {
	const store: StoreApi<BattleState> = createStore<BattleState>(() => initialState);

	let subscription: Subscription | null = null;
	let readyFailsafeTimer: ReturnType<typeof setTimeout> | null = null;
	let walkoverTimer: ReturnType<typeof setTimeout> | null = null;

	function update(partial: Partial<BattleState>) {
		store.setState({ ...store.getState(), ...partial }, true);
	}

	function clearTimers() {
		if (readyFailsafeTimer) {
			clearTimeout(readyFailsafeTimer);
			readyFailsafeTimer = null;
		}
		if (walkoverTimer) {
			clearTimeout(walkoverTimer);
			walkoverTimer = null;
		}
	}

	function unsubscribe() {
		subscription?.unsubscribe();
		subscription = null;
	}

	function subscribeToRoom(roomId: number) {
		unsubscribe();
		subscription = getConsumer().subscriptions.create(
			{ channel: 'BattleChannel', id: roomId },
			{
				received: (message: BattleServerMessage) => handleReceived(message)
			}
		);
	}

	/** マッチ成立。プレイ画面へ遷移する（ready 待ちは Battle ページ側で始まる） */
	function goToBattle() {
		const { roomId } = store.getState();
		if (!roomId) return;
		update({ phase: 'readyWait' });
		router.visit(`/battle/${roomId}`);
	}

	/** 勝敗が確定していれば outcome / phase に反映する */
	function resolveOutcome() {
		const state = store.getState();
		if (state.outcome || !state.mode || state.myUserId === null) return;

		const outcome = decideOutcome({
			mode: state.mode,
			myUserId: state.myUserId,
			myStats: state.myStats,
			opponentStats: state.opponentStats,
			decidedWinnerId: state.decidedWinnerId
		});
		if (!outcome) return;

		clearTimers();
		update({ outcome });
		recomputePhase();
	}

	/** 終盤の phase は「自分が終わったか」「勝敗が出たか」から導出する */
	function recomputePhase() {
		const state = store.getState();
		if (state.phase === 'idle' || state.phase === 'matching') return;

		if (state.outcome && state.myStats) {
			update({ phase: 'finished' });
		} else if (state.outcome && state.phase === 'readyWait') {
			// プレイ開始前に決着した（相手が ready 前に離脱など）。成績なしのままリザルトへ進める
			update({ phase: 'finished' });
		} else if (state.myStats) {
			update({ phase: 'waitingOpponent' });
		}
	}

	function handleReceived(message: BattleServerMessage) {
		const state = store.getState();

		switch (message.type) {
			case 'state':
				// subscribe 時のスナップショット。matched broadcast を取りこぼしていたら遷移する
				if (message.status === 'matched' && state.phase === 'matching') {
					goToBattle();
				}
				break;
			case 'matched':
				if (state.phase === 'matching') {
					goToBattle();
				}
				break;
			case 'ready':
				if (message.userId !== state.myUserId) {
					update({ opponentReady: true });
				}
				break;
			case 'progress':
				if (message.userId !== state.myUserId) {
					update({ opponentTaken: message.taken });
				}
				break;
			case 'player_finished':
				if (message.userId !== state.myUserId) {
					update({ opponentStats: message.stats, opponentTaken: message.stats.taken });
					resolveOutcome();
				}
				break;
			case 'match_decided':
				update({ decidedWinnerId: message.winnerId });
				resolveOutcome();
				break;
			case 'opponent_left':
				if (message.userId !== state.myUserId) {
					update({ opponentLeft: true });
					// 相手が結果を残さず離脱したら不戦勝。結果報告済み・決着済みなら通常の決着に任せる
					if (!state.outcome && !state.opponentStats && state.decidedWinnerId === null) {
						clearTimers();
						update({ outcome: 'walkover' });
						recomputePhase();
					}
				}
				break;
		}
	}

	/** 合言葉マッチングを開始する（join-or-create）。成立済みならそのままプレイ画面へ */
	async function startMatching(mode: BattleMode, passphrase: string, myUserId: number) {
		clearTimers();
		unsubscribe();
		store.setState(
			{
				...initialState,
				phase: 'matching',
				mode,
				passphrase,
				myUserId
			},
			true
		);

		try {
			const response = await createOrJoinBattleRoom(mode, passphrase);
			update({ roomId: response.room.id });
			subscribeToRoom(response.room.id);
			if (response.status === 'matched') {
				goToBattle();
			}
		} catch (error) {
			unsubscribe();
			update({
				phase: 'idle',
				matchingError: error instanceof Error ? error.message : 'マッチングの開始に失敗しました'
			});
		}
	}

	/** マッチング待機をやめる。参加と競合して成立済み（409）ならそのままプレイ画面へ */
	async function cancelMatching() {
		const { roomId } = store.getState();
		if (!roomId) {
			reset();
			return;
		}

		try {
			await cancelBattleRoom(roomId);
			reset();
		} catch (error) {
			if (error instanceof HttpError && error.status === 409) {
				goToBattle();
				return;
			}
			reset();
		}
	}

	/**
	 * 対戦ページのマウント＋プリロード完了の合図。
	 * 相手の ready が一定時間届かなければフェイルセーフで単独開始する。
	 */
	function sendReady() {
		const state = store.getState();
		if (state.myReady) return;

		update({ myReady: true });
		subscription?.perform('ready', {});

		if (!state.opponentReady && !readyFailsafeTimer) {
			readyFailsafeTimer = setTimeout(() => {
				readyFailsafeTimer = null;
				if (!store.getState().opponentReady) {
					update({ opponentReady: true });
				}
			}, READY_FAILSAFE_MS);
		}
	}

	/** カウントダウン完了でプレイ中へ */
	function markPlaying() {
		if (readyFailsafeTimer) {
			clearTimeout(readyFailsafeTimer);
			readyFailsafeTimer = null;
		}
		update({ phase: 'playing' });
	}

	function sendProgress(taken: number) {
		subscription?.perform('progress', { taken });
	}

	/**
	 * ローカルのプレイ終了を報告する。
	 * 勝敗が出るまで（相手の結果 or サーバ裁定 or 相手離脱）待ち、
	 * 一定時間何も届かなければ不戦勝とする。
	 */
	function sendFinished(stats: BattleStats) {
		const state = store.getState();
		if (state.myStats) return;

		update({ myStats: stats });
		subscription?.perform('finished', { stats });
		resolveOutcome();
		recomputePhase();

		if (!store.getState().outcome && !walkoverTimer) {
			walkoverTimer = setTimeout(() => {
				walkoverTimer = null;
				if (!store.getState().outcome) {
					update({ outcome: 'walkover' });
					recomputePhase();
				}
			}, WALKOVER_TIMEOUT_MS);
		}
	}

	/** 対戦から離脱する（購読解除＝サーバへの離脱通知） */
	function leaveBattle() {
		reset();
	}

	function reset() {
		clearTimers();
		unsubscribe();
		store.setState(initialState, true);
	}

	return {
		store,
		startMatching,
		cancelMatching,
		sendReady,
		markPlaying,
		sendProgress,
		sendFinished,
		leaveBattle,
		reset,
		// テスト用: 受信ハンドラを直接叩けるようにする
		handleReceived
	};
}

// Export singleton instance
const storeInstance = createBattleStore();

export const battleStoreApi: StoreApi<BattleState> = storeInstance.store;

export const battleStore = storeInstance;

/**
 * 対戦ページ以外への遷移＝対戦からの離脱として扱う（リザルト確定前なら相手の不戦勝。ADR 0010）。
 * マッチング待機中の遷移は待機のキャンセルとして扱う。
 * React のアンマウントで判定すると StrictMode の mount→cleanup→再mount で誤発火するため、
 * Inertia の navigate イベント（entrypoints/inertia.tsx と同じパターン）で判定する。
 */
export function handleNavigateAway(url: string) {
	const state = battleStoreApi.getState();
	if (!state.roomId) return;
	if (state.phase === 'idle') return;
	if (state.phase === 'matching') {
		void battleStore.cancelMatching();
		return;
	}
	if (new URL(url, window.location.origin).pathname === `/battle/${state.roomId}`) return;
	battleStore.leaveBattle();
}

router.on('navigate', (event) => handleNavigateAway(event.detail.page.url));

// React コンポーネント用フック
export function useBattleStore<T>(selector: (state: BattleState) => T): T {
	return useStore(battleStoreApi, selector);
}
