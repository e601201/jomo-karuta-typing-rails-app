/**
 * ローマ字入力判定エンジンのテスト
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { InputValidator } from './input-validator';

describe('InputValidator', () => {
	let validator: InputValidator;

	beforeEach(() => {
		validator = new InputValidator();
	});

	describe('ひらがな→ローマ字変換', () => {
		describe('基本変換', () => {
			it('あ行を正しく変換する', () => {
				expect(validator.getRomajiPatterns('あ')).toEqual(['a']);
				expect(validator.getRomajiPatterns('い')).toEqual(['i']);
				expect(validator.getRomajiPatterns('う')).toEqual(['u']);
				expect(validator.getRomajiPatterns('え')).toEqual(['e']);
				expect(validator.getRomajiPatterns('お')).toEqual(['o']);
			});

			it('か行を正しく変換する', () => {
				expect(validator.getRomajiPatterns('か')).toEqual(['ka']);
				expect(validator.getRomajiPatterns('き')).toEqual(['ki']);
				expect(validator.getRomajiPatterns('く')).toEqual(['ku']);
				expect(validator.getRomajiPatterns('け')).toEqual(['ke']);
				expect(validator.getRomajiPatterns('こ')).toEqual(['ko']);
			});

			it('さ行を正しく変換する', () => {
				expect(validator.getRomajiPatterns('さ')).toEqual(['sa']);
				expect(validator.getRomajiPatterns('し')).toEqual(['shi', 'si']);
				expect(validator.getRomajiPatterns('す')).toEqual(['su']);
				expect(validator.getRomajiPatterns('せ')).toEqual(['se']);
				expect(validator.getRomajiPatterns('そ')).toEqual(['so']);
			});

			it('た行を正しく変換する', () => {
				expect(validator.getRomajiPatterns('た')).toEqual(['ta']);
				expect(validator.getRomajiPatterns('ち')).toEqual(['chi', 'ti']);
				expect(validator.getRomajiPatterns('つ')).toEqual(['tsu', 'tu']);
				expect(validator.getRomajiPatterns('て')).toEqual(['te']);
				expect(validator.getRomajiPatterns('と')).toEqual(['to']);
			});

			it('な行を正しく変換する', () => {
				expect(validator.getRomajiPatterns('な')).toEqual(['na']);
				expect(validator.getRomajiPatterns('に')).toEqual(['ni']);
				expect(validator.getRomajiPatterns('ぬ')).toEqual(['nu']);
				expect(validator.getRomajiPatterns('ね')).toEqual(['ne']);
				expect(validator.getRomajiPatterns('の')).toEqual(['no']);
			});

			it('は行を正しく変換する', () => {
				expect(validator.getRomajiPatterns('は')).toEqual(['ha']);
				expect(validator.getRomajiPatterns('ひ')).toEqual(['hi']);
				expect(validator.getRomajiPatterns('ふ')).toEqual(['fu', 'hu']);
				expect(validator.getRomajiPatterns('へ')).toEqual(['he']);
				expect(validator.getRomajiPatterns('ほ')).toEqual(['ho']);
			});

			it('ま行を正しく変換する', () => {
				expect(validator.getRomajiPatterns('ま')).toEqual(['ma']);
				expect(validator.getRomajiPatterns('み')).toEqual(['mi']);
				expect(validator.getRomajiPatterns('む')).toEqual(['mu']);
				expect(validator.getRomajiPatterns('め')).toEqual(['me']);
				expect(validator.getRomajiPatterns('も')).toEqual(['mo']);
			});

			it('や行を正しく変換する', () => {
				expect(validator.getRomajiPatterns('や')).toEqual(['ya']);
				expect(validator.getRomajiPatterns('ゆ')).toEqual(['yu']);
				expect(validator.getRomajiPatterns('よ')).toEqual(['yo']);
			});

			it('ら行を正しく変換する', () => {
				expect(validator.getRomajiPatterns('ら')).toEqual(['ra']);
				expect(validator.getRomajiPatterns('り')).toEqual(['ri']);
				expect(validator.getRomajiPatterns('る')).toEqual(['ru']);
				expect(validator.getRomajiPatterns('れ')).toEqual(['re']);
				expect(validator.getRomajiPatterns('ろ')).toEqual(['ro']);
			});

			it('わ行を正しく変換する', () => {
				expect(validator.getRomajiPatterns('わ')).toEqual(['wa']);
				expect(validator.getRomajiPatterns('を')).toEqual(['wo', 'o']);
				// 単独（=語末）の「ん」は撥音ルールにより nn のみ
				expect(validator.getRomajiPatterns('ん')).toEqual(['nn']);
			});
		});

		describe('濁音・半濁音', () => {
			it('が行を正しく変換する', () => {
				expect(validator.getRomajiPatterns('が')).toEqual(['ga']);
				expect(validator.getRomajiPatterns('ぎ')).toEqual(['gi']);
				expect(validator.getRomajiPatterns('ぐ')).toEqual(['gu']);
				expect(validator.getRomajiPatterns('げ')).toEqual(['ge']);
				expect(validator.getRomajiPatterns('ご')).toEqual(['go']);
			});

			it('ざ行を正しく変換する', () => {
				expect(validator.getRomajiPatterns('ざ')).toEqual(['za']);
				expect(validator.getRomajiPatterns('じ')).toEqual(['ji', 'zi']);
				expect(validator.getRomajiPatterns('ず')).toEqual(['zu']);
				expect(validator.getRomajiPatterns('ぜ')).toEqual(['ze']);
				expect(validator.getRomajiPatterns('ぞ')).toEqual(['zo']);
			});

			it('だ行を正しく変換する', () => {
				expect(validator.getRomajiPatterns('だ')).toEqual(['da']);
				expect(validator.getRomajiPatterns('ぢ')).toEqual(['di', 'ji']);
				expect(validator.getRomajiPatterns('づ')).toEqual(['du', 'zu']);
				expect(validator.getRomajiPatterns('で')).toEqual(['de']);
				expect(validator.getRomajiPatterns('ど')).toEqual(['do']);
			});

			it('ば行を正しく変換する', () => {
				expect(validator.getRomajiPatterns('ば')).toEqual(['ba']);
				expect(validator.getRomajiPatterns('び')).toEqual(['bi']);
				expect(validator.getRomajiPatterns('ぶ')).toEqual(['bu']);
				expect(validator.getRomajiPatterns('べ')).toEqual(['be']);
				expect(validator.getRomajiPatterns('ぼ')).toEqual(['bo']);
			});

			it('ぱ行を正しく変換する', () => {
				expect(validator.getRomajiPatterns('ぱ')).toEqual(['pa']);
				expect(validator.getRomajiPatterns('ぴ')).toEqual(['pi']);
				expect(validator.getRomajiPatterns('ぷ')).toEqual(['pu']);
				expect(validator.getRomajiPatterns('ぺ')).toEqual(['pe']);
				expect(validator.getRomajiPatterns('ぽ')).toEqual(['po']);
			});
		});

		describe('拗音', () => {
			it('きゃ行を正しく変換する', () => {
				expect(validator.getRomajiPatterns('きゃ')).toEqual(['kya']);
				expect(validator.getRomajiPatterns('きゅ')).toEqual(['kyu']);
				expect(validator.getRomajiPatterns('きょ')).toEqual(['kyo']);
			});

			it('しゃ行を正しく変換する', () => {
				expect(validator.getRomajiPatterns('しゃ')).toEqual(['sha', 'sya']);
				expect(validator.getRomajiPatterns('しゅ')).toEqual(['shu', 'syu']);
				expect(validator.getRomajiPatterns('しょ')).toEqual(['sho', 'syo']);
			});

			it('ちゃ行を正しく変換する', () => {
				expect(validator.getRomajiPatterns('ちゃ')).toEqual(['cha', 'tya']);
				expect(validator.getRomajiPatterns('ちゅ')).toEqual(['chu', 'tyu']);
				expect(validator.getRomajiPatterns('ちょ')).toEqual(['cho', 'tyo']);
			});

			it('にゃ行を正しく変換する', () => {
				expect(validator.getRomajiPatterns('にゃ')).toEqual(['nya']);
				expect(validator.getRomajiPatterns('にゅ')).toEqual(['nyu']);
				expect(validator.getRomajiPatterns('にょ')).toEqual(['nyo']);
			});

			it('ひゃ行を正しく変換する', () => {
				expect(validator.getRomajiPatterns('ひゃ')).toEqual(['hya']);
				expect(validator.getRomajiPatterns('ひゅ')).toEqual(['hyu']);
				expect(validator.getRomajiPatterns('ひょ')).toEqual(['hyo']);
			});

			it('みゃ行を正しく変換する', () => {
				expect(validator.getRomajiPatterns('みゃ')).toEqual(['mya']);
				expect(validator.getRomajiPatterns('みゅ')).toEqual(['myu']);
				expect(validator.getRomajiPatterns('みょ')).toEqual(['myo']);
			});

			it('りゃ行を正しく変換する', () => {
				expect(validator.getRomajiPatterns('りゃ')).toEqual(['rya']);
				expect(validator.getRomajiPatterns('りゅ')).toEqual(['ryu']);
				expect(validator.getRomajiPatterns('りょ')).toEqual(['ryo']);
			});

			it('ぎゃ行を正しく変換する', () => {
				expect(validator.getRomajiPatterns('ぎゃ')).toEqual(['gya']);
				expect(validator.getRomajiPatterns('ぎゅ')).toEqual(['gyu']);
				expect(validator.getRomajiPatterns('ぎょ')).toEqual(['gyo']);
			});

			it('じゃ行を正しく変換する', () => {
				expect(validator.getRomajiPatterns('じゃ')).toEqual(['ja', 'zya']);
				expect(validator.getRomajiPatterns('じゅ')).toEqual(['ju', 'zyu']);
				expect(validator.getRomajiPatterns('じょ')).toEqual(['jo', 'zyo']);
			});

			it('びゃ行を正しく変換する', () => {
				expect(validator.getRomajiPatterns('びゃ')).toEqual(['bya']);
				expect(validator.getRomajiPatterns('びゅ')).toEqual(['byu']);
				expect(validator.getRomajiPatterns('びょ')).toEqual(['byo']);
			});

			it('ぴゃ行を正しく変換する', () => {
				expect(validator.getRomajiPatterns('ぴゃ')).toEqual(['pya']);
				expect(validator.getRomajiPatterns('ぴゅ')).toEqual(['pyu']);
				expect(validator.getRomajiPatterns('ぴょ')).toEqual(['pyo']);
			});
		});

		describe('促音', () => {
			it('促音を正しく変換する', () => {
				expect(validator.getRomajiPatterns('がっこう')).toContain('gakkou');
				// 末尾の「ん」は撥音ルールにより nn のみ許容
				expect(validator.getRomajiPatterns('にっぽん')).toContain('nipponn');
				expect(validator.getRomajiPatterns('ぶっか')).toContain('bukka');
				expect(validator.getRomajiPatterns('せっかく')).toContain('sekkaku');
			});
		});

		describe('長音', () => {
			it('長音を正しく変換する', () => {
				const patterns = validator.getRomajiPatterns('こう');
				expect(patterns).toContain('kou');
				expect(patterns).toContain('koo');
			});
		});

		describe('文字列全体の変換', () => {
			it('複数文字の文字列を正しく変換する', () => {
				const patterns = validator.getRomajiPatterns('つる');
				expect(patterns).toContain('tsuru');
				expect(patterns).toContain('turu');
			});

			it('スペースを含む文字列を正しく変換する', () => {
				const patterns = validator.getRomajiPatterns('つる まう');
				expect(patterns).toContain('tsuru mau');
				expect(patterns).toContain('turu mau');
			});

			it('撥音(ん)の文脈ルール: 次が母音/や行/な行のときはnnのみ許容する', () => {
				const patterns = validator.getRomajiPatterns('おんせんに');
				// 先頭の「ん」は次が「せ(se)」なので n/nn の両方許容、
				// 後半の「ん」は次が「に(ni)」なので nn のみ許容
				expect(patterns).toEqual(['onsennni', 'onnsennni']);
				expect(patterns).not.toContain('onsenni');
				expect(patterns).not.toContain('onnsenni');
			});
		});
	});

	describe('入力判定', () => {
		describe('validateInput', () => {
			it('正しい入力を判定する', () => {
				const result = validator.validateInput('つる', 'tsuru');
				expect(result.isValid).toBe(true);
				expect(result.progress).toBe(1); // 100%完了
			});

			it('別の正しい入力パターンを判定する', () => {
				const result = validator.validateInput('つる', 'turu');
				expect(result.isValid).toBe(true);
				expect(result.progress).toBe(1);
			});

			it('部分的に正しい入力を判定する', () => {
				const result = validator.validateInput('つる', 'tsu');
				expect(result.isValid).toBe(true);
				expect(result.progress).toBeGreaterThan(0);
				expect(result.progress).toBeLessThan(1);
			});

			it('誤った入力を判定する', () => {
				const result = validator.validateInput('つる', 'tzuru');
				expect(result.isValid).toBe(false);
			});
		});

		describe('validateChar', () => {
			it('正しい文字入力を判定する', () => {
				validator.setTarget('つる');
				expect(validator.validateChar('t')).toBe(true);
				expect(validator.validateChar('s')).toBe(true);
				expect(validator.validateChar('u')).toBe(true);
				expect(validator.validateChar('r')).toBe(true);
				expect(validator.validateChar('u')).toBe(true);
			});

			it('誤った文字入力を判定する', () => {
				validator.setTarget('つる');
				expect(validator.validateChar('t')).toBe(true);
				expect(validator.validateChar('z')).toBe(false); // 誤り
			});

			it('複数パターンある場合の入力を判定する', () => {
				validator.setTarget('し');
				expect(validator.validateChar('s')).toBe(true);
				expect(validator.validateChar('h')).toBe(true); // shiパターン
				expect(validator.validateChar('i')).toBe(true);

				validator.reset();
				validator.setTarget('し');
				expect(validator.validateChar('s')).toBe(true);
				expect(validator.validateChar('i')).toBe(true); // siパターン
			});
		});

		describe('入力状態管理', () => {
			it('入力位置を正しく管理する', () => {
				validator.setTarget('かるた');
				expect(validator.getCurrentPosition()).toBe(0);

				validator.validateChar('k');
				expect(validator.getCurrentPosition()).toBe(1);

				validator.validateChar('a');
				expect(validator.getCurrentPosition()).toBe(2);

				validator.validateChar('r');
				expect(validator.getCurrentPosition()).toBe(3);
			});

			it('リセット機能が正しく動作する', () => {
				validator.setTarget('かるた');
				validator.validateChar('k');
				validator.validateChar('a');
				expect(validator.getCurrentPosition()).toBe(2);

				validator.reset();
				expect(validator.getCurrentPosition()).toBe(0);
			});

			it('誤入力回数をカウントする', () => {
				validator.setTarget('かるた');
				expect(validator.getMistakeCount()).toBe(0);

				validator.validateChar('k');
				expect(validator.getMistakeCount()).toBe(0);

				validator.validateChar('z'); // 誤り
				expect(validator.getMistakeCount()).toBe(1);

				validator.validateChar('a');
				expect(validator.getMistakeCount()).toBe(1); // 増えない
			});
		});
	});

	describe('上毛かるたの実データテスト', () => {
		it('「つる まう かたち の ぐんまけん」を正しく判定する', () => {
			const hiragana = 'つる まう かたち の ぐんまけん';
			// 末尾の「ん」は撥音ルールにより nn 必須
			const romaji = 'tsuru mau katachi no gunmakenn';
			const result = validator.validateInput(hiragana, romaji);
			expect(result.isValid).toBe(true);
			expect(result.progress).toBe(1);
		});

		it('「ねぎ と こんにゃく しもにた めいぶつ」を正しく判定する', () => {
			const hiragana = 'ねぎ と こんにゃく しもにた めいぶつ';
			// 「にゃ」直前の「ん」は撥音ルールにより nn 必須（konnnyaku）
			const romaji = 'negi to konnnyaku shimonita meibutsu';
			const result = validator.validateInput(hiragana, romaji);
			expect(result.isValid).toBe(true);
		});

		it('「ちから あわせる にひゃくまんにん」を正しく判定する', () => {
			const hiragana = 'ちから あわせる にひゃくまんにん';
			// 「に」直前の「ん」と末尾の「ん」は撥音ルールにより nn 必須
			const romaji = 'chikara awaseru nihyakumannninn';
			const result = validator.validateInput(hiragana, romaji);
			expect(result.isValid).toBe(true);
		});
	});

	describe('エッジケース', () => {
		it('空文字列を処理する', () => {
			expect(validator.getRomajiPatterns('')).toEqual(['']);
			const result = validator.validateInput('', '');
			expect(result.isValid).toBe(true);
		});

		it('nullやundefinedを処理する', () => {
			expect(validator.getRomajiPatterns(null as unknown as string)).toEqual(['']);
			expect(validator.getRomajiPatterns(undefined as unknown as string)).toEqual(['']);
		});

		it('非ひらがな文字を処理する', () => {
			expect(validator.getRomajiPatterns('ABC')).toEqual(['ABC']);
			expect(validator.getRomajiPatterns('123')).toEqual(['123']);
			expect(validator.getRomajiPatterns('カタカナ')).toEqual(['カタカナ']);
		});
	});

	describe('パフォーマンステスト', () => {
		it('1文字判定が30ms以内', () => {
			validator.setTarget('あ');
			const start = performance.now();
			validator.validateChar('a');
			const end = performance.now();
			expect(end - start).toBeLessThan(30);
		});

		it('100文字の文字列判定が100ms以内', () => {
			const longText = 'あ'.repeat(100);
			const start = performance.now();
			validator.getRomajiPatterns(longText);
			const end = performance.now();
			expect(end - start).toBeLessThan(100);
		});
	});
});
