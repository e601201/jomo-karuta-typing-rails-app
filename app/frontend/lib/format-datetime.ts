/**
 * 日時（年月日 + 時分）を ja-JP で表記する（例: 2024/03/15 14:30）。
 * プレイ履歴・フィードバック一覧など、受信・記録の日時表示で同一表記を保つ。
 * 年月日のみの表記（プロフィール・バッジ解除日）は書式が違うのでここには寄せない。
 */
export function formatDateTime(iso: string): string {
	return new Date(iso).toLocaleString('ja-JP', {
		year: 'numeric',
		month: '2-digit',
		day: '2-digit',
		hour: '2-digit',
		minute: '2-digit'
	});
}
