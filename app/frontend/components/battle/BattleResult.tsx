import { Crown, House, LoaderCircle, RotateCcw, User, UserRound } from 'lucide-react';
import type { BattleMode, BattleOutcome, BattleStats } from '@/types/battle';
import { formatTime } from '@/lib/format-time';

const SERIF = { fontFamily: "'Noto Serif JP', serif" } as const;
const MONO = { fontFamily: "'JetBrains Mono', monospace" } as const;

interface Props {
	mode: BattleMode;
	/** null = まだ決着していない（相手の結果待ち） */
	outcome: BattleOutcome | null;
	myStats: BattleStats | null;
	opponentStats: BattleStats | null;
	opponentLeft: boolean;
	onRematch: () => void;
	onGoHome: () => void;
}

function outcomeTitle(outcome: BattleOutcome): string {
	switch (outcome) {
		case 'win':
			return 'あなたの勝ち！';
		case 'lose':
			return 'あなたの負け…';
		case 'draw':
			return '引き分け';
		case 'walkover':
			return 'あなたの勝ち！（不戦勝）';
	}
}

/** プレイヤーカードの主表示値。random はスコア、timeattack は取得札数を主役にする */
function mainValue(mode: BattleMode, stats: BattleStats | null): string {
	if (!stats) return '—';
	if (mode === 'random') return (stats.score ?? 0).toLocaleString();
	return `${stats.taken}`;
}

function subValue(mode: BattleMode, stats: BattleStats | null): string {
	if (!stats) return '';
	if (mode === 'random') return `取得札 ${stats.taken}枚`;
	return stats.timeMs !== null ? `タイム ${formatTime(stats.timeMs)}秒` : '';
}

export default function BattleResult({
	mode,
	outcome,
	myStats,
	opponentStats,
	opponentLeft,
	onRematch,
	onGoHome
}: Props) {
	const decided = outcome !== null;
	const won = outcome === 'win' || outcome === 'walkover';
	const modeLabel = mode === 'random' ? 'ランダム' : 'タイムアタック';

	const detailStats =
		mode === 'random'
			? [
					{ label: '正確率', value: `${(myStats?.accuracy ?? 100).toFixed(2)}%` },
					{ label: 'WPM', value: `${myStats?.wpm ?? 0}` },
					{ label: '最大コンボ', value: `${myStats?.maxCombo ?? 0}` }
				]
			: [
					{
						label: 'タイム',
						value:
							myStats?.timeMs !== null && myStats !== null ? `${formatTime(myStats.timeMs)}秒` : '—'
					},
					{ label: '正確率', value: `${(myStats?.accuracy ?? 100).toFixed(2)}%` },
					{ label: '最大コンボ', value: `${myStats?.maxCombo ?? 0}` }
				];

	return (
		<div data-testid="battle-result" className="flex flex-1 items-center justify-center py-4">
			<div className="w-full max-w-[720px] rounded-xl border-2 border-[#C9A961] bg-[#0A1A35]/90 px-6 py-8 shadow-2xl sm:px-12 sm:py-10">
				<div className="flex flex-col items-center gap-6">
					{/* 勝敗タイトル */}
					{decided ? (
						<div className="flex items-center gap-3">
							{won && <Crown className="h-9 w-9 text-[#E5C875]" />}
							<h2 className="text-4xl font-black text-[#E5C875] sm:text-[40px]" style={SERIF}>
								{outcomeTitle(outcome)}
							</h2>
						</div>
					) : (
						<div className="flex items-center gap-3">
							<LoaderCircle className="h-7 w-7 animate-spin text-[#E5C875]" />
							<h2 className="text-2xl font-black text-[#E5C875]" style={SERIF}>
								相手の結果を待っています…
							</h2>
						</div>
					)}

					{/* モード表示 */}
					<div className="flex items-center gap-3">
						<span
							className={`rounded-full border border-[#C9A961] px-5 py-2 text-sm font-bold text-[#F5E9C8] ${
								mode === 'timeattack' ? 'bg-[#C8302A]' : 'bg-[#0F2952]'
							}`}
							style={SERIF}
						>
							{modeLabel}
						</span>
						<span
							className="rounded-full border border-[#C9A961] bg-[#0F2952] px-5 py-2 text-sm font-bold text-[#F5E9C8]"
							style={SERIF}
						>
							対戦モード
						</span>
					</div>

					{/* 両者の結果 */}
					<div className="flex w-full items-stretch gap-3">
						<div
							className={`flex flex-1 flex-col items-center gap-1.5 rounded-[10px] border px-4 py-6 ${
								decided && won
									? 'border-[#E5C875] bg-[#1A3868]'
									: 'border-[#C9A961]/60 bg-[#132D57]'
							}`}
						>
							<span
								className="flex items-center gap-2 text-[15px] font-bold text-[#F5E9C8]"
								style={SERIF}
							>
								<User className="h-4 w-4 text-[#3FB56B]" />
								あなた
							</span>
							<span className="text-4xl font-extrabold text-[#E5C875] tabular-nums" style={MONO}>
								{mainValue(mode, myStats)}
							</span>
							<span className="text-sm text-[#B8A874]" style={SERIF}>
								{mode === 'random' ? 'スコア' : '取得札（枚）'}
							</span>
							{subValue(mode, myStats) && (
								<span className="text-xs text-[#B8A874]" style={SERIF}>
									{subValue(mode, myStats)}
								</span>
							)}
						</div>
						<span className="self-center text-lg font-black text-[#C8302A]" style={SERIF}>
							VS
						</span>
						<div
							className={`flex flex-1 flex-col items-center gap-1.5 rounded-[10px] border px-4 py-6 ${
								decided && !won && outcome !== 'draw'
									? 'border-[#E5C875] bg-[#1A3868]'
									: 'border-[#C9A961]/60 bg-[#132D57]'
							}`}
						>
							<span
								className="flex items-center gap-2 text-[15px] font-bold text-[#B8A874]"
								style={SERIF}
							>
								<UserRound className="h-4 w-4" />
								相手
								{opponentLeft && (
									<span className="text-xs font-semibold text-[#E5453D]">（退出）</span>
								)}
							</span>
							<span className="text-4xl font-extrabold text-[#F5E9C8] tabular-nums" style={MONO}>
								{mainValue(mode, opponentStats)}
							</span>
							<span className="text-sm text-[#B8A874]" style={SERIF}>
								{mode === 'random' ? 'スコア' : '取得札（枚）'}
							</span>
							{subValue(mode, opponentStats) && (
								<span className="text-xs text-[#B8A874]" style={SERIF}>
									{subValue(mode, opponentStats)}
								</span>
							)}
						</div>
					</div>

					{/* あなたの成績 */}
					<div className="w-full">
						<p className="mb-3 text-center text-sm font-semibold text-[#B8A874]" style={SERIF}>
							あなたの成績
						</p>
						<div className="grid w-full grid-cols-3 gap-3">
							{detailStats.map((stat) => (
								<div
									key={stat.label}
									className="flex flex-col items-center gap-2 rounded-lg border border-[#C9A961] bg-[#132D57] px-4 py-4"
								>
									<p className="text-sm font-medium text-[#B8A874]" style={SERIF}>
										{stat.label}
									</p>
									<span
										className="text-2xl font-extrabold text-[#E5C875] tabular-nums"
										style={MONO}
									>
										{stat.value}
									</span>
								</div>
							))}
						</div>
					</div>

					{/* ボタン群 */}
					<div className="flex w-full flex-col gap-3">
						<button
							onClick={onRematch}
							disabled={!decided}
							className="flex w-full items-center justify-center gap-2.5 rounded-lg border border-[#E5C875] bg-linear-to-r from-[#3A6BC8] to-[#1E3A6B] px-6 py-4 text-lg font-bold text-white shadow-md transition-transform hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-40"
							style={SERIF}
						>
							<RotateCcw className="h-[18px] w-[18px]" />
							もう一度対戦する
						</button>
						<button
							onClick={onGoHome}
							className="flex w-full items-center justify-center gap-2 rounded-lg border border-[#C9A961] bg-transparent px-6 py-3.5 text-[15px] font-semibold text-[#F5E9C8] transition-colors hover:bg-[#0F2952]"
							style={SERIF}
						>
							<House className="h-4 w-4 text-[#E5C875]" />
							メインメニューに戻る
						</button>
					</div>
				</div>
			</div>
		</div>
	);
}
