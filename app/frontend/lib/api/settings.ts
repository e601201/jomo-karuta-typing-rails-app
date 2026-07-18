import { putJson } from '@/lib/http';
import type { UserSettings } from '@/types/game';

/**
 * ユーザー設定をアカウント単位で保存する。
 * Rails の '/api/settings' エンドポイントへ PUT し、12 項目を全置換する。
 * 失敗時（未ログイン 401・バリデーション 422 など）は HttpError をそのまま投げ、
 * 呼び出し側が未保存状態の維持やエラー表示に使えるようにする。
 */
export async function updateSettings(settings: UserSettings): Promise<UserSettings> {
	const response = await putJson<{ success: boolean; settings: UserSettings }>(
		'/api/settings',
		settings
	);
	return response.settings;
}
