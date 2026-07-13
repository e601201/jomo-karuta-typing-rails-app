import { describe, it, expect, beforeEach } from 'vitest';
import { InputValidator } from '@/lib/typing/input-validator';
import { parseHiraganaUnits } from './hiragana-units';
import { matchHiraganaProgress } from './input-states';
import { buildDefaultRomajiGuide, buildDynamicRomajiGuide } from './romaji-guide';

describe('buildDefaultRomajiGuide', () => {
	let validator: InputValidator;

	beforeEach(() => {
		validator = new InputValidator();
	});

	it('語末の「ん」は nn を表示する（撥音ルール）', () => {
		validator.setTarget('ぐんまけん');
		expect(buildDefaultRomajiGuide(validator, 'ぐんまけん')).toBe('gunmakenn');
	});

	it('し・ち・つ・ふ は第一パターン（shi/chi/tsu/fu）を表示する', () => {
		validator.setTarget('しちつふ');
		expect(buildDefaultRomajiGuide(validator, 'しちつふ')).toBe('shichitsufu');
	});
});

describe('buildDynamicRomajiGuide', () => {
	let validator: InputValidator;

	beforeEach(() => {
		validator = new InputValidator();
	});

	/** 入力に対する進捗を計算した上でガイドを組み立てる（ページ側の呼び方を再現） */
	const guideFor = (target: string, input: string) => {
		validator.setTarget(target);
		const units = parseHiraganaUnits(target);
		const { completedCount } = matchHiraganaProgress(units, input, validator);
		return buildDynamicRomajiGuide({
			validator,
			targetText: target,
			currentInput: input,
			completedCount
		});
	};

	it('入力が無ければデフォルトガイドを返す', () => {
		expect(guideFor('ぐんまけん', '')).toBe('gunmakenn');
	});

	it('「ん」を nn で入力するとガイドが nn に組み替わる', () => {
		expect(guideFor('ぐんまけん', 'gunn')).toBe('gunnmakenn');
	});

	it('「ん」を n+子音 で確定した場合は n のまま', () => {
		expect(guideFor('ぐんまけん', 'gunm')).toBe('gunmakenn');
	});

	it("'s' を打つと「し」のガイドが si に切り替わる（旧実装の挙動を保存）", () => {
		expect(guideFor('しま', 's')).toBe('sima');
	});

	it("'si' 完了後も si 表記を維持する", () => {
		expect(guideFor('しま', 'si')).toBe('sima');
	});

	it("'sh' 入力中は shi 表記を維持する", () => {
		expect(guideFor('しま', 'sh')).toBe('shima');
	});

	it("「ち」に 't' を打つと ti に切り替わる", () => {
		expect(guideFor('ちず', 't')).toBe('tizu');
	});

	it("「ふ」に 'h' を打つと hu に切り替わる", () => {
		expect(guideFor('ふじ', 'h')).toBe('huji');
	});

	it('完了済み単位は入力したパターンを保持する（tsu vs tu）', () => {
		expect(guideFor('つる', 'tsu')).toBe('tsuru');
		expect(guideFor('つる', 'tu')).toBe('turu');
	});

	it('な行の前の「ん」は未入力でも nn を表示する', () => {
		// かんな → か・ん・な
		expect(guideFor('かんな', 'ka')).toBe('kannna');
	});

	it('子音の前の「ん」は未入力なら n を表示する', () => {
		expect(guideFor('ぐんま', 'gu')).toBe('gunma');
	});
});
