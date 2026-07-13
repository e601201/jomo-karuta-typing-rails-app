interface Props {
	elapsedTime: number; // ミリ秒
	penalty: number; // ミリ秒
	isCompleted: boolean;
}

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
		<div className="flex flex-col items-center justify-center rounded-lg bg-white p-4 shadow-lg">
			{/* メインタイマー */}
			<div className="flex items-baseline">
				<span className="text-6xl font-bold text-blue-600 tabular-nums">
					{formatTime(isCompleted ? finalTime : elapsedTime)}
				</span>
				<span className="ml-2 text-2xl text-gray-600">秒</span>
			</div>

			{/* ペナルティ表示 */}
			{penalty > 0 && (
				<div className="mt-2 text-lg text-red-500">ペナルティ: +{formatTime(penalty)}秒</div>
			)}

			{/* 完了時の最終タイム表示 */}
			{isCompleted && penalty > 0 && (
				<div className="mt-2 border-t-2 border-gray-200 pt-2">
					<span className="text-sm text-gray-600">実タイム: {formatTime(elapsedTime)}秒</span>
				</div>
			)}
		</div>
	);
}
