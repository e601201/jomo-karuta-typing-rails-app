import type { InputValidator } from '@/lib/typing/input-validator';

/**
 * 入力ハイライト状態の計算（旧 game/+page.svelte の handleCharacterInput /
 * handleBackspace から抽出）。
 *
 * 旧実装では「入力がどのひらがな単位まで到達しているか」を求めるループが
 * handleCharacterInput と handleBackspace にほぼ同一のコードとして2回
 * 出現していた。ここでは matchHiraganaProgress として1つに統合する。
 * 状態配列の組み立ては旧実装の非対称性（文字入力後は部分入力中の単位も
 * 'pending'、バックスペース後のみ 'current'）をそのまま保存している。
 */

export type InputCharState = 'pending' | 'correct' | 'incorrect' | 'current';
export type RomajiCharState = 'pending' | 'correct' | 'incorrect';

export type HiraganaProgress = {
	completedCount: number;
	partiallyCompleteIndex: number;
};

/**
 * 入力文字列がひらがな単位列のどこまでを完成させているかを計算する。
 * 「ん」は文脈（語末か、次の単位が n+子音 で始まり得るか）で n / nn の
 * 受理が変わるため特別処理する。
 */
export function matchHiraganaProgress(
	hiraganaUnits: string[],
	input: string,
	validator: InputValidator
): HiraganaProgress {
	let completedCount = 0;
	let partiallyCompleteIndex = -1;
	let tempInput = input;

	for (let i = 0; i < hiraganaUnits.length; i++) {
		const unit = hiraganaUnits[i];
		const patterns = validator.getRomajiPatterns(unit);
		let matched = false;
		let partial = false;

		// 'ん'の特別処理
		if (unit === 'ん') {
			const isLastChar = i === hiraganaUnits.length - 1;

			if (tempInput === 'n') {
				// 'n'のみ - 常に部分的として保持
				partial = true;
				partiallyCompleteIndex = i;
			} else if (tempInput.startsWith('nn')) {
				// 'nn'は常に'ん'を完成
				completedCount++;
				tempInput = tempInput.slice(2);
				matched = true;
			} else if (tempInput.startsWith('n') && tempInput.length > 1) {
				const charAfterN = tempInput[1];

				if (isLastChar) {
					// 最後の文字が'ん' - 'nn'を使う必要があるので、これは無効
					// 2番目の'n'を待って部分的として保持
					partial = true;
					partiallyCompleteIndex = i;
				} else {
					// 最後の文字ではない - 'n'を受け入れられるかチェック
					const nextUnit = hiraganaUnits[i + 1];
					const nextPatterns = validator.getRomajiPatterns(nextUnit);

					// 次のひらがなが n + charAfterN で始まるかチェック
					const canStartWithN = nextPatterns.some((p) => p.startsWith('n' + charAfterN));

					if (!canStartWithN && charAfterN !== 'n') {
						// この'n'は'ん'である必要があり、完成する
						completedCount++;
						tempInput = tempInput.slice(1);
						matched = true;
					} else {
						// 曖昧または'nn'を待っている
						partial = true;
						partiallyCompleteIndex = i;
					}
				}
			}
		} else {
			// 通常の文字マッチング
			for (const pattern of patterns) {
				if (tempInput.startsWith(pattern)) {
					// このひらがなは完成
					completedCount++;
					tempInput = tempInput.slice(pattern.length);
					matched = true;
					break;
				}
			}
		}

		// 完全に一致しない場合は部分一致をチェック
		if (!matched && !partial && tempInput.length > 0) {
			for (const pattern of patterns) {
				if (pattern.startsWith(tempInput)) {
					// この文字を入力中
					partial = true;
					partiallyCompleteIndex = i;
					break;
				}
			}

			if (!partial) {
				break; // 全く一致しない
			}
		}

		if (!matched && !partial) {
			break;
		}
	}

	return { completedCount, partiallyCompleteIndex };
}

/**
 * 正しい文字入力後のひらがな状態配列。
 * 旧実装は部分入力中の単位（partiallyCompleteIndex）にも 'pending' を
 * 割り当てていたため、completedCount までが 'correct'、残りは 'pending'。
 */
export function buildInputStatesAfterInput(
	unitCount: number,
	completedCount: number
): InputCharState[] {
	const states: InputCharState[] = new Array(unitCount);
	for (let i = 0; i < unitCount; i++) {
		states[i] = i < completedCount ? 'correct' : 'pending';
	}
	return states;
}

/**
 * バックスペース後のひらがな状態配列。
 * こちらは部分入力中の単位を 'current' として表示する（旧実装の非対称性を保存）。
 */
export function buildInputStatesAfterBackspace(
	unitCount: number,
	completedCount: number,
	partiallyCompleteIndex: number
): InputCharState[] {
	const states: InputCharState[] = new Array(unitCount);
	for (let i = 0; i < unitCount; i++) {
		if (i < completedCount) {
			states[i] = 'correct';
		} else if (i === partiallyCompleteIndex) {
			states[i] = 'current';
		} else {
			states[i] = 'pending';
		}
	}
	return states;
}

/**
 * 誤入力時のひらがな状態配列。誤入力位置（= 現在の完了数の次の単位）を
 * 'incorrect' にする。errorIndex は 500ms 後のリセットに使う。
 */
export function buildInputStatesOnError(
	unitCount: number,
	completedCount: number
): { states: InputCharState[]; errorIndex: number } {
	const states: InputCharState[] = new Array(unitCount);
	let errorIndex = completedCount;
	for (let i = 0; i < unitCount; i++) {
		if (i < completedCount) {
			states[i] = 'correct';
		} else if (i === completedCount) {
			states[i] = 'incorrect';
			errorIndex = i;
		} else {
			states[i] = 'pending';
		}
	}
	return { states, errorIndex };
}

/**
 * ローマ字ガイドの状態配列。入力済みの位置までが 'correct'、残りは 'pending'。
 */
export function buildRomajiStates(guideLength: number, inputLength: number): RomajiCharState[] {
	const states: RomajiCharState[] = new Array(guideLength);
	for (let i = 0; i < guideLength; i++) {
		states[i] = i < inputLength ? 'correct' : 'pending';
	}
	return states;
}

/**
 * 誤入力時のローマ字状態配列。現在の入力位置を 'incorrect' にする。
 */
export function buildRomajiStatesOnError(
	guideLength: number,
	inputLength: number
): RomajiCharState[] {
	const states: RomajiCharState[] = new Array(guideLength);
	for (let i = 0; i < guideLength; i++) {
		if (i < inputLength) {
			states[i] = 'correct';
		} else if (i === inputLength) {
			states[i] = 'incorrect';
		} else {
			states[i] = 'pending';
		}
	}
	return states;
}
