import { useState } from 'react';
import { Head, router, usePage } from '@inertiajs/react';
import { Award, BookOpen, Leaf, Medal, Timer, Trophy, User, Zap } from 'lucide-react';
import type { RandomModeDifficulty, SharedProps } from '@/types';
import Header from '@/components/layout/Header';
import backgroundImage from '@/assets/images/background.webp';

const SERIF = { fontFamily: "'Noto Serif JP', serif" } as const;
const MONO = { fontFamily: "'JetBrains Mono', monospace" } as const;

type GameModeType = 'random' | 'timeattack';

interface RankingEntry {
	id: number;
	nick_name: string;
	score?: number | null;
	time_ms?: number | null;
	created_at: string;
	difficulty?: RandomModeDifficulty;
	game_mode?: string | null;
}

interface RankingProps {
	gameMode: GameModeType;
	difficulty: RandomModeDifficulty;
	entries: RankingEntry[];
}

const modeTabs = [
	{ value: 'random', label: 'ランダムモード', icon: Zap },
	{ value: 'timeattack', label: 'タイムアタック', icon: Timer }
] as const;

const levelTabs = [
	{ value: 'beginner', label: '初心者', icon: Leaf },
	{ value: 'standard', label: '標準', icon: BookOpen },
	{ value: 'advanced', label: '上級者', icon: Zap }
] as const;

function formatTime(ms: number): string {
	const seconds = Math.floor(ms / 1000);
	const milliseconds = Math.floor((ms % 1000) / 10);
	return `${seconds}.${milliseconds.toString().padStart(2, '0')}`;
}

// 順位に応じたメダル（金/銀/銅、4位以降は紺のユーザーアイコン）
function getMedal(rank: number): { bg: string; Icon: typeof Trophy; iconColor: string } {
	if (rank === 1) return { bg: '#E5C875', Icon: Trophy, iconColor: '#0F2952' };
	if (rank === 2) return { bg: '#B8B4A0', Icon: Medal, iconColor: '#0F2952' };
	if (rank === 3) return { bg: '#C7834E', Icon: Award, iconColor: '#0F2952' };
	return { bg: '#0F2952', Icon: User, iconColor: '#E5C875' };
}

export default function Ranking({ gameMode, difficulty, entries }: RankingProps) {
	const { auth } = usePage().props as unknown as SharedProps;
	const [selectedGameMode, setSelectedGameMode] = useState<GameModeType>(gameMode);
	const [selectedDifficulty, setSelectedDifficulty] = useState<RandomModeDifficulty>(difficulty);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const rankings = entries;

	const loadRankings = (mode: GameModeType, diff: RandomModeDifficulty) => {
		router.get(
			'/ranking',
			{ game_mode: mode, difficulty: diff },
			{
				only: ['entries'],
				preserveState: true,
				preserveScroll: true,
				replace: true,
				onStart: () => {
					setLoading(true);
					setError(null);
				},
				onError: () => {
					setError('ランキングの読み込みに失敗しました');
				},
				onFinish: () => {
					setLoading(false);
				}
			}
		);
	};

	const handleDifficultyChange = (diff: RandomModeDifficulty) => {
		setSelectedDifficulty(diff);
		loadRankings(selectedGameMode, diff);
	};

	const handleGameModeChange = (mode: GameModeType) => {
		setSelectedGameMode(mode);
		loadRankings(mode, selectedDifficulty);
	};

	const modeLabel = selectedGameMode === 'timeattack' ? 'タイムアタック' : 'ランダムモード';
	const scoreHeader = selectedGameMode === 'timeattack' ? 'タイム' : 'スコア';

	return (
		<div
			className="min-h-screen bg-cover bg-fixed bg-center"
			style={{ backgroundImage: `url(${backgroundImage})`, ...SERIF }}
		>
			<Head title="ランキング - 上毛かるたタイピング" />

			<Header user={auth?.user ?? null} />

			<div className="flex flex-col items-center gap-6 px-4 pt-4 pb-12 sm:px-8">
				{/* ヒーロー */}
				<div className="flex flex-col items-center gap-2 rounded-xl border border-[#C9A961] bg-[#0A1A35CC] px-10 py-4 shadow-[0_4px_16px_#00000066]">
					<div className="flex items-center gap-4">
						<span className="flex h-14 w-14 items-center justify-center rounded-full bg-[#C9A961]">
							<Trophy className="h-8 w-8 text-[#0F2952]" />
						</span>
						<h1
							className="text-4xl font-black text-white sm:text-5xl"
							style={{ textShadow: '0 2px 4px rgba(0,0,0,0.67)' }}
						>
							ランキング
						</h1>
					</div>
					<p className="text-base font-medium text-[#F5E9C8]">{modeLabel} TOP100</p>
				</div>

				{/* モードタブ */}
				<div className="flex gap-3 rounded-[10px] border border-[#C9A961] bg-[#0A1A3599] p-1.5">
					{modeTabs.map((tab) => {
						const active = selectedGameMode === tab.value;
						const Icon = tab.icon;
						return (
							<button
								key={tab.value}
								type="button"
								onClick={() => handleGameModeChange(tab.value)}
								className={`flex items-center gap-2 rounded-lg px-6 py-3 text-[15px] transition-colors sm:px-7 ${
									active
										? 'bg-linear-to-b from-[#E5C875] to-[#C9A961] font-bold text-[#0F2952]'
										: 'font-semibold text-[#F5E9C8] hover:bg-[#132D57]'
								}`}
							>
								<Icon className={`h-4 w-4 ${active ? 'text-[#0F2952]' : 'text-[#E5C875]'}`} />
								{tab.label}
							</button>
						);
					})}
				</div>

				{/* 難易度タブ */}
				<div className="flex flex-wrap justify-center gap-2">
					{levelTabs.map((tab) => {
						const active = selectedDifficulty === tab.value;
						const Icon = tab.icon;
						return (
							<button
								key={tab.value}
								type="button"
								onClick={() => handleDifficultyChange(tab.value)}
								className={`flex items-center gap-2 rounded-lg border px-5 py-2.5 text-sm transition-colors ${
									active
										? 'border-[#E5C875] bg-[#C8302A] font-bold text-[#F5E9C8]'
										: 'border-[#C9A961] bg-[#0A1A3599] font-semibold text-[#F5E9C8] hover:bg-[#132D57]'
								}`}
							>
								<Icon className={`h-3.5 w-3.5 ${active ? 'text-[#F5E9C8]' : 'text-[#E5C875]'}`} />
								{tab.label}
							</button>
						);
					})}
				</div>

				{/* ランキングテーブル */}
				<div className="w-full max-w-[900px]">
					{loading ? (
						<div className="rounded-xl border-2 border-[#C9A961] bg-[#0A1A35DD] py-16 text-center">
							<div className="mx-auto h-12 w-12 animate-spin rounded-full border-b-2 border-[#E5C875]" />
							<p className="mt-4 text-[#F5E9C8]">読み込み中...</p>
						</div>
					) : error ? (
						<div className="rounded-xl border-2 border-[#C8302A] bg-[#0A1A35DD] p-8 text-center">
							<p className="text-[#FF8A84]">{error}</p>
							<button
								type="button"
								onClick={() => loadRankings(selectedGameMode, selectedDifficulty)}
								className="mt-4 rounded-lg border border-[#E5C875] bg-[#C8302A] px-5 py-2.5 text-sm font-bold text-white transition-opacity hover:opacity-90"
							>
								再読み込み
							</button>
						</div>
					) : rankings.length === 0 ? (
						<div className="rounded-xl border-2 border-[#C9A961] bg-[#0A1A35DD] p-12 text-center">
							<p className="mb-3 text-xl font-bold text-[#F5E9C8]">
								{modeLabel}のランキングデータがありません
							</p>
							<p className="text-[#B8A874]">最初の挑戦者になりましょう！</p>
						</div>
					) : (
						<div className="overflow-hidden rounded-xl border-2 border-[#C9A961] bg-[#0A1A35DD]">
							{/* テーブルヘッダー */}
							<div className="flex items-center bg-[#132D57] px-4 py-4 sm:px-8">
								<span className="w-[104px] text-sm font-bold text-[#C9A961] sm:w-[120px]">順位</span>
								<span className="flex-1 text-sm font-bold text-[#C9A961]">プレイヤー</span>
								<span className="w-[120px] text-right text-sm font-bold text-[#C9A961] sm:w-[160px]">
									{scoreHeader}
								</span>
							</div>

							{/* 行 */}
							{rankings.map((entry, index) => {
								const rank = index + 1;
								const { bg, Icon, iconColor } = getMedal(rank);
								const isTop3 = rank <= 3;
								return (
									<div
										key={entry.id}
										className="flex items-center border-t border-[#1E3560] px-4 py-4 transition-colors hover:bg-[#132D57]/40 sm:px-8"
									>
										<div className="flex w-[104px] items-center gap-3 sm:w-[120px]">
											<span
												className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
												style={{ backgroundColor: bg }}
											>
												<Icon className="h-5 w-5" style={{ color: iconColor }} />
											</span>
											<span className="text-lg font-extrabold text-[#F5E9C8]" style={MONO}>
												{rank}
											</span>
										</div>
										<span className="min-w-0 flex-1 truncate pr-3 text-base font-semibold text-[#F5E9C8]">
											{entry.nick_name || '名無しの挑戦者'}
										</span>
										<span
											className={`w-[120px] text-right text-[22px] font-extrabold sm:w-[160px] ${
												isTop3 ? 'text-[#E5C875]' : 'text-[#F5E9C8]'
											}`}
											style={MONO}
										>
											{selectedGameMode === 'timeattack'
												? entry.time_ms
													? `${formatTime(entry.time_ms)}秒`
													: '-'
												: entry.score
													? entry.score.toLocaleString()
													: '-'}
										</span>
									</div>
								);
							})}
						</div>
					)}
				</div>
			</div>
		</div>
	);
}
