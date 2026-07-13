/**
 * 上毛かるたデータのTypeScript版
 */

import type { KarutaCard } from '@/types';
import karutaCardsJson from './karuta-cards.json';

// JSONデータを型付きで読み込み
export const karutaCards: KarutaCard[] = karutaCardsJson as KarutaCard[];

// ID順にソート済みのデータ
export const sortedKarutaCards = [...karutaCards].sort((a, b) => a.id.localeCompare(b.id));

// カテゴリー別にグループ化
export const karutaCardsByCategory = karutaCards.reduce(
	(acc, card) => {
		if (!acc[card.category]) {
			acc[card.category] = [];
		}
		acc[card.category].push(card);
		return acc;
	},
	{} as Record<string, KarutaCard[]>
);

// カードを取得する関数
export function getKarutaCards(): KarutaCard[] {
	return [...karutaCards];
}

// 難易度別にグループ化
export const karutaCardsByDifficulty = karutaCards.reduce(
	(acc, card) => {
		if (!acc[card.difficulty]) {
			acc[card.difficulty] = [];
		}
		acc[card.difficulty].push(card);
		return acc;
	},
	{} as Record<string, KarutaCard[]>
);

// IDで特定の札を取得
export const getCardById = (id: string): KarutaCard | undefined => {
	return karutaCards.find((card) => card.id === id);
};

// ランダムに札を取得
export const getRandomCards = (count: number): KarutaCard[] => {
	const shuffled = [...karutaCards].sort(() => Math.random() - 0.5);
	return shuffled.slice(0, Math.min(count, karutaCards.length));
};

// 全44枚存在するか検証
export const validateCardData = (): boolean => {
	return karutaCards.length === 44;
};
