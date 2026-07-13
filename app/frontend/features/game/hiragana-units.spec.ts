import { describe, it, expect } from 'vitest';
import { parseHiraganaUnits } from './hiragana-units';

describe('parseHiraganaUnits', () => {
	it('通常のひらがなは1文字ずつ分割する', () => {
		expect(parseHiraganaUnits('つるまう')).toEqual(['つ', 'る', 'ま', 'う']);
	});

	it('拗音（ゃゅょ）は前の文字とまとめて1単位にする', () => {
		expect(parseHiraganaUnits('きょう')).toEqual(['きょ', 'う']);
		expect(parseHiraganaUnits('しゃしん')).toEqual(['しゃ', 'し', 'ん']);
	});

	it('小さい母音（ぁぃぅぇぉ）も前の文字とまとめる', () => {
		expect(parseHiraganaUnits('ふぁ')).toEqual(['ふぁ']);
	});

	it('促音（っ）は次の文字とまとめて1単位にする', () => {
		expect(parseHiraganaUnits('にっぽん')).toEqual(['に', 'っぽ', 'ん']);
	});

	it('末尾の促音は単独の単位になる', () => {
		expect(parseHiraganaUnits('あっ')).toEqual(['あ', 'っ']);
	});

	it('読点は独立した単位として扱う', () => {
		expect(parseHiraganaUnits('あ、い')).toEqual(['あ', '、', 'い']);
	});

	it('実在の札の読みを正しく分割する（つ: 鶴舞う形の群馬県）', () => {
		expect(parseHiraganaUnits('つるまうかたちのぐんまけん')).toEqual([
			'つ',
			'る',
			'ま',
			'う',
			'か',
			'た',
			'ち',
			'の',
			'ぐ',
			'ん',
			'ま',
			'け',
			'ん'
		]);
	});

	it('空文字列は空配列を返す', () => {
		expect(parseHiraganaUnits('')).toEqual([]);
	});
});
