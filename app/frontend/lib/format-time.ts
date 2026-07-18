/**
 * タイム（ms）を「秒.センチ秒」文字列にする（例: 12340 → '12.34'）。
 * ランキングとヘッダーのベストスコアで同一表記を保つための共通実装
 */
export function formatTime(ms: number): string {
	const seconds = Math.floor(ms / 1000);
	const milliseconds = Math.floor((ms % 1000) / 10);
	return `${seconds}.${milliseconds.toString().padStart(2, '0')}`;
}
