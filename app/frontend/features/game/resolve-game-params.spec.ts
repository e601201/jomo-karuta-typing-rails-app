/**
 * /game のパラメータ解決テスト（旧 page.load.spec.ts の移植）
 *
 * 特定札練習は mode=specific + cards パラメータでカードを受け渡す。
 * 繰り返し回数・シャッフル順を壊さないよう、「順序」と「重複」を
 * 保持してカードを解決することを固定する。
 */

import { describe, it, expect } from 'vitest';
import { resolveGameParams, type ResolvedGameParams } from './resolve-game-params';
import { getKarutaCards } from '@/lib/data/karuta-cards';

// 旧テストは URL クエリ文字列で load を呼んでいたため、同じ形を維持する
const callLoad = (query: string): ResolvedGameParams => {
	const sp = new URLSearchParams(query);
	return resolveGameParams({
		mode: sp.get('mode'),
		difficulty: sp.get('difficulty'),
		cards: sp.get('cards')
	});
};

describe('resolveGameParams: 特定札モード（mode=specific）', () => {
	it('cards パラメータの順序と重複をそのまま再現する', () => {
		const ids = ['tsu', 'tsu', 'ne'];
		const result = callLoad(`mode=specific&cards=${ids.join(',')}`);

		expect(result.mode).toBe('specific');
		expect(result.cards.map((c) => c.id)).toEqual(ids); // 重複・順序を保持
	});

	it('存在しないIDは除外する', () => {
		const result = callLoad('mode=specific&cards=tsu,__nope__,ne');
		expect(result.cards.map((c) => c.id)).toEqual(['tsu', 'ne']);
	});

	it('cards 指定が無い場合は全札にフォールバックする', () => {
		const result = callLoad('mode=specific');
		expect(result.cards.length).toBe(getKarutaCards().length);
	});
});

describe('resolveGameParams: その他のモード', () => {
	it('練習モードは全44札を順番どおり返す', () => {
		const all = getKarutaCards();
		const result = callLoad('mode=practice');

		expect(result.mode).toBe('practice');
		expect(result.cards.map((c) => c.id)).toEqual(all.map((c) => c.id));
	});

	it('ランダムモードは全札を返す（並び替えは store 側で実施）', () => {
		const result = callLoad('mode=random');
		expect(result.mode).toBe('random');
		expect(result.cards.length).toBe(getKarutaCards().length);
	});

	it('無効なモードはエラーを返す', () => {
		const result = callLoad('mode=__bogus__');
		expect(result.error).toBeTruthy();
		expect(result.mode).toBeNull();
	});
});
