/**
 * 統一ゲームエンジン（gameStore）の挙動テスト
 *
 * モードごとに保証すべき挙動を固定する:
 *  - ランダムモードのみ難易度を持ち、60秒の制限時間が付く
 *  - ランダム×初心者のみ hiraganaShort を検証対象にする
 *  - タイムアタックは制限時間なし・難易度なし（= 標準スコアリング）
 *  - 全札を入力し終えるとセッションが終了する（手続き的完了）
 *  - バックスペース（入力短縮）ではコンボが途切れない
 *
 * NOTE:
 *  - startSession は ImagePreloader.preloadWithPriority を await してから状態を
 *    更新するため、各テストでは必ず await すること。
 *  - endSession など一部の関数はモジュールのシングルトン gameStore を参照する
 *    ため、アプリ実体と同じ「公開シングルトン」に対してテストする。
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// 画像プリロードは即座に解決させる（happy-dom で実画像を読み込まない）
vi.mock('@/lib/image-preloader', () => ({
	ImagePreloader: {
		preloadWithPriority: vi.fn().mockResolvedValue(undefined)
	}
}));

import { gameStore } from './game-store';
import type { KarutaCard } from '@/types';
import { InputValidator } from '@/lib/typing/input-validator';

// hiraganaShort を持つ合成カード（実データには存在しないため将来に備えて固定）
const cardWithShort: KarutaCard = {
	id: 'tsu',
	hiragana: 'つる まう かたち の ぐんまけん',
	hiraganaShort: 'つるまう',
	romaji: 'tsuru mau katachi no gunmaken',
	meaning: '鶴舞う形の群馬県',
	category: 'geography',
	difficulty: 'easy'
};

const twoCards: KarutaCard[] = [
	{ id: 'a', hiragana: 'あい', romaji: 'ai', meaning: '', category: 'culture', difficulty: 'easy' },
	{ id: 'b', hiragana: 'うえ', romaji: 'ue', meaning: '', category: 'culture', difficulty: 'easy' }
];

const threeMora: KarutaCard = {
	id: 'x',
	hiragana: 'あいう',
	romaji: 'aiu',
	meaning: '',
	category: 'culture',
	difficulty: 'easy'
};

beforeEach(() => {
	gameStore.resetSession();
	// ランダムモードは startSession でカードをシャッフルする。出題順に依存する
	// テストを決定的に保つため、Math.random を固定して Fisher–Yates を恒等順にする。
	vi.spyOn(Math, 'random').mockReturnValue(0.9999);
});

afterEach(() => {
	gameStore.resetSession();
});

describe('統一エンジン: 難易度・スコアリング', () => {
	it('ランダムモードは渡した難易度を session に保持する', async () => {
		await gameStore.startSession('random', twoCards, 'beginner');
		expect(gameStore.getState().session?.difficulty).toBe('beginner');
	});

	it('タイムアタックモードは難易度を持たない（=標準スコアリング）', async () => {
		await gameStore.startSession('timeattack', twoCards);
		expect(gameStore.getState().session?.difficulty).toBeUndefined();
	});
});

describe('統一エンジン: 制限時間', () => {
	it('タイムアタックモードは制限時間なし', async () => {
		await gameStore.startSession('timeattack', twoCards);
		expect(gameStore.getState().timer.timeLimit).toBeNull();
	});

	it('ランダムモードのみ60秒の制限時間が付く', async () => {
		await gameStore.startSession('random', twoCards);
		expect(gameStore.getState().timer.timeLimit).toBe(60000);
	});
});

describe('統一エンジン: hiraganaShort の適用範囲', () => {
	it('ランダム×初心者のみ hiraganaShort を検証対象にする', async () => {
		await gameStore.startSession('random', [cardWithShort], 'beginner');
		const validator = gameStore.getState().input.validator as InputValidator;
		expect(validator.getTarget()).toBe('つるまう');
	});

	it('ランダム×標準は全文を検証対象にする', async () => {
		await gameStore.startSession('random', [cardWithShort]);
		const validator = gameStore.getState().input.validator as InputValidator;
		expect(validator.getTarget()).toBe('つるまうかたちのぐんまけん');
	});
});

describe('統一エンジン: 完了とコンボ挙動', () => {
	it('全札を入力し終えるとセッションが終了する', async () => {
		await gameStore.startSession('random', twoCards);

		// 1枚目「あい」を完成（シャッフルは恒等化済み）
		gameStore.updateInput('a');
		gameStore.updateInput('ai');
		// 2枚目「うえ」を完成 → 最後の札で endSession
		gameStore.updateInput('u');
		gameStore.updateInput('ue');

		// 手続き的完了（一部経路で setTimeout(0)）を待つ
		await new Promise((resolve) => setTimeout(resolve, 0));

		expect(gameStore.getState().session?.isActive).toBe(false);
	});

	it('バックスペース（入力短縮）ではコンボが途切れない', async () => {
		await gameStore.startSession('random', [threeMora]);

		gameStore.updateInput('a'); // 正打
		gameStore.updateInput('ai'); // 正打
		const comboBefore = gameStore.getState().statistics.currentCombo;
		expect(comboBefore).toBe(2);

		gameStore.updateInput('a'); // バックスペース相当（'ai' → 'a'）
		const comboAfter = gameStore.getState().statistics.currentCombo;
		expect(comboAfter).toBe(2); // コンボは維持される
	});
});
