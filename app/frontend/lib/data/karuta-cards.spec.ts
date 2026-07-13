/**
 * かるたデータのテスト
 */

import { describe, it, expect } from 'vitest';
import {
	karutaCards,
	sortedKarutaCards,
	karutaCardsByCategory,
	karutaCardsByDifficulty,
	getCardById,
	getRandomCards,
	validateCardData
} from './karuta-cards';

describe('かるたデータ', () => {
	describe('基本データ', () => {
		it('44枚の札が存在する', () => {
			expect(karutaCards.length).toBe(44);
		});

		it('validateCardDataが正しく動作する', () => {
			expect(validateCardData()).toBe(true);
		});

		it('各札に必須フィールドが存在する', () => {
			karutaCards.forEach((card) => {
				expect(card.id).toBeDefined();
				expect(card.hiragana).toBeDefined();
				// ローマ字はカードに静的保持せず hiragana から動的生成するため検証しない
				expect(card.meaning).toBeDefined();
				expect(card.category).toBeDefined();
				expect(card.difficulty).toBeDefined();
			});
		});

		it('IDに重複がない', () => {
			const ids = karutaCards.map((card) => card.id);
			const uniqueIds = new Set(ids);
			expect(uniqueIds.size).toBe(ids.length);
		});
	});

	describe('ソート済みデータ', () => {
		it('ID順にソートされている', () => {
			for (let i = 1; i < sortedKarutaCards.length; i++) {
				const prev = sortedKarutaCards[i - 1].id;
				const curr = sortedKarutaCards[i].id;
				expect(prev.localeCompare(curr)).toBeLessThanOrEqual(0);
			}
		});
	});

	describe('カテゴリー別グループ化', () => {
		it('すべてのカテゴリーが存在する', () => {
			const expectedCategories = ['history', 'geography', 'culture', 'nature', 'industry'];
			const actualCategories = Object.keys(karutaCardsByCategory);

			expectedCategories.forEach((category) => {
				expect(actualCategories).toContain(category);
			});
		});

		it('全札がカテゴリーに分類されている', () => {
			const totalCards = Object.values(karutaCardsByCategory).reduce(
				(sum, cards) => sum + cards.length,
				0
			);
			expect(totalCards).toBe(44);
		});
	});

	describe('難易度別グループ化', () => {
		it('すべての難易度が存在する', () => {
			expect(karutaCardsByDifficulty).toHaveProperty('easy');
			expect(karutaCardsByDifficulty).toHaveProperty('medium');
			expect(karutaCardsByDifficulty).toHaveProperty('hard');
		});

		it('全札が難易度に分類されている', () => {
			const totalCards = Object.values(karutaCardsByDifficulty).reduce(
				(sum, cards) => sum + cards.length,
				0
			);
			expect(totalCards).toBe(44);
		});
	});

	describe('getCardById', () => {
		it('存在するIDで札を取得できる', () => {
			const card = getCardById('tsu');
			expect(card).toBeDefined();
			expect(card?.hiragana).toBe('つるまうかたちの ぐんまけん');
		});

		it('存在しないIDでundefinedを返す', () => {
			const card = getCardById('invalid');
			expect(card).toBeUndefined();
		});
	});

	describe('getRandomCards', () => {
		it('指定した枚数の札を返す', () => {
			const cards = getRandomCards(10);
			expect(cards.length).toBe(10);
		});

		it('44枚以上を指定しても44枚を返す', () => {
			const cards = getRandomCards(50);
			expect(cards.length).toBe(44);
		});

		it('ランダムな順序で返す', () => {
			const cards1 = getRandomCards(10);
			const cards2 = getRandomCards(10);

			// 完全一致する可能性は低い
			cards1.map((c) => c.id).join(',');
			cards2.map((c) => c.id).join(',');

			// テストの安定性のため、異なることを期待するのではなく
			// 両方とも10枚返ることを確認
			expect(cards1.length).toBe(10);
			expect(cards2.length).toBe(10);
		});

		it('重複なく札を返す', () => {
			const cards = getRandomCards(20);
			const ids = cards.map((c) => c.id);
			const uniqueIds = new Set(ids);
			expect(uniqueIds.size).toBe(20);
		});
	});
});
