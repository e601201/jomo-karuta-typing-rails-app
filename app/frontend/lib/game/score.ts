export type ScoreInput = {
	Q: number; // problems answered
	accuracy: number; // 0..1
	wpm: number;
	maxCombo: number;
};

export type ScoreParams = {
	BASE_PER_Q: number;
	W_MID: number;
	W_SHARPNESS: number;
	COMBO_CAP: number;
	COMBO_WEIGHT: number;
	ACC_EXP: number;
};

import type { RandomModeDifficulty } from '@/types';

/**
 * タイピングスコアを計算します。
 *
 * 概要:
 * - Base = Q × BASE_PER_Q
 * - Acc  = clamp01(accuracy) ^ ACC_EXP
 * - Speed = 0.8 + 0.4 × sigmoid(W_SHARPNESS × (wpm - W_MID))
 * - Combo = 1 + COMBO_WEIGHT × sqrt(maxCombo / COMBO_CAP) を最大1まで
 *
 * 最終スコア:
 *   round(Base × Acc × Speed × Combo)
 *
 * 目的:
 * - 正確度の影響を最優先（指数で強調）
 * - 速度はシグモイドで飽和（極端な高速での伸びを抑制）
 * - コンボは平方根で逓減し、過度な偏りを防止
 *
 * difficulty に応じて異なるパラメータを使用します。
 * p に一部パラメータを渡すとデフォルト値を上書き可能です。
 */
export function calcTypingScore(
	{ Q, accuracy, wpm, maxCombo }: ScoreInput,
	difficulty?: RandomModeDifficulty,
	p: Partial<ScoreParams> = {}
): number {
	// 難易度に応じた基本パラメータを設定
	let defaultParams: ScoreParams;

	if (difficulty === 'beginner') {
		// 初心者モード: よりやさしいスコアリング
		defaultParams = {
			BASE_PER_Q: 50, // 1問あたりの基礎点を高く
			W_MID: 70, // 速度の中心を低めに（低速でも良いスコア）
			W_SHARPNESS: 0.2, // 速度感度を緩やかに
			COMBO_CAP: 60, // コンボ上限を低めに（達成しやすく）
			COMBO_WEIGHT: 0.2, // コンボ補正を大きめに（最大+0.4）
			ACC_EXP: 2.5 // 正確度の重みを緩やかに（ミスに寛容）
		};
	} else {
		// 標準モード（standard/advanced/undefined）: 従来のスコアリング
		defaultParams = {
			BASE_PER_Q: 100, // 1問あたりの基礎点
			W_MID: 60, // 速度シグモイドの中心（このWPM付近で増分が効きやすい）
			W_SHARPNESS: 0.1, // 速度感度（勾配の鋭さ）
			COMBO_CAP: 50, // コンボ正規化の上限目安
			COMBO_WEIGHT: 0.3, // コンボ補正の寄与（最大で +0.3）
			ACC_EXP: 2.0 // 正確度の重み指数（>1でミスに厳しく）
		};
	}

	// スコア算出に用いるパラメータ（p で部分的に上書き可能）
	const params: ScoreParams = {
		...defaultParams,
		...p
	};

	const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

	// 0〜1に正規化した正確度を指数で強調（ミスに敏感にする）
	const A = clamp01(accuracy);
	const Acc = Math.pow(A, params.ACC_EXP);

	// シグモイドで速度を0〜1に圧縮し、0.8〜1.2に射影（極端な高速での伸びを抑制）
	const SpeedRaw = 1 / (1 + Math.exp(-params.W_SHARPNESS * (wpm - params.W_MID)));
	const Speed = 0.8 + 0.4 * SpeedRaw; // 0.8〜1.2

	// 平方根で逓減するコンボ補正を適用し、1.0〜(1+COMBO_WEIGHT)に制限
	const ComboRaw = Math.min(1, Math.sqrt(Math.max(0, maxCombo) / Math.max(1, params.COMBO_CAP)));
	const Combo = 1 + params.COMBO_WEIGHT * ComboRaw; // 1.0〜1.3

	// 基礎点：解答数 × 基礎点（負値は0扱い）
	const Base = Math.max(0, Q) * params.BASE_PER_Q;

	// 最終スコアを四捨五入
	const score = Math.round(Base * Acc * Speed * Combo);
	return score;
}
