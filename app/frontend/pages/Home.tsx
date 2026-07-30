import { useEffect, useState } from 'react';
import { Head, router, usePage } from '@inertiajs/react';
import { Dices, Timer } from 'lucide-react';
import type { GameMode, RandomModeDifficulty, SharedProps } from '@/types';
import type { BattleMode } from '@/types/battle';
import Header from '@/components/layout/Header';
import GameModeCard from '@/components/main-menu/GameModeCard';
import LoadingSpinner from '@/components/main-menu/LoadingSpinner';
import ErrorDisplay from '@/components/main-menu/ErrorDisplay';
import KarutaSlideshow from '@/components/main-menu/KarutaSlideshow';
import DifficultySelectModal from '@/components/main-menu/DifficultySelectModal';
import BattleEntryModal from '@/components/battle/BattleEntryModal';
import PassphraseModal from '@/components/battle/PassphraseModal';
import MatchingModal from '@/components/battle/MatchingModal';
import { battleStore, useBattleStore } from '@/stores/battle-store';
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

// 対戦モードの入口（合言葉マッチング。ログイン必須）
const battleModes: { id: BattleMode; title: string; icon: typeof Dices }[] = [
	{ id: 'random', title: 'ランダムモード対戦', icon: Dices },
	{ id: 'timeattack', title: 'タイムアタック対戦', icon: Timer }
];

export default function Home() {
	const { auth } = usePage().props as unknown as SharedProps;

	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [showDifficultyModal, setShowDifficultyModal] = useState(false);
	const [selectedMode, setSelectedMode] = useState<GameMode | null>(null);

	// 対戦モードの導線（入口モーダル → 合言葉フォーム → マッチング待機）
	const [battleMode, setBattleMode] = useState<BattleMode | null>(null);
	const [battleStep, setBattleStep] = useState<'entry' | 'passphrase' | null>(null);
	const battlePhase = useBattleStore((s) => s.phase);
	const battlePassphrase = useBattleStore((s) => s.passphrase);
	const matchingError = useBattleStore((s) => s.matchingError);

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

	const handleBattleSelect = (mode: BattleMode) => {
		if (isLoading || error) return;

		// 対戦はログイン必須。未ログインはログイン画面へ誘導する
		if (!auth?.user) {
			router.visit('/auth/login');
			return;
		}
		setBattleMode(mode);
		setBattleStep('entry');
	};

	const handlePassphraseSubmit = (passphrase: string) => {
		if (!battleMode || !auth?.user) return;
		// 失敗時は phase が idle に戻り matchingError が入るため、合言葉フォームを開いたままにする
		void battleStore.startMatching(battleMode, passphrase, auth.user.id);
	};

	const closeBattleFlow = () => {
		setBattleMode(null);
		setBattleStep(null);
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

								{/* 対戦モード（合言葉マッチング） */}
								<div
									data-testid="battle-modes-container"
									className="mx-auto mb-12 grid max-w-3xl grid-cols-1 gap-4 sm:grid-cols-2"
								>
									{battleModes.map((mode) => (
										<button
											key={mode.id}
											onClick={() => handleBattleSelect(mode.id)}
											className="flex items-center justify-center gap-3 rounded-[10px] border-2 border-[#C9A961] bg-[#0F2145]/90 px-6 py-4 text-lg font-bold text-[#E5C875] shadow-[0_4px_16px_rgba(0,0,0,0.35)] transition-colors hover:bg-[#1A3868]"
											style={{ fontFamily: "'Noto Serif JP', serif" }}
										>
											<mode.icon className="h-5 w-5" />
											{mode.title}
										</button>
									))}
									{!auth?.user && (
										<p className="col-span-full text-center text-sm text-black/90">
											※ 対戦モードのご利用にはログインが必要です
										</p>
									)}
								</div>
							</>
						)}
					</div>

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

					{/* 対戦モードの導線モーダル */}
					<BattleEntryModal
						show={battleStep === 'entry'}
						onClose={closeBattleFlow}
						onSelect={() => setBattleStep('passphrase')}
					/>
					<PassphraseModal
						show={battleStep === 'passphrase' && battlePhase !== 'matching'}
						onClose={() => setBattleStep('entry')}
						onSubmit={handlePassphraseSubmit}
						error={matchingError}
					/>
					<MatchingModal
						show={battlePhase === 'matching'}
						passphrase={battlePassphrase ?? ''}
						onCancel={() => {
							void battleStore.cancelMatching();
							closeBattleFlow();
						}}
					/>
				</main>
			</div>
		</>
	);
}
