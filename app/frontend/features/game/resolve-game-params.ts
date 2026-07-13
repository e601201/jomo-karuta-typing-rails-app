import type { GameMode, KarutaCard, RandomModeDifficulty } from '@/types';
import { getKarutaCards } from '@/lib/data/karuta-cards';

/**
 * /game の URL パラメータ契約（旧 SvelteKit +page.ts の load 関数の移植）。
 * Rails コントローラは mode / difficulty / cards を検証せず素通しし、
 * 検証と札解決はこの純関数が担う。
 */

export type GameParams = {
	mode?: string | null;
	difficulty?: string | null;
	cards?: string | null;
};

export type ResolvedGameParams = {
	mode: GameMode | null;
	cards: KarutaCard[];
	error: string | null;
	difficulty: RandomModeDifficulty | null;
};

export function resolveGameParams(params: GameParams): ResolvedGameParams {
	const mode = params.mode || 'practice';
	const difficulty = (params.difficulty as RandomModeDifficulty | null) || null;

	// Validate mode
	if (!['practice', 'specific', 'random', 'timeattack'].includes(mode)) {
		return {
			error: '無効なゲームモードです',
			mode: null,
			cards: [],
			difficulty: null
		};
	}

	let cards: KarutaCard[];

	// モードに応じて札を準備
	switch (mode) {
		case 'specific': {
			// 特定札モード: 選択された札のID配列（繰り返し・シャッフル順を保持）
			const selectedIds = params.cards?.split(',').filter(Boolean) || [];
			const byId = new Map(getKarutaCards().map((card) => [card.id, card]));
			// URLの並び順・重複をそのまま再現する
			cards = selectedIds.map((id) => byId.get(id)).filter((card): card is KarutaCard => !!card);
			if (cards.length === 0) {
				cards = getKarutaCards(); // フォールバック
			}
			break;
		}

		default:
			// 練習 / ランダム / タイムアタック: 全44札を順番に
			cards = getKarutaCards();
			break;
	}

	return {
		mode: mode as GameMode,
		cards,
		error: null,
		difficulty: difficulty || 'standard'
	};
}
