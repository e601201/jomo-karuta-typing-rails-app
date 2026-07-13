import { postJson } from '@/lib/http';

/**
 * スコアを保存する。
 * 旧 supabaseService.saveScore のペイロード仕様を踏襲し、
 * Rails の '/api/scores' エンドポイントへ POST する。
 */
export async function saveScore(
	nickName: string,
	score: number,
	difficulty: 'beginner' | 'standard' | 'advanced' = 'standard',
	gameMode?: 'random' | 'timeattack',
	time?: number
): Promise<{ success: boolean; error?: string }> {
	const payload: Record<string, unknown> = {
		nick_name: nickName,
		difficulty: difficulty
	};

	if (gameMode === 'timeattack') {
		payload.time = time;
		payload.game_mode = 'timeattack';
	} else {
		payload.score = score;
		payload.game_mode = gameMode || 'random';
	}

	try {
		await postJson('/api/scores', payload);
		return { success: true };
	} catch (error) {
		console.error('Error saving score:', error);
		return {
			success: false,
			error: error instanceof Error ? error.message : 'スコアの登録に失敗しました'
		};
	}
}
