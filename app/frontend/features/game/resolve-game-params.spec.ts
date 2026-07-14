/**
 * /game のパラメータ解決テスト（旧 page.load.spec.ts の移植）
 */

import { describe, it, expect } from 'vitest';
import { resolveGameParams, type ResolvedGameParams } from './resolve-game-params';
import { getKarutaCards } from '@/lib/data/karuta-cards';

// 旧テストは URL クエリ文字列で load を呼んでいたため、同じ形を維持する
const callLoad = (query: string): ResolvedGameParams => {
	const sp = new URLSearchParams(query);
	return resolveGameParams({
		mode: sp.get('mode'),
		difficulty: sp.get('difficulty')
	});
};

describe('resolveGameParams', () => {
	it('ランダムモードは全札を返す（並び替えは store 側で実施）', () => {
		const result = callLoad('mode=random');
		expect(result.mode).toBe('random');
		expect(result.cards.length).toBe(getKarutaCards().length);
	});

	it('タイムアタックモードは全札を返す（10枚の選抜は store 側で実施）', () => {
		const result = callLoad('mode=timeattack');
		expect(result.mode).toBe('timeattack');
		expect(result.cards.length).toBe(getKarutaCards().length);
	});

	it('mode 未指定はランダムモードにフォールバックする', () => {
		const result = callLoad('');
		expect(result.mode).toBe('random');
	});

	it('無効なモードはエラーを返す', () => {
		const result = callLoad('mode=__bogus__');
		expect(result.error).toBeTruthy();
		expect(result.mode).toBeNull();
	});

	it('削除された練習系モード（practice / specific）はエラーを返す', () => {
		for (const mode of ['practice', 'specific']) {
			const result = callLoad(`mode=${mode}`);
			expect(result.error).toBeTruthy();
			expect(result.mode).toBeNull();
		}
	});
});
