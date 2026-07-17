interface Props {
	elapsedTime: number; // ミリ秒
	penalty: number; // ミリ秒
	isCompleted: boolean;
}

// デザインカンプ（design.pen）準拠のフォント指定
const SERIF = { fontFamily: "'Noto Serif JP', serif" } as const;
const MONO = { fontFamily: "'JetBrains Mono', monospace" } as const;

// 時間をフォーマット (SS.ms形式)
function formatTime(ms: number): string {
	const seconds = Math.floor(ms / 1000);
	const milliseconds = Math.floor((ms % 1000) / 10); // 10ms単位
	return `${seconds}.${milliseconds.toString().padStart(2, '0')}`;
}

export default function TimeAttackTimer({ elapsedTime, penalty, isCompleted }: Props) {
	// 最終タイムを計算
	const finalTime = elapsedTime + penalty;

	return (
		<div className="flex h-full flex-col items-center justify-center rounded-lg border border-[#C9A961] bg-[#0A1A35]/80 px-8 py-6 shadow-lg">
			{/* メインタイマー */}
			<div className="flex items-end gap-2">
				<span className="text-6xl font-extrabold text-[#E5C875] tabular-nums" style={MONO}>
					{formatTime(isCompleted ? finalTime : elapsedTime)}
				</span>
				<span className="pb-1 text-2xl font-semibold text-[#F5E9C8]" style={SERIF}>
					秒
				</span>
			</div>

			{/* ペナルティ表示 */}
			{penalty > 0 && (
				<div className="mt-1 text-base font-semibold text-[#E5453D]" style={SERIF}>
					ペナルティ: +{formatTime(penalty)}秒
				</div>
			)}

			{/* 完了時の最終タイム表示 */}
			{isCompleted && penalty > 0 && (
				<div className="mt-2 border-t border-[#C9A961]/40 pt-2">
					<span className="text-sm text-[#B8A874]" style={SERIF}>
						実タイム: {formatTime(elapsedTime)}秒
					</span>
				</div>
			)}
		</div>
	);
}
