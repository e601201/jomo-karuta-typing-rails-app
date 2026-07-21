import { useState } from 'react';
import { Head, Link, usePage } from '@inertiajs/react';
import { Gamepad2, History as HistoryIcon, Target, Timer, Trophy, Zap } from 'lucide-react';
import type { RandomModeDifficulty, SharedProps } from '@/types';
import Header from '@/components/layout/Header';
import { formatTime } from '@/lib/format-time';
import backgroundImage from '@/assets/images/background.webp';

const SERIF = { fontFamily: "'Noto Serif JP', serif" } as const;
const MONO = { fontFamily: "'JetBrains Mono', monospace" } as const;

type PlayMode = 'random' | 'timeattack';
type ModeFilter = 'all' | PlayMode;

interface HistoryRecord {
	id: number;
	game_mode: PlayMode;
	difficulty: RandomModeDifficulty;
	score: number | null;
	time_ms: number | null;
	accuracy: number;
	max_combo: number;
	created_at: string;
}

interface HistoryProps {
	summary: {
		totalPlays: number;
		bestScore: { score: number; difficulty: RandomModeDifficulty } | null;
		bestTime: { time_ms: number; difficulty: RandomModeDifficulty } | null;
		averageAccuracy: number | null;
	};
	records: HistoryRecord[];
	recentLimit: number;
}

// レベル色分けは design（rLZYe）準拠: 初心者=緑 / 標準=金 / 上級者=赤
const levelStyle: Record<RandomModeDifficulty, { label: string; color: string }> = {
	beginner: { label: '初心者', color: '#3FB56B' },
	standard: { label: '標準', color: '#E5C875' },
	advanced: { label: '上級者', color: '#C8302A' }
};

const modeMeta: Record<PlayMode, { label: string; Icon: typeof Zap }> = {
	random: { label: 'ランダム', Icon: Zap },
	timeattack: { label: 'タイムアタック', Icon: Timer }
};

const modeTabs = [
	{ value: 'all', label: 'すべて' },
	{ value: 'random', label: 'ランダム' },
	{ value: 'timeattack', label: 'タイムアタック' }
] as const;

function formatDate(iso: string): string {
	return new Date(iso).toLocaleString('ja-JP', {
		year: 'numeric',
		month: '2-digit',
		day: '2-digit',
		hour: '2-digit',
		minute: '2-digit'
	});
}

function LevelChip({ difficulty }: { difficulty: RandomModeDifficulty }) {
	const { label, color } = levelStyle[difficulty];
	return (
		<span
			className="inline-block rounded-full border px-2.5 py-0.5 text-xs font-bold"
			style={{ color, borderColor: color, backgroundColor: `${color}22` }}
		>
			{label}
		</span>
	);
}

function ModeChip({ mode }: { mode: PlayMode }) {
	const { label, Icon } = modeMeta[mode];
	return (
		<span className="inline-flex items-center gap-1.5 rounded-full border border-[#C9A961] bg-[#0A1A3599] px-2.5 py-0.5 text-xs font-semibold text-[#F5E9C8]">
			<Icon className="h-3.5 w-3.5 text-[#E5C875]" />
			{label}
		</span>
	);
}

function SummaryCard({
	Icon,
	label,
	value,
	sub
}: {
	Icon: typeof Trophy;
	label: string;
	value: string;
	sub?: React.ReactNode;
}) {
	return (
		<div className="flex flex-col items-center gap-2 rounded-xl border border-[#C9A961] bg-[#0A1A35CC] px-4 py-5 text-center shadow-[0_4px_16px_#00000066]">
			<span className="flex h-11 w-11 items-center justify-center rounded-full bg-[#C9A961]">
				<Icon className="h-6 w-6 text-[#0F2952]" />
			</span>
			<span className="text-sm font-medium text-[#C9A961]">{label}</span>
			<span className="text-2xl font-extrabold text-[#F5E9C8]" style={MONO}>
				{value}
			</span>
			{sub}
		</div>
	);
}

export default function History({ summary, records, recentLimit }: HistoryProps) {
	const { auth } = usePage().props as unknown as SharedProps;
	const [modeFilter, setModeFilter] = useState<ModeFilter>('all');

	const isEmpty = summary.totalPlays === 0;
	const visibleRecords =
		modeFilter === 'all' ? records : records.filter((r) => r.game_mode === modeFilter);
	const isTruncated = summary.totalPlays > records.length;

	return (
		<div
			className="min-h-screen bg-cover bg-fixed bg-center"
			style={{ backgroundImage: `url(${backgroundImage})`, ...SERIF }}
		>
			<Head title="プレイ履歴 - 上毛かるたタイピング" />

			<Header user={auth?.user ?? null} />

			<div className="flex flex-col items-center gap-6 px-4 pt-4 pb-12 sm:px-8">
				{/* ヒーロー */}
				<div className="flex items-center gap-4 rounded-xl border border-[#C9A961] bg-[#0A1A35CC] px-10 py-4 shadow-[0_4px_16px_#00000066]">
					<span className="flex h-14 w-14 items-center justify-center rounded-full bg-[#C9A961]">
						<HistoryIcon className="h-8 w-8 text-[#0F2952]" />
					</span>
					<h1
						className="text-4xl font-black text-white sm:text-5xl"
						style={{ textShadow: '0 2px 4px rgba(0,0,0,0.67)' }}
					>
						プレイ履歴
					</h1>
				</div>

				{isEmpty ? (
					/* 空状態（design に無いため専用。CTA はホームへ） */
					<div className="mt-6 flex w-full max-w-[560px] flex-col items-center gap-5 rounded-xl border-2 border-[#C9A961] bg-[#0A1A35DD] px-8 py-14 text-center">
						<Gamepad2 className="h-14 w-14 text-[#C9A961]" />
						<p className="text-xl font-bold text-[#F5E9C8]">まだプレイ記録がありません</p>
						<p className="text-[#B8A874]">ゲームを終えると、ここにプレイ履歴が残ります。</p>
						<Link
							href="/"
							className="mt-2 rounded-lg border border-[#E5C875] bg-linear-to-b from-[#E5C875] to-[#C9A961] px-8 py-3 text-base font-bold text-[#0F2952] transition-opacity hover:opacity-90"
						>
							ゲームを始める
						</Link>
					</div>
				) : (
					<>
						{/* サマリー4枚（常に全プレイ基準・タブに反応しない） */}
						<div className="grid w-full max-w-[900px] grid-cols-2 gap-4 sm:grid-cols-4">
							<SummaryCard
								Icon={Gamepad2}
								label="総プレイ回数"
								value={`${summary.totalPlays.toLocaleString()}回`}
							/>
							<SummaryCard
								Icon={Trophy}
								label="ベストスコア"
								value={summary.bestScore ? summary.bestScore.score.toLocaleString() : '—'}
								sub={
									summary.bestScore ? (
										<LevelChip difficulty={summary.bestScore.difficulty} />
									) : undefined
								}
							/>
							<SummaryCard
								Icon={Timer}
								label="ベストタイム"
								value={summary.bestTime ? `${formatTime(summary.bestTime.time_ms)}秒` : '—'}
								sub={
									summary.bestTime ? (
										<LevelChip difficulty={summary.bestTime.difficulty} />
									) : undefined
								}
							/>
							<SummaryCard
								Icon={Target}
								label="平均正確率"
								value={summary.averageAccuracy != null ? `${summary.averageAccuracy}%` : '—'}
							/>
						</div>

						{/* モードタブ（テーブルのみ絞り込み） */}
						<div className="flex gap-3 rounded-[10px] border border-[#C9A961] bg-[#0A1A3599] p-1.5">
							{modeTabs.map((tab) => {
								const active = modeFilter === tab.value;
								return (
									<button
										key={tab.value}
										type="button"
										onClick={() => setModeFilter(tab.value)}
										className={`rounded-lg px-5 py-2.5 text-sm transition-colors sm:px-7 ${
											active
												? 'bg-linear-to-b from-[#E5C875] to-[#C9A961] font-bold text-[#0F2952]'
												: 'font-semibold text-[#F5E9C8] hover:bg-[#132D57]'
										}`}
									>
										{tab.label}
									</button>
								);
							})}
						</div>

						{/* 履歴テーブル */}
						<div className="w-full max-w-[900px]">
							{isTruncated && (
								<p className="mb-2 text-right text-xs text-[#B8A874]">
									最近{recentLimit}件を表示中（全{summary.totalPlays.toLocaleString()}件）
								</p>
							)}
							<div className="overflow-x-auto rounded-xl border-2 border-[#C9A961] bg-[#0A1A35DD]">
								<table className="w-full min-w-[640px] border-collapse text-left">
									<thead>
										<tr className="bg-[#132D57] text-sm font-bold text-[#C9A961]">
											<th className="px-4 py-4 sm:px-6">日付</th>
											<th className="px-4 py-4">モード</th>
											<th className="px-4 py-4">レベル</th>
											<th className="px-4 py-4 text-right">スコア／タイム</th>
											<th className="px-4 py-4 text-right">正確率</th>
											<th className="px-4 py-4 text-right sm:px-6">最大コンボ</th>
										</tr>
									</thead>
									<tbody>
										{visibleRecords.length === 0 ? (
											<tr>
												<td colSpan={6} className="px-4 py-12 text-center text-[#B8A874]">
													このモードのプレイ記録はありません
												</td>
											</tr>
										) : (
											visibleRecords.map((record) => (
												<tr
													key={record.id}
													className="border-t border-[#1E3560] transition-colors hover:bg-[#132D57]/40"
												>
													<td
														className="px-4 py-4 text-sm whitespace-nowrap text-[#F5E9C8] sm:px-6"
														style={MONO}
													>
														{formatDate(record.created_at)}
													</td>
													<td className="px-4 py-4">
														<ModeChip mode={record.game_mode} />
													</td>
													<td className="px-4 py-4">
														<LevelChip difficulty={record.difficulty} />
													</td>
													<td
														className="px-4 py-4 text-right text-lg font-extrabold text-[#E5C875]"
														style={MONO}
													>
														{record.game_mode === 'timeattack'
															? record.time_ms != null
																? `${formatTime(record.time_ms)}秒`
																: '—'
															: record.score != null
																? record.score.toLocaleString()
																: '—'}
													</td>
													<td className="px-4 py-4 text-right text-[#F5E9C8]" style={MONO}>
														{record.accuracy}%
													</td>
													<td className="px-4 py-4 text-right text-[#F5E9C8] sm:px-6" style={MONO}>
														{record.max_combo}
													</td>
												</tr>
											))
										)}
									</tbody>
								</table>
							</div>
						</div>
					</>
				)}
			</div>
		</div>
	);
}
