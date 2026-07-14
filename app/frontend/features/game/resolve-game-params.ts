import type { GameMode, KarutaCard, RandomModeDifficulty } from '@/types';
import { getKarutaCards } from '@/lib/data/karuta-cards';

/**
 * /game の URL パラメータ契約（旧 SvelteKit +page.ts の load 関数の移植）。
 * Rails コントローラは mode / difficulty を検証せず素通しし、
 * 検証と札解決はこの純関数が担う。
 */

export type GameParams = {
	mode?: string | null;
	difficulty?: string | null;
};

export type ResolvedGameParams = {
	mode: GameMode | null;
	cards: KarutaCard[];
	error: string | null;
	difficulty: RandomModeDifficulty | null;
};

export function resolveGameParams(params: GameParams): ResolvedGameParams {
	const mode = params.mode || 'random';
	const difficulty = (params.difficulty as RandomModeDifficulty | null) || null;

	// Validate mode
	if (!['random', 'timeattack'].includes(mode)) {
		return {
			error: '無効なゲームモードです',
			mode: null,
			cards: [],
			difficulty: null
		};
	}

	// ランダム / タイムアタック: 全44札を順番に（並び替え・選抜は store 側で実施）
	return {
		mode: mode as GameMode,
		cards: getKarutaCards(),
		error: null,
		difficulty: difficulty || 'standard'
	};
}
