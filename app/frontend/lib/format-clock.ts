/**
 * 進行把握用のクロック表記（ms）を「mm:ss」文字列にする（例: 112000 → '01:52'）。
 * 走行中のクロック（カウントダウン・経過時間）で幅を安定させるためゼロ埋めする。
 * 記録として比較・確定される精密タイムは format-time.ts の秒.センチ秒を使う（ADR 0008）
 */
export function formatClock(ms: number): string {
	const totalSeconds = Math.floor(ms / 1000);
	const minutes = Math.floor(totalSeconds / 60);
	const seconds = totalSeconds % 60;
	return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}
