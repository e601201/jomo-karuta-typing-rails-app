interface Props {
	current: number;
	total: number;
	mistakes: number;
	skips: number;
}

export default function TimeAttackProgress({ current, total, mistakes, skips }: Props) {
	// 進捗パーセンテージ
	const percentage = Math.min((current / total) * 100, 100);

	return (
		<div className="rounded-lg bg-white p-4 shadow-md">
			{/* 進捗バー */}
			<div className="mb-3">
				<div className="mb-1 flex justify-between text-sm">
					<span className="font-medium text-gray-700">進捗</span>
					<span className="font-bold text-blue-600">
						{current}/{total}
					</span>
				</div>
				<div className="h-3 overflow-hidden rounded-full bg-gray-200">
					<div
						className="bg-liner-to-r h-full rounded-full from-blue-400 to-blue-600 transition-all duration-300"
						style={{ width: `${percentage}%` }}
					></div>
				</div>
			</div>

			{/* 統計情報 */}
			<div className="grid grid-cols-2 gap-4 text-sm">
				<div className="flex items-center justify-between">
					<span className="text-gray-600">ミス</span>
					<span className={`font-bold ${mistakes > 0 ? 'text-orange-500' : 'text-gray-700'}`}>
						{mistakes}回
					</span>
				</div>
				<div className="flex items-center justify-between">
					<span className="text-gray-600">スキップ</span>
					<span className={`font-bold ${skips > 0 ? 'text-red-500' : 'text-gray-700'}`}>
						{skips}回
					</span>
				</div>
			</div>
		</div>
	);
}
