/**
 * 特定札練習モードストア
 * TASK-302: 特定札練習モード専用の状態管理
 * 旧リポジトリ src/lib/stores/specific-cards-store.ts の zustand 移植。
 */

import { createStore } from 'zustand/vanilla';
import { useStore } from 'zustand';
import type { KarutaCard } from '@/types';

export interface Favorite {
	id: string;
	name: string;
	cardIds: string[];
	createdAt: Date;
}

export interface SpecificCardsSettings {
	repeatCount: number; // 1, 3, 5, Infinity
	shuffleOrder: boolean;
}

export interface SpecificCardsState {
	selectedCardIds: Set<string>;
	favorites: Favorite[];
	settings: SpecificCardsSettings;
}

const initialState: SpecificCardsState = {
	selectedCardIds: new Set(),
	favorites: [],
	settings: {
		repeatCount: 1,
		shuffleOrder: false
	}
};

// zustand vanilla ストア
const store = createStore<SpecificCardsState>(() => initialState);

function createSpecificCardsStore() {
	// Svelte writable の update/set 相当
	const update = (updater: (state: SpecificCardsState) => SpecificCardsState) => {
		store.setState(updater(store.getState()), true);
	};
	const set = (state: SpecificCardsState) => {
		store.setState(state, true);
	};

	return {
		getState: store.getState,
		subscribe: store.subscribe,

		/**
		 * 札を選択
		 */
		selectCard(cardId: string) {
			update((state) => {
				state.selectedCardIds.add(cardId);
				return { ...state };
			});
		},

		/**
		 * 札の選択を解除
		 */
		deselectCard(cardId: string) {
			update((state) => {
				state.selectedCardIds.delete(cardId);
				return { ...state };
			});
		},

		/**
		 * 札の選択をトグル
		 */
		toggleCard(cardId: string) {
			update((state) => {
				const newSelectedCardIds = new Set(state.selectedCardIds);
				if (newSelectedCardIds.has(cardId)) {
					newSelectedCardIds.delete(cardId);
				} else {
					newSelectedCardIds.add(cardId);
				}
				return {
					...state,
					selectedCardIds: newSelectedCardIds
				};
			});
		},

		/**
		 * 全選択
		 */
		selectAll(cardIds: string[]) {
			update((state) => ({
				...state,
				selectedCardIds: new Set(cardIds)
			}));
		},

		/**
		 * 全解除
		 */
		clearSelection() {
			update((state) => ({
				...state,
				selectedCardIds: new Set()
			}));
		},

		/**
		 * お気に入りを保存
		 */
		saveFavorite(name: string): boolean {
			if (!name.trim()) {
				return false;
			}

			const state = store.getState();

			// 重複チェック
			if (state.favorites.some((f) => f.name === name)) {
				return false;
			}

			const favorite: Favorite = {
				id: `favorite-${Date.now()}`,
				name,
				cardIds: Array.from(state.selectedCardIds),
				createdAt: new Date()
			};

			update((state) => ({
				...state,
				favorites: [...state.favorites, favorite]
			}));

			return true;
		},

		/**
		 * お気に入りを読み込み
		 */
		loadFavorite(favoriteId: string) {
			const state = store.getState();
			const favorite = state.favorites.find((f) => f.id === favoriteId);

			if (favorite) {
				update((state) => ({
					...state,
					selectedCardIds: new Set(favorite.cardIds)
				}));
			}
		},

		/**
		 * お気に入りを削除
		 */
		deleteFavorite(favoriteId: string) {
			update((state) => ({
				...state,
				favorites: state.favorites.filter((f) => f.id !== favoriteId)
			}));
		},

		/**
		 * 繰り返し回数を設定
		 */
		setRepeatCount(count: number) {
			update((state) => ({
				...state,
				settings: {
					...state.settings,
					repeatCount: count
				}
			}));
		},

		/**
		 * 出題順序を設定
		 */
		setShuffleOrder(shuffle: boolean) {
			update((state) => ({
				...state,
				settings: {
					...state.settings,
					shuffleOrder: shuffle
				}
			}));
		},

		/**
		 * 練習用の札リストを生成
		 */
		generatePracticeCards(allCards: KarutaCard[]): KarutaCard[] {
			const state = store.getState();

			if (state.selectedCardIds.size === 0) {
				return [];
			}

			// 選択された札のみフィルタリング
			const selectedCards = allCards.filter((card) => state.selectedCardIds.has(card.id));

			if (selectedCards.length === 0) {
				return [];
			}

			// 繰り返し回数分の札を生成
			let practiceCards: KarutaCard[] = [];
			const repeatCount = state.settings.repeatCount;

			for (let i = 0; i < repeatCount; i++) {
				if (state.settings.shuffleOrder) {
					// シャッフル
					const shuffled = [...selectedCards].sort(() => Math.random() - 0.5);
					practiceCards = [...practiceCards, ...shuffled];
				} else {
					// 順番通り
					practiceCards = [...practiceCards, ...selectedCards];
				}
			}

			return practiceCards;
		},

		/**
		 * リセット
		 */
		reset() {
			set({
				selectedCardIds: new Set(),
				favorites: [],
				settings: {
					repeatCount: 1,
					shuffleOrder: false
				}
			});
		}
	};
}

export const specificCardsStore = createSpecificCardsStore();

// 派生セレクタ（旧 derived ストアの React 版）: 選択数
export const selectedCards = (state: SpecificCardsState) => state.selectedCardIds.size;

// 派生セレクタ: 練習開始可能か
export const canStartPractice = (state: SpecificCardsState) => state.selectedCardIds.size > 0;

// 派生セレクタ: 選択された札のID配列
export const selectedCardsArray = (state: SpecificCardsState) => Array.from(state.selectedCardIds);

/**
 * React コンポーネント用フック。
 * セレクタ省略時は SpecificCardsState 全体を返す。
 */
export function useSpecificCardsStore<T = SpecificCardsState>(
	selector: (state: SpecificCardsState) => T = (state) => state as unknown as T
): T {
	return useStore(store, selector);
}
