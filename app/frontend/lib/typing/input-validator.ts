/**
 * ローマ字入力判定エンジン
 */

/**
 * 入力検証結果
 */
export interface ValidationResult {
	/** 入力が有効かどうか */
	isValid: boolean;
	/** 進捗率 (0.0 ~ 1.0) */
	progress: number;
	/** 現在の入力位置 */
	currentPosition?: number;
	/** 誤入力回数 */
	mistakeCount?: number;
	/** 入力が完了したか */
	isComplete?: boolean;
}

/**
 * ひらがなからローマ字への変換マップ
 */
const ROMAJI_MAP: Record<string, string[]> = {
	// あ行
	あ: ['a'],
	い: ['i'],
	う: ['u'],
	え: ['e'],
	お: ['o'],
	// か行
	か: ['ka'],
	き: ['ki'],
	く: ['ku'],
	け: ['ke'],
	こ: ['ko'],
	// さ行
	さ: ['sa'],
	し: ['shi', 'si'],
	す: ['su'],
	せ: ['se'],
	そ: ['so'],
	// た行
	た: ['ta'],
	ち: ['chi', 'ti'],
	つ: ['tsu', 'tu'],
	て: ['te'],
	と: ['to'],
	// な行
	な: ['na'],
	に: ['ni'],
	ぬ: ['nu'],
	ね: ['ne'],
	の: ['no'],
	// は行
	は: ['ha'],
	ひ: ['hi'],
	ふ: ['fu', 'hu'],
	へ: ['he'],
	ほ: ['ho'],
	// ま行
	ま: ['ma'],
	み: ['mi'],
	む: ['mu'],
	め: ['me'],
	も: ['mo'],
	// や行
	や: ['ya'],
	ゆ: ['yu'],
	よ: ['yo'],
	// ら行
	ら: ['ra'],
	り: ['ri'],
	る: ['ru'],
	れ: ['re'],
	ろ: ['ro'],
	// わ行
	わ: ['wa'],
	を: ['wo', 'o'],
	// Note: 'ん' at the end of text requires 'nn', but in the middle can be 'n' or 'nn'
	ん: ['n', 'nn'],

	// が行
	が: ['ga'],
	ぎ: ['gi'],
	ぐ: ['gu'],
	げ: ['ge'],
	ご: ['go'],
	// ざ行
	ざ: ['za'],
	じ: ['ji', 'zi'],
	ず: ['zu'],
	ぜ: ['ze'],
	ぞ: ['zo'],
	// だ行
	だ: ['da'],
	ぢ: ['di', 'ji'],
	づ: ['du', 'zu'],
	で: ['de'],
	ど: ['do'],
	// ば行
	ば: ['ba'],
	び: ['bi'],
	ぶ: ['bu'],
	べ: ['be'],
	ぼ: ['bo'],
	// ぱ行
	ぱ: ['pa'],
	ぴ: ['pi'],
	ぷ: ['pu'],
	ぺ: ['pe'],
	ぽ: ['po'],

	// 拗音
	きゃ: ['kya'],
	きゅ: ['kyu'],
	きょ: ['kyo'],
	しゃ: ['sha', 'sya'],
	しゅ: ['shu', 'syu'],
	しょ: ['sho', 'syo'],
	ちゃ: ['cha', 'tya'],
	ちゅ: ['chu', 'tyu'],
	ちょ: ['cho', 'tyo'],
	にゃ: ['nya'],
	にゅ: ['nyu'],
	にょ: ['nyo'],
	ひゃ: ['hya'],
	ひゅ: ['hyu'],
	ひょ: ['hyo'],
	みゃ: ['mya'],
	みゅ: ['myu'],
	みょ: ['myo'],
	りゃ: ['rya'],
	りゅ: ['ryu'],
	りょ: ['ryo'],
	ぎゃ: ['gya'],
	ぎゅ: ['gyu'],
	ぎょ: ['gyo'],
	じゃ: ['ja', 'zya'],
	じゅ: ['ju', 'zyu'],
	じょ: ['jo', 'zyo'],
	びゃ: ['bya'],
	びゅ: ['byu'],
	びょ: ['byo'],
	ぴゃ: ['pya'],
	ぴゅ: ['pyu'],
	ぴょ: ['pyo'],

	// スペース
	' ': [' '],

	// 句読点
	'、': ['、', ','],
	'　': [' '],

	// 長音記号
	ー: ['-']
};

/**
 * ローマ字入力検証クラス
 */
import type { PartialInputRange } from '@/types';

export class InputValidator {
	private currentPosition: number = 0;
	private currentInput: string = '';
	private mistakeCount: number = 0;
	private validPatterns: string[] = [];
	private partialRange: PartialInputRange | null = null;
	private targetText: string = '';

	/**
	 * ターゲットテキストを設定
	 */
	setTarget(text: string): void {
		this.targetText = text;
		this.reset();
		// 入力対象のパターンを初期化
		this.validPatterns = this.getRomajiPatterns(text);
	}

	/**
	 * 現在のターゲットテキストを取得
	 */
	getTarget(): string {
		return this.targetText;
	}

	/**
	 * ひらがな文字列からローマ字パターンを取得
	 */
	getRomajiPatterns(hiragana: string): string[] {
		if (!hiragana || hiragana === null || hiragana === undefined) {
			return [''];
		}

		// 非ひらがな文字はそのまま返す（長音記号も含む）
		if (!/[\u3040-\u309F\u30FC\s\u3000]/.test(hiragana)) {
			return [hiragana];
		}

		// 文字列を解析してパターンを生成
		const patterns = this.generatePatterns(hiragana);
		return patterns;
	}

	/**
	 * 文字列全体のパターンを生成
	 */
	private generatePatterns(text: string): string[] {
		const chars = this.parseHiragana(text);
		const romajiArrays: string[][] = [];

		for (let i = 0; i < chars.length; i++) {
			const char = chars[i];

			// 促音の処理
			if (char === 'っ') {
				if (i < chars.length - 1) {
					const nextChar = chars[i + 1];
					const nextPatterns = ROMAJI_MAP[nextChar];
					if (nextPatterns) {
						// 次の文字の最初の子音を重ねる
						const consonants = new Set<string>();
						nextPatterns.forEach((pattern) => {
							if (pattern.length > 0 && /[kgsztdhbpmyrwnf]/.test(pattern[0])) {
								consonants.add(pattern[0]);
							}
						});

						if (consonants.size > 0) {
							romajiArrays.push(Array.from(consonants).map((c) => c));
						} else {
							romajiArrays.push(['t']); // デフォルト
						}
					} else {
						romajiArrays.push(['t']); // デフォルト
					}
				} else {
					romajiArrays.push(['t']); // デフォルト
				}
			}
			// 長音の処理
			else if (char === 'う' && i > 0) {
				const prevChar = chars[i - 1];
				if (/[こそとのほもよろごぞどぼぽ]/.test(prevChar)) {
					romajiArrays.push(['u', 'o']);
				} else {
					romajiArrays.push(ROMAJI_MAP[char] || [char]);
				}
			}
			// 撥音(ん)の文脈処理
			else if (char === 'ん') {
				// 末尾の「ん」も nn を必須にする（一貫性のため）
				if (i === chars.length - 1) {
					romajiArrays.push(['nn']);
					continue;
				}

				const nextChar = chars[i + 1];
				// 次が促音の場合は子音開始とみなす（n も nn も許容）
				if (nextChar === 'っ') {
					romajiArrays.push(['n', 'nn']);
					continue;
				}

				// にゃ/にゅ/にょ の直前は 'nn' が必要（nya と区別するため）
				if (nextChar === 'にゃ' || nextChar === 'にゅ' || nextChar === 'にょ') {
					romajiArrays.push(['nn']);
					continue;
				}

				// な行（単独）直前は nn のみ
				if (
					nextChar === 'な' ||
					nextChar === 'に' ||
					nextChar === 'ぬ' ||
					nextChar === 'ね' ||
					nextChar === 'の'
				) {
					romajiArrays.push(['nn']);
					continue;
				}

				const nextPatterns = ROMAJI_MAP[nextChar] || [nextChar];
				// 次のローマ字の先頭文字集合を抽出
				const initials = new Set<string>();
				nextPatterns.forEach((p) => {
					if (p && p.length > 0) initials.add(p[0]);
				});

				// 次が母音/や行で始まる場合は nn のみ許容（曖昧さ排除）
				const requiresDoubleN = Array.from(initials).some((c) => /[aiueoy]/.test(c));
				if (requiresDoubleN) {
					romajiArrays.push(['nn']);
				} else {
					romajiArrays.push(['n', 'nn']);
				}
			}
			// 長音記号の処理
			else if (char === 'ー') {
				romajiArrays.push(ROMAJI_MAP[char] || ['-']);
			}
			// 通常の文字
			else {
				romajiArrays.push(ROMAJI_MAP[char] || [char]);
			}
		}

		// 全パターンの組み合わせを生成
		return this.combinePatterns(romajiArrays);
	}

	/**
	 * ひらがな文字列を文字単位に分解
	 */
	private parseHiragana(text: string): string[] {
		const chars: string[] = [];
		let i = 0;

		while (i < text.length) {
			// 拗音のチェック（2文字）
			if (i < text.length - 1) {
				const twoChars = text.slice(i, i + 2);
				// 小さい文字が続く場合は拗音
				if (ROMAJI_MAP[twoChars]) {
					chars.push(twoChars);
					i += 2;
					continue;
				}
			}

			// 1文字（スペースも含む）
			chars.push(text[i]);
			i++;
		}

		return chars;
	}

	/**
	 * パターンの組み合わせを生成
	 */
	private combinePatterns(arrays: string[][]): string[] {
		if (arrays.length === 0) return [''];
		if (arrays.length === 1) return arrays[0];

		const result: string[] = [];
		const firstArray = arrays[0];
		const remainingCombinations = this.combinePatterns(arrays.slice(1));

		for (const first of firstArray) {
			for (const remaining of remainingCombinations) {
				result.push(first + remaining);
			}
		}

		return result;
	}

	/**
	 * 入力文字列全体を検証
	 */
	validateInput(hiragana: string, input: string, _position: number = 0): ValidationResult {
		// Special handling for text ending with 'ん'
		if (hiragana.endsWith('ん')) {
			// Check if we're at the 'ん' part
			const beforeN = hiragana.slice(0, -1);
			const beforeNPatterns = this.getRomajiPatterns(beforeN);

			// Find if input matches everything before 'ん'
			let matchedBeforeN = false;
			let remainingInput = '';

			for (const pattern of beforeNPatterns) {
				if (input.startsWith(pattern)) {
					matchedBeforeN = true;
					remainingInput = input.slice(pattern.length);
					break;
				}
			}

			if (matchedBeforeN && remainingInput) {
				// We're typing the final 'ん'
				if (remainingInput === 'n') {
					// 末尾の'ん'は 'nn' が必須なので、'n' は未完了
					return {
						isValid: true,
						progress: 0.5, // 'n' is half of 'nn'
						isComplete: false
					};
				} else if (remainingInput === 'nn') {
					// 'nn' for final 'ん' - complete
					return {
						isValid: true,
						progress: 1.0,
						isComplete: true
					};
				}
			}
		}

		// Normal validation
		const patterns = this.getRomajiPatterns(hiragana);

		// 完全一致チェック
		if (patterns.includes(input)) {
			return {
				isValid: true,
				progress: 1.0,
				isComplete: true
			};
		}

		// 部分一致チェック
		for (const pattern of patterns) {
			if (pattern.startsWith(input)) {
				return {
					isValid: true,
					progress: input.length / pattern.length,
					isComplete: false
				};
			}
		}

		return {
			isValid: false,
			progress: 0,
			isComplete: false
		};
	}

	/**
	 * 1文字ずつ入力を検証
	 */
	validateChar(char: string): boolean {
		const newInput = this.currentInput + char;

		// 有効なパターンが存在するかチェック
		let isValid = false;
		for (const pattern of this.validPatterns) {
			if (pattern.startsWith(newInput)) {
				isValid = true;
				break;
			}
		}

		if (isValid) {
			this.currentInput = newInput;
			this.currentPosition++;

			// 完全一致したパターンがあれば、そのパターンに絞り込む
			const matchedPatterns = this.validPatterns.filter((p) => p.startsWith(newInput));
			if (matchedPatterns.length > 0) {
				// 現在の入力に一致するパターンのみ残す
				const exactMatches = matchedPatterns.filter((p) => p === newInput);
				if (exactMatches.length > 0) {
					// 完全一致したら次の文字へ
					this.currentInput = '';
					// 次の文字のパターンを更新する処理が必要
				}
			}

			return true;
		} else {
			this.mistakeCount++;
			return false;
		}
	}

	/**
	 * 現在の入力位置を取得
	 */
	getCurrentPosition(): number {
		return this.currentPosition;
	}

	/**
	 * 誤入力回数を取得
	 */
	getMistakeCount(): number {
		return this.mistakeCount;
	}

	/**
	 * 入力状態をリセット
	 */
	reset(): void {
		this.currentPosition = 0;
		this.currentInput = '';
		this.mistakeCount = 0;
	}

	/**
	 * 部分入力範囲を設定
	 */
	setPartialRange(range: PartialInputRange): void {
		this.partialRange = range;
		this.targetText = range.text;
		this.validPatterns = this.getRomajiPatterns(range.text);
		this.reset();
	}

	/**
	 * 部分入力の検証
	 */
	validatePartialInput(input: string, position: number): ValidationResult {
		if (!this.partialRange) {
			return this.validateInput(this.targetText, input);
		}

		// 範囲外の入力は無効
		if (position >= this.partialRange.text.length) {
			return {
				isValid: false,
				progress: 1.0,
				isComplete: true
			};
		}

		const result = this.validateInput(this.partialRange.text, input);

		// 部分入力の完了判定
		if (result.isValid && result.progress === 1.0) {
			result.isComplete = true;
		}

		return result;
	}

	/**
	 * 部分入力用のローマ字パターンを取得
	 */
	getPartialRomajiPatterns(): string[] {
		if (!this.partialRange) {
			return this.validPatterns;
		}
		return this.getRomajiPatterns(this.partialRange.text);
	}
}
