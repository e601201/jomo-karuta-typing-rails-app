import { postJson } from '@/lib/http';

/**
 * プレイ記録（1プレイ分の最終スコア）を保存する。
 * ログインユーザーがゲームを自然完了したときに呼ぶ（ADR 0005 / #20）。
 * ランキング登録（saveScore）とは独立。timeattack は経過時間を 'time'（ms）で送る。
 */
export interface GameResultPayload {
	game_mode: 'random' | 'timeattack';
	difficulty: 'beginner' | 'standard' | 'advanced';
	score?: number; // random 用
	time?: number; // timeattack 用（ms）
	accuracy: number; // 0..100 の整数パーセント
	wpm: number;
	max_combo: number;
	correct_cards: number;
}

export async function saveGameResult(
	payload: GameResultPayload
): Promise<{ success: boolean; error?: string }> {
	try {
		await postJson('/api/game_results', payload);
		return { success: true };
	} catch (error) {
		console.error('Error saving game result:', error);
		return {
			success: false,
			error: error instanceof Error ? error.message : 'プレイ記録の保存に失敗しました'
		};
	}
}
