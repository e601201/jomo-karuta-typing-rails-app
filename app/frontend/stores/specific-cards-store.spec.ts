import { describe, it, expect, beforeEach } from 'vitest';
import {
	specificCardsStore,
	selectedCards,
	canStartPractice,
	selectedCardsArray
} from './specific-cards-store';
import type { KarutaCard } from '@/types';

describe('SpecificCardsStore', () => {
	const mockCards: KarutaCard[] = [
		{
			id: 'card1',
			hiragana: 'あいうえお',
			romaji: 'aiueo',
			meaning: '取り札1',
			category: 'geography',
			difficulty: 'easy'
		},
		{
			id: 'card2',
			hiragana: 'かきくけこ',
			romaji: 'kakikukeko',
			meaning: '取り札2',
			category: 'history',
			difficulty: 'medium'
		},
		{
			id: 'card3',
			hiragana: 'さしすせそ',
			romaji: 'sashisuseso',
			meaning: '取り札3',
			category: 'culture',
			difficulty: 'hard'
		}
	];

	beforeEach(() => {
		specificCardsStore.reset();
	});

	describe('初期化', () => {
		it('初期状態が正しく設定される', () => {
			const state = specificCardsStore.getState();
			expect(state.selectedCardIds).toEqual(new Set());
			expect(state.favorites).toEqual([]);
			expect(state.settings.repeatCount).toBe(1);
			expect(state.settings.shuffleOrder).toBe(false);
		});
	});

	describe('札選択機能', () => {
		it('札を選択できる', () => {
			specificCardsStore.selectCard('card1');
			const state = specificCardsStore.getState();
			expect(state.selectedCardIds.has('card1')).toBe(true);
		});

		it('札の選択を解除できる', () => {
			specificCardsStore.selectCard('card1');
			specificCardsStore.deselectCard('card1');
			const state = specificCardsStore.getState();
			expect(state.selectedCardIds.has('card1')).toBe(false);
		});

		it('トグル選択が動作する', () => {
			specificCardsStore.toggleCard('card1');
			let state = specificCardsStore.getState();
			expect(state.selectedCardIds.has('card1')).toBe(true);

			specificCardsStore.toggleCard('card1');
			state = specificCardsStore.getState();
			expect(state.selectedCardIds.has('card1')).toBe(false);
		});

		it('全選択が動作する', () => {
			const cardIds = mockCards.map((c) => c.id);
			specificCardsStore.selectAll(cardIds);
			const state = specificCardsStore.getState();
			expect(state.selectedCardIds.size).toBe(3);
			cardIds.forEach((id) => {
				expect(state.selectedCardIds.has(id)).toBe(true);
			});
		});

		it('全解除が動作する', () => {
			specificCardsStore.selectCard('card1');
			specificCardsStore.selectCard('card2');
			specificCardsStore.clearSelection();
			const state = specificCardsStore.getState();
			expect(state.selectedCardIds.size).toBe(0);
		});
	});

	describe('お気に入り機能', () => {
		it('お気に入りを保存できる', () => {
			specificCardsStore.selectCard('card1');
			specificCardsStore.selectCard('card2');
			specificCardsStore.saveFavorite('テストセット');

			const state = specificCardsStore.getState();
			expect(state.favorites.length).toBe(1);
			expect(state.favorites[0].name).toBe('テストセット');
			expect(state.favorites[0].cardIds).toEqual(['card1', 'card2']);
		});

		it('お気に入りを読み込める', () => {
			specificCardsStore.selectCard('card1');
			specificCardsStore.saveFavorite('テストセット');
			specificCardsStore.clearSelection();

			const state = specificCardsStore.getState();
			const favorite = state.favorites[0];
			specificCardsStore.loadFavorite(favorite.id);

			const newState = specificCardsStore.getState();
			expect(newState.selectedCardIds.has('card1')).toBe(true);
		});

		it('お気に入りを削除できる', () => {
			specificCardsStore.selectCard('card1');
			specificCardsStore.saveFavorite('テストセット');

			const state = specificCardsStore.getState();
			const favoriteId = state.favorites[0].id;
			specificCardsStore.deleteFavorite(favoriteId);

			const newState = specificCardsStore.getState();
			expect(newState.favorites.length).toBe(0);
		});

		it('重複した名前のチェックが動作する', () => {
			specificCardsStore.selectCard('card1');
			specificCardsStore.saveFavorite('テストセット');

			specificCardsStore.selectCard('card2');
			const result = specificCardsStore.saveFavorite('テストセット');

			expect(result).toBe(false);
			const state = specificCardsStore.getState();
			expect(state.favorites.length).toBe(1);
		});
	});

	describe('練習設定', () => {
		it('繰り返し回数を設定できる', () => {
			specificCardsStore.setRepeatCount(3);
			const state = specificCardsStore.getState();
			expect(state.settings.repeatCount).toBe(3);
		});

		it('出題順序を設定できる', () => {
			specificCardsStore.setShuffleOrder(true);
			const state = specificCardsStore.getState();
			expect(state.settings.shuffleOrder).toBe(true);
		});

		it('無限繰り返しを設定できる', () => {
			specificCardsStore.setRepeatCount(Infinity);
			const state = specificCardsStore.getState();
			expect(state.settings.repeatCount).toBe(Infinity);
		});
	});

	describe('派生セレクタ', () => {
		it('選択数が正しく計算される', () => {
			specificCardsStore.selectCard('card1');
			specificCardsStore.selectCard('card2');

			const count = selectedCards(specificCardsStore.getState());
			expect(count).toBe(2);
		});

		it('練習開始可能状態が正しく判定される', () => {
			expect(canStartPractice(specificCardsStore.getState())).toBe(false);

			specificCardsStore.selectCard('card1');
			expect(canStartPractice(specificCardsStore.getState())).toBe(true);

			specificCardsStore.clearSelection();
			expect(canStartPractice(specificCardsStore.getState())).toBe(false);
		});

		it('選択された札の配列を取得できる', () => {
			specificCardsStore.selectCard('card1');
			specificCardsStore.selectCard('card3');

			const selected = selectedCardsArray(specificCardsStore.getState());
			expect(selected.sort()).toEqual(['card1', 'card3'].sort());
		});
	});

	describe('練習用札リストの生成', () => {
		it('選択した札のみが含まれる', () => {
			specificCardsStore.selectCard('card1');
			specificCardsStore.selectCard('card3');

			const practiceCards = specificCardsStore.generatePracticeCards(mockCards);
			expect(practiceCards.length).toBe(2);
			const cardIds = practiceCards.map((c) => c.id);
			expect(cardIds).toContain('card1');
			expect(cardIds).toContain('card3');
		});

		it('繰り返し設定が反映される', () => {
			specificCardsStore.selectCard('card1');
			specificCardsStore.setRepeatCount(3);

			const practiceCards = specificCardsStore.generatePracticeCards(mockCards);
			expect(practiceCards.length).toBe(3);
			practiceCards.forEach((card) => {
				expect(card.id).toBe('card1');
			});
		});

		it('シャッフル設定が反映される', () => {
			specificCardsStore.selectCard('card1');
			specificCardsStore.selectCard('card2');
			specificCardsStore.selectCard('card3');
			specificCardsStore.setShuffleOrder(true);
			specificCardsStore.setRepeatCount(10);

			const practiceCards = specificCardsStore.generatePracticeCards(mockCards);

			// 10回分のブロックを取り出し、出題順がシャッフルされている
			// (= 複数の異なる順序が現れる) ことを確認する。
			// 個々のブロック同士の比較は約 1/6 の確率で偶然一致するため flaky になる。
			// 全 10 ブロックが偶然すべて同じ順序になる確率は (1/6)^9 でほぼ 0。
			const orderings = new Set<string>();
			for (let i = 0; i < 10; i++) {
				const block = practiceCards
					.slice(i * 3, i * 3 + 3)
					.map((c) => c.id)
					.join(',');
				orderings.add(block);
			}
			expect(orderings.size).toBeGreaterThan(1);
		});
	});

	describe('エッジケース', () => {
		it('札が選択されていない場合は空配列を返す', () => {
			const practiceCards = specificCardsStore.generatePracticeCards(mockCards);
			expect(practiceCards).toEqual([]);
		});

		it('存在しない札IDを選択しようとしても問題ない', () => {
			specificCardsStore.selectCard('invalid-id');
			const state = specificCardsStore.getState();
			expect(state.selectedCardIds.has('invalid-id')).toBe(true);

			const practiceCards = specificCardsStore.generatePracticeCards(mockCards);
			expect(practiceCards).toEqual([]);
		});

		it('お気に入り名が空文字の場合は保存されない', () => {
			specificCardsStore.selectCard('card1');
			const result = specificCardsStore.saveFavorite('');
			expect(result).toBe(false);

			const state = specificCardsStore.getState();
			expect(state.favorites.length).toBe(0);
		});
	});
});
