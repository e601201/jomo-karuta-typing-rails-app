import type { InputValidator } from '@/lib/typing/input-validator';
import { parseHiraganaUnits } from './hiragana-units';

/**
 * ローマ字ガイド生成（旧 game/+page.svelte の updateRomajiGuide /
 * updateDynamicRomajiGuide から抽出）。
 *
 * ガイドはユーザーの実際の入力（si/ti/tu/hu などの代替入力や「ん」の
 * n/nn 選択）に追従して動的に組み替わる。「ん」の未入力時デフォルトは
 * CONTEXT.md の撥音ルールに従う（語末・母音/や行/な行/にゃにゅにょ の前は
 * 'nn'、それ以外は 'n'）。
 */

export type RomajiGuideParams = {
	validator: InputValidator;
	targetText: string;
	currentInput: string;
	completedCount: number;
};

/** 入力がまだ無いときの初期ガイド（対象文字列全体の第一パターン） */
export function buildDefaultRomajiGuide(validator: InputValidator, targetText: string): string {
	const patterns = validator.getRomajiPatterns(targetText);
	return patterns[0] || '';
}

/** ユーザー入力に基づいてローマ字ガイドを動的に組み立てる */
export function buildDynamicRomajiGuide(params: RomajiGuideParams): string {
	const { validator, targetText, currentInput, completedCount } = params;

	if (!currentInput) {
		return buildDefaultRomajiGuide(validator, targetText);
	}

	const hiraganaUnits = parseHiraganaUnits(targetText);
	let newRomajiGuide = '';
	let tempInput = currentInput;

	for (let i = 0; i < hiraganaUnits.length; i++) {
		const unit = hiraganaUnits[i];
		const patterns = validator.getRomajiPatterns(unit);
		let usedPattern = '';
		let consumed = 0;

		// この文字に入力があるかチェック
		if (tempInput.length > 0 && i <= completedCount) {
			// 'ん'の特別処理
			if (unit === 'ん') {
				const isLastChar = i === hiraganaUnits.length - 1;

				if (tempInput.startsWith('nn')) {
					// ユーザーが'nn'を入力 - 'nn'パターンを表示
					usedPattern = 'nn';
					consumed = 2;
				} else if (tempInput.startsWith('n')) {
					// ユーザーが単一の'n'を入力
					const charAfterN = tempInput[1];
					const nextUnit = hiraganaUnits[i + 1];

					if (charAfterN === 'n') {
						// ユーザーが'nn'を入力 - 'nn'パターンを表示
						usedPattern = 'nn';
						consumed = 2;
					} else if (!nextUnit || isLastChar) {
						// 最後の文字 - 常に'nn'パターンを表示
						if (charAfterN === 'n') {
							// ユーザーが'nn'を入力
							usedPattern = 'nn';
							consumed = 2;
						} else if (!charAfterN && i === completedCount) {
							// 現在入力中、期待どおり'nn'を表示
							usedPattern = 'nn';
							consumed = 0;
						} else {
							// 'nn'パターンを表示
							usedPattern = 'nn';
							consumed = 1;
						}
					} else {
						// 次の単位に基づいて必要なパターンを決定
						let requiredPattern = 'n';

						// 'nn'が必要な特別なケース
						if (nextUnit === 'にゃ' || nextUnit === 'にゅ' || nextUnit === 'にょ') {
							requiredPattern = 'nn';
						} else if (
							nextUnit === 'な' ||
							nextUnit === 'に' ||
							nextUnit === 'ぬ' ||
							nextUnit === 'ね' ||
							nextUnit === 'の'
						) {
							requiredPattern = 'nn';
						} else if (/^[あいうえおやゆよ]/.test(nextUnit)) {
							requiredPattern = 'nn';
						}

						if (requiredPattern === 'nn') {
							if (charAfterN === 'n') {
								// ユーザーが'nn'を入力
								usedPattern = 'nn';
								consumed = 2;
							} else if (!charAfterN && i === completedCount) {
								// 現在入力中、期待されるパターンを表示
								usedPattern = 'nn';
								consumed = 0;
							} else {
								// 'nn'パターンを表示
								usedPattern = 'nn';
								consumed = 1;
							}
						} else {
							// 単一の'n'が有効
							if (
								charAfterN &&
								validator.getRomajiPatterns(nextUnit).some((p) => p.startsWith(charAfterN))
							) {
								// 'n'の後の文字が次の単位のパターンの開始と一致
								usedPattern = 'n';
								consumed = 1;
							} else if (!charAfterN && i === completedCount) {
								// 現在'n'だけでこの'ん'を入力中
								usedPattern = 'n';
								consumed = 0;
							} else {
								usedPattern = 'n';
								consumed = 1;
							}
						}
					}
				} else {
					// まだ'n'の入力がない、コンテキストに基づいてデフォルトを選択
					const nextUnit = hiraganaUnits[i + 1];
					if (nextUnit) {
						// 特別なケース：にゃ、にゅ、にょは独立した音 - 単一の'n'を使用
						if (nextUnit === 'にゃ' || nextUnit === 'にゅ' || nextUnit === 'にょ') {
							usedPattern = 'n';
						} else {
							const nextPatterns = validator.getRomajiPatterns(nextUnit);
							const initials = new Set<string>();
							nextPatterns.forEach((p) => {
								if (p && p.length > 0) initials.add(p[0]);
							});
							const requiresDoubleN = Array.from(initials).some((c) => /[aiueoyn]/.test(c));
							usedPattern = requiresDoubleN ? 'nn' : 'n';
						}
					} else {
						usedPattern = patterns[0] || 'n';
					}
				}
			}
			// 代替入力がある他の文字の特別処理
			else if (unit === 'し' && (tempInput.startsWith('si') || tempInput === 's')) {
				usedPattern = 'si';
				consumed = tempInput.startsWith('si') ? 2 : tempInput.length;
			} else if (unit === 'ち' && (tempInput.startsWith('ti') || tempInput === 't')) {
				usedPattern = 'ti';
				consumed = tempInput.startsWith('ti') ? 2 : tempInput.length;
			} else if (unit === 'つ' && (tempInput.startsWith('tu') || tempInput === 't')) {
				usedPattern = 'tu';
				consumed = tempInput.startsWith('tu') ? 2 : tempInput.length;
			} else if (unit === 'ふ' && (tempInput.startsWith('hu') || tempInput === 'h')) {
				usedPattern = 'hu';
				consumed = tempInput.startsWith('hu') ? 2 : tempInput.length;
			} else {
				// 標準パターンをチェック
				for (const pattern of patterns) {
					if (tempInput.startsWith(pattern)) {
						usedPattern = pattern;
						consumed = pattern.length;
						break;
					} else if (pattern.startsWith(tempInput) && i === completedCount) {
						// 現在このパターンを入力中
						usedPattern = pattern;
						consumed = tempInput.length;
						break;
					}
				}

				// 一致が見つからない場合はデフォルトパターンを使用
				if (!usedPattern) {
					usedPattern = patterns[0] || '';
				}
			}

			// 一時入力を更新
			if (consumed > 0) {
				tempInput = tempInput.slice(consumed);
			}
		} else {
			// この文字にはまだ入力がない、デフォルトパターンを選択
			if (unit === 'ん') {
				const nextUnit = hiraganaUnits[i + 1];
				if (nextUnit) {
					// 特別なケース：にゃ、にゅ、にょの前には'nn'が必要
					if (nextUnit === 'にゃ' || nextUnit === 'にゅ' || nextUnit === 'にょ') {
						usedPattern = 'nn';
					}
					// な行（な、に、ぬ、ね、の）の前は 'nn' が必須
					else if (
						nextUnit === 'な' ||
						nextUnit === 'に' ||
						nextUnit === 'ぬ' ||
						nextUnit === 'ね' ||
						nextUnit === 'の'
					) {
						usedPattern = 'nn';
					}
					// 母音・や行の前も 'nn' が必須
					else if (/^[あいうえおやゆよ]/.test(nextUnit)) {
						usedPattern = 'nn';
					}
					// それ以外は 'n' を表示
					else {
						usedPattern = 'n';
					}
				} else {
					// 末尾の「ん」も 'nn' を表示（一貫性のため）
					usedPattern = 'nn';
				}
			} else {
				usedPattern = patterns[0] || '';
			}
		}

		newRomajiGuide += usedPattern;
	}

	return newRomajiGuide;
}
