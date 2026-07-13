import { useState } from 'react';
import { Head, router } from '@inertiajs/react';
import { ArrowLeft, Trophy, Medal, Award, Timer, Zap } from 'lucide-react';
import type { RandomModeDifficulty } from '@/types';

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

function formatTime(ms: number): string {
	const seconds = Math.floor(ms / 1000);
	const milliseconds = Math.floor((ms % 1000) / 10);
	return `${seconds}.${milliseconds.toString().padStart(2, '0')}`;
}

function getRankIcon(rank: number) {
	if (rank === 1) return Trophy;
	if (rank === 2) return Medal;
	if (rank === 3) return Award;
	return null;
}

function getRankClass(rank: number): string {
	if (rank === 1) return 'bg-gradient-to-r from-yellow-400 to-yellow-500 text-white';
	if (rank === 2) return 'bg-gradient-to-r from-gray-300 to-gray-400 text-white';
	if (rank === 3) return 'bg-gradient-to-r from-orange-400 to-orange-500 text-white';
	return 'bg-gray-100';
}

export default function Ranking({ gameMode, difficulty, entries }: RankingProps) {
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

	return (
		<div className="min-h-screen bg-linear-to-b from-gray-50 to-white">
			<Head title="ランキング - 上毛かるたタイピング" />
			<div className="container mx-auto px-4 py-8">
				{/* ヘッダー */}
				<div className="mb-8 flex items-center justify-between">
					<button
						onClick={() => router.visit('/')}
						className="flex items-center gap-2 rounded-lg px-4 py-2 text-gray-700 transition-colors hover:bg-gray-100"
						type="button"
					>
						<ArrowLeft className="h-4 w-4" />
						メニューに戻る
					</button>
				</div>

				{/* タイトル */}
				<div className="mb-8 text-center">
					<h1 className="mb-2 flex items-center justify-center gap-3 text-4xl font-bold text-gray-800">
						<Trophy className="h-10 w-10 text-yellow-500" />
						ランキング
					</h1>
					<p className="text-gray-600">
						{selectedGameMode === 'timeattack' ? 'タイムアタック' : 'ランダムモード'} TOP100
					</p>
				</div>

				{/* ゲームモード切り替え */}
				<div className="mb-4 flex justify-center">
					<div className="inline-flex overflow-hidden rounded-lg border border-gray-300 bg-white shadow-sm">
						<button
							onClick={() => handleGameModeChange('random')}
							className={`flex items-center gap-2 px-6 py-3 font-medium transition-colors ${
								selectedGameMode === 'random'
									? 'bg-linear-to-r from-blue-500 to-purple-500 text-white'
									: 'text-gray-700 hover:bg-gray-50'
							}`}
							type="button"
						>
							<Zap className="h-4 w-4" />
							ランダムモード
						</button>
						<button
							onClick={() => handleGameModeChange('timeattack')}
							className={`flex items-center gap-2 border-l border-gray-300 px-6 py-3 font-medium transition-colors ${
								selectedGameMode === 'timeattack'
									? 'bg-linear-to-r from-orange-500 to-red-500 text-white'
									: 'text-gray-700 hover:bg-gray-50'
							}`}
							type="button"
						>
							<Timer className="h-4 w-4" />
							タイムアタック
						</button>
					</div>
				</div>

				{/* 難易度タブ */}
				<div className="mb-6 flex justify-center">
					<div className="inline-flex overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
						<button
							onClick={() => handleDifficultyChange('beginner')}
							className={`border-l border-gray-200 px-6 py-3 font-medium transition-colors ${
								selectedDifficulty === 'beginner'
									? 'bg-green-500 text-white'
									: 'text-gray-700 hover:bg-gray-50'
							}`}
							type="button"
						>
							🔰 初心者
						</button>
						<button
							onClick={() => handleDifficultyChange('standard')}
							className={`border-l border-gray-200 px-6 py-3 font-medium transition-colors ${
								selectedDifficulty === 'standard'
									? 'bg-blue-500 text-white'
									: 'text-gray-700 hover:bg-gray-50'
							}`}
							type="button"
						>
							📖 標準
						</button>
						<button
							onClick={() => handleDifficultyChange('advanced')}
							className={`border-l border-gray-200 px-6 py-3 font-medium transition-colors ${
								selectedDifficulty === 'advanced'
									? 'bg-red-500 text-white'
									: 'text-gray-700 hover:bg-gray-50'
							}`}
							type="button"
						>
							⚡ 上級者
						</button>
					</div>
				</div>

				{/* ランキングテーブル */}
				<div className="mx-auto max-w-4xl">
					{loading ? (
						<div className="py-12 text-center">
							<div className="inline-block h-12 w-12 animate-spin rounded-full border-b-2 border-gray-600"></div>
							<p className="mt-4 text-gray-600">読み込み中...</p>
						</div>
					) : error ? (
						<div className="rounded-lg border border-red-200 bg-red-50 p-6 text-center">
							<p className="text-red-600">{error}</p>
							<button
								onClick={() => loadRankings(selectedGameMode, selectedDifficulty)}
								className="mt-4 rounded-lg bg-red-500 px-4 py-2 text-white transition-colors hover:bg-red-600"
								type="button"
							>
								再読み込み
							</button>
						</div>
					) : rankings.length === 0 ? (
						<div className="rounded-lg border border-gray-200 bg-white p-12 text-center shadow-sm">
							<p className="mb-4 text-xl text-gray-800">
								{selectedDifficulty === 'beginner'
									? '初心者モードのランキングデータがありません'
									: selectedDifficulty === 'standard'
										? '標準モードのランキングデータがありません'
										: selectedDifficulty === 'advanced'
											? '上級者モードのランキングデータがありません'
											: 'ランキングデータがありません'}
							</p>
							<p className="text-gray-600">最初の挑戦者になりましょう！</p>
						</div>
					) : (
						<div className="overflow-hidden rounded-lg bg-white shadow-lg">
							<div className="overflow-x-auto">
								<table className="w-full">
									<thead className="border-b border-gray-200 bg-gray-50">
										<tr>
											<th className="px-6 py-4 text-left font-semibold text-gray-700">順位</th>
											<th className="px-6 py-4 text-left font-semibold text-gray-700">
												プレイヤー
											</th>
											<th className="px-6 py-4 text-right font-semibold text-gray-700">
												{selectedGameMode === 'timeattack' ? 'タイム' : 'スコア'}
											</th>
										</tr>
									</thead>
									<tbody>
										{rankings.map((entry, index) => {
											const rank = index + 1;
											const Icon = getRankIcon(rank);
											return (
												<tr
													key={entry.id}
													className="border-b border-gray-100 transition-colors hover:bg-gray-50"
												>
													<td className="px-6 py-4">
														<div className="flex items-center gap-2">
															{Icon ? (
																<div
																	className={`inline-flex h-8 w-8 items-center justify-center rounded-full ${getRankClass(rank)}`}
																>
																	<Icon className="h-4 w-4" />
																</div>
															) : (
																<div className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-gray-700">
																	{rank}
																</div>
															)}
														</div>
													</td>
													<td className="px-6 py-4 font-medium text-gray-800">
														{entry.nick_name || '名無しの挑戦者'}
													</td>
													<td className="px-6 py-4 text-right">
														{selectedGameMode === 'timeattack' ? (
															<span
																className={
																	rank <= 3
																		? 'bg-linear-to-r from-yellow-500 to-orange-500 bg-clip-text text-2xl font-bold text-transparent'
																		: 'text-xl font-bold text-gray-700'
																}
															>
																{entry.time_ms ? `${formatTime(entry.time_ms)}秒` : '-'}
															</span>
														) : (
															<span
																className={
																	rank <= 3
																		? 'bg-linear-to-r from-yellow-500 to-orange-500 bg-clip-text text-2xl font-bold text-transparent'
																		: 'text-xl font-bold text-gray-700'
																}
															>
																{entry.score ? entry.score.toLocaleString() : '-'}
															</span>
														)}
													</td>
												</tr>
											);
										})}
									</tbody>
								</table>
							</div>
						</div>
					)}
				</div>
			</div>
		</div>
	);
}
