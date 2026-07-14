import { useEffect, useState } from 'react';
import { Head, router, usePage } from '@inertiajs/react';
import type { GameMode, RandomModeDifficulty, SharedProps } from '@/types';
import Header from '@/components/layout/Header';
import GameModeCard from '@/components/main-menu/GameModeCard';
import LoadingSpinner from '@/components/main-menu/LoadingSpinner';
import ErrorDisplay from '@/components/main-menu/ErrorDisplay';
import KarutaSlideshow from '@/components/main-menu/KarutaSlideshow';
import HowToPlayModal from '@/components/main-menu/HowToPlayModal';
import DifficultySelectModal from '@/components/main-menu/DifficultySelectModal';
import backgroundImage from '@/assets/images/background.webp';
import randomModeButton from '@/assets/images/random_mode_button.png';
import timeAttackButton from '@/assets/images/time_attack_button.png';

interface GameModeOption {
	id: GameMode;
	title: string;
	description: string;
	image: string;
}

// Game modes configuration - 2つのメインボタン
const gameModes: GameModeOption[] = [
	{
		id: 'random',
		title: 'ランダムモード',
		description: '全44札がランダムな順序で出題',
		image: randomModeButton
	},
	{
		id: 'timeattack',
		title: 'タイムアタック',
		description: '10枚の札を最速でタイピング',
		image: timeAttackButton
	}
];

export default function Home() {
	const { auth } = usePage().props as unknown as SharedProps;

	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [showHowToPlayModal, setShowHowToPlayModal] = useState(false);
	const [showDifficultyModal, setShowDifficultyModal] = useState(false);
	const [selectedMode, setSelectedMode] = useState<GameMode | null>(null);

	// 旧 onMount の initializeApp の忠実な移植（マウント後にローディングを解除する）
	/* eslint-disable react-hooks/set-state-in-effect */
	useEffect(() => {
		try {
			setIsLoading(false);
		} catch (err) {
			setError(err instanceof Error ? err.message : 'データの読み込みに失敗しました');
			setIsLoading(false);
		}
	}, []);
	/* eslint-enable react-hooks/set-state-in-effect */

	const navigateToGame = (mode: GameMode) => {
		const params = new URLSearchParams({ mode });
		router.visit(`/game?${params.toString()}`);
	};

	const handleModeSelect = (mode: GameMode) => {
		if (isLoading || error) return;

		if (mode === 'random' || mode === 'timeattack') {
			setSelectedMode(mode);
			setShowDifficultyModal(true);
		} else {
			navigateToGame(mode);
		}
	};

	const handleDifficultySelect = (difficulty: RandomModeDifficulty, gameMode: GameMode) => {
		// 難易度をパラメータに追加してゲーム画面へ遷移
		const params = new URLSearchParams({ mode: gameMode, difficulty });
		router.visit(`/game?${params.toString()}`);
	};

	return (
		<>
			<Head>
				<title>上毛かるたタイピング</title>
				<meta
					name="description"
					content="群馬の郷土かるたでタイピング練習。楽しみながら上毛かるたを覚えよう！"
				/>
			</Head>

			<div
				className="min-h-screen bg-cover bg-fixed bg-center"
				style={{ backgroundImage: `url(${backgroundImage})` }}
			>
				<Header user={auth?.user ?? null} />

				<main>
					<div className="container mx-auto max-w-6xl px-4 py-8">
						{/* Header */}
						<header className="mb-8 text-center">
							<img
								src="/images/game-title.png"
								alt="上毛かるたタイピング"
								className="mx-auto mb-6 h-auto w-full max-w-xl"
							/>
							{/* かるたスライドショー */}
							<KarutaSlideshow />
						</header>

						{/* Content */}
						{isLoading ? (
							<LoadingSpinner />
						) : error ? (
							<ErrorDisplay error={error} onretry={() => window.location.reload()} />
						) : (
							<>
								<div className="m-3 text-center text-xl text-gray-500">モード選択</div>

								{/* Game Modes */}
								<div
									data-testid="game-modes-container"
									className="mx-auto mb-12 grid max-w-3xl grid-cols-1 gap-6 sm:grid-cols-2"
								>
									{gameModes.map((mode) => (
										<GameModeCard
											key={mode.id}
											mode={mode.id}
											title={mode.title}
											description={mode.description}
											image={mode.image}
											disabled={isLoading || !!error}
											onclick={handleModeSelect}
										/>
									))}
								</div>

								{/* Navigation Links */}
								<nav className="flex justify-center gap-8">
									<button
										onClick={() => setShowHowToPlayModal(true)}
										className="flex items-center gap-2 text-gray-600 transition-colors hover:text-green-600"
										type="button"
									>
										<span className="text-xl">📖</span>
										<span>遊び方</span>
									</button>
									<a
										href="/ranking"
										onClick={(e) => {
											e.preventDefault();
											router.visit('/ranking');
										}}
										className="flex items-center gap-2 text-gray-600 transition-colors hover:text-green-600"
									>
										<span className="text-xl">🏆</span>
										<span>ランキング</span>
									</a>
									<a
										href="/settings"
										onClick={(e) => {
											e.preventDefault();
											router.visit('/settings');
										}}
										className="flex items-center gap-2 text-gray-600 transition-colors hover:text-green-600"
									>
										<span className="text-xl">⚙️</span>
										<span>設定</span>
									</a>
								</nav>
							</>
						)}
					</div>

					{/* 遊び方モーダル */}
					<HowToPlayModal
						isOpen={showHowToPlayModal}
						onclose={() => setShowHowToPlayModal(false)}
					/>

					{/* 難易度選択モーダル */}
					<DifficultySelectModal
						show={showDifficultyModal}
						onClose={() => {
							setShowDifficultyModal(false);
							setSelectedMode(null);
						}}
						onSelect={(difficulty: RandomModeDifficulty) => {
							if (selectedMode) handleDifficultySelect(difficulty, selectedMode);
						}}
					/>
				</main>
			</div>
		</>
	);
}
