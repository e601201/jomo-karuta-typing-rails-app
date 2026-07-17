interface Props {
	current: number;
	total: number;
	mistakes: number;
	skips: number;
}

// デザインカンプ（design.pen）準拠のフォント指定
const SERIF = { fontFamily: "'Noto Serif JP', serif" } as const;
const MONO = { fontFamily: "'JetBrains Mono', monospace" } as const;

export default function TimeAttackProgress({ current, total, mistakes, skips }: Props) {
	// 進捗パーセンテージ
	const percentage = Math.min((current / total) * 100, 100);

	return (
		<div className="flex h-full flex-col justify-center rounded-lg border border-[#C9A961] bg-[#0A1A35]/80 px-8 py-5 shadow-lg">
			{/* 進捗バー */}
			<div className="mb-2 flex items-center justify-between">
				<span className="text-base font-semibold text-[#C9A961]" style={SERIF}>
					進捗
				</span>
				<span className="text-xl font-extrabold text-[#E5C875] tabular-nums" style={MONO}>
					{current} / {total}
				</span>
			</div>
			<div className="h-2 w-full overflow-hidden rounded-full bg-[#1E3560]">
				<div
					className="h-full rounded-full bg-[#E5C875] transition-all duration-300"
					style={{ width: `${percentage}%` }}
				></div>
			</div>

			{/* 統計情報 */}
			<div className="mt-3 flex gap-8">
				<div className="flex flex-1 items-center justify-between">
					<span className="text-sm text-[#B8A874]" style={SERIF}>
						ミス
					</span>
					<span
						className={`text-lg font-bold tabular-nums ${mistakes > 0 ? 'text-[#E5A54B]' : 'text-[#F5E9C8]'}`}
						style={SERIF}
					>
						{mistakes}回
					</span>
				</div>
				<div className="flex flex-1 items-center justify-between">
					<span className="text-sm text-[#B8A874]" style={SERIF}>
						スキップ
					</span>
					<span
						className={`text-lg font-bold tabular-nums ${skips > 0 ? 'text-[#E5453D]' : 'text-[#F5E9C8]'}`}
						style={SERIF}
					>
						{skips}回
					</span>
				</div>
			</div>
		</div>
	);
}
