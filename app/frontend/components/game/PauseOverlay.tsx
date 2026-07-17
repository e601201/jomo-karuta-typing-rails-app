import { useEffect, useRef, useState } from 'react';
import { Play, Settings, X } from 'lucide-react';

// デザインカンプ（design.pen）準拠のフォント指定
const SERIF = { fontFamily: "'Noto Serif JP', serif" } as const;
const MONO = { fontFamily: "'JetBrains Mono', monospace" } as const;

interface GameStats {
	currentCard: number;
	totalCards: number;
	elapsedTime: number;
	pauseCount: number;
	score: number;
	accuracy: number;
}

interface Props {
	isPaused: boolean;
	gameStats: GameStats;
	onResume: (options?: { skipCountdown?: boolean }) => void;
	onExit: () => void;
	onSettings?: () => void;
	showCountdown?: boolean;
	countdownDuration?: number;
	isCountingDown?: boolean;
}

// Format time to mm:ss
function formatTime(ms: number): string {
	const totalSeconds = Math.floor(ms / 1000);
	const minutes = Math.floor(totalSeconds / 60);
	const seconds = totalSeconds % 60;
	return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

export default function PauseOverlay({
	isPaused,
	gameStats,
	onResume,
	onExit,
	onSettings,
	showCountdown = true,
	countdownDuration = 3,
	isCountingDown = false
}: Props) {
	const [showExitConfirm, setShowExitConfirm] = useState(false);
	const [countdown, setCountdown] = useState(0);
	const [isRunningCountdown, setIsRunningCountdown] = useState(false);
	const countdownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

	// 再開カウントダウン中のタイマーから常に最新の onResume を呼べるようにする
	const onResumeRef = useRef(onResume);
	useEffect(() => {
		onResumeRef.current = onResume;
	}, [onResume]);

	// Stop countdown
	function stopCountdown() {
		if (countdownIntervalRef.current) {
			clearInterval(countdownIntervalRef.current);
			countdownIntervalRef.current = null;
		}
		setIsRunningCountdown(false);
		setCountdown(0);
	}

	// Start countdown
	function startCountdown() {
		setIsRunningCountdown(true);
		let current = countdownDuration;
		setCountdown(current);

		countdownIntervalRef.current = setInterval(() => {
			current--;
			setCountdown(current);
			if (current <= 0) {
				stopCountdown();
				onResumeRef.current();
			}
		}, 1000);
	}

	// Handle resume with countdown
	function handleResume() {
		if (showCountdown && !isCountingDown) {
			startCountdown();
		} else {
			onResume();
		}
	}

	// Skip countdown
	function skipCountdown() {
		if (isRunningCountdown) {
			stopCountdown();
			onResume({ skipCountdown: true });
		}
	}

	// Handle exit confirmation
	function handleExit() {
		setShowExitConfirm(true);
	}

	function confirmExit() {
		setShowExitConfirm(false);
		onExit();
	}

	function cancelExit() {
		setShowExitConfirm(false);
	}

	// Keyboard event handler
	// 依存配列なしで毎レンダー再登録することで、ハンドラが常に最新の状態を参照する
	// （旧実装は onMount 登録 + Svelte のリアクティブなクロージャで同等の挙動）
	useEffect(() => {
		function handleKeyDown(event: KeyboardEvent) {
			if (!isPaused) return;

			if (event.key === 'Escape' && !isRunningCountdown && !showExitConfirm) {
				handleResume();
			} else if (event.key === ' ' && isRunningCountdown) {
				event.preventDefault();
				skipCountdown();
			}
		}

		document.addEventListener('keydown', handleKeyDown);
		return () => document.removeEventListener('keydown', handleKeyDown);
	});

	// アンマウント時にカウントダウンを停止（旧実装の onDestroy 相当）
	useEffect(() => {
		return () => {
			if (countdownIntervalRef.current) {
				clearInterval(countdownIntervalRef.current);
				countdownIntervalRef.current = null;
			}
		};
	}, []);

	if (!isPaused) {
		return null;
	}

	// 統計カード（羊皮紙調のネイビーボックス）
	const statBox = (label: string, value: string) => (
		<div className="rounded-lg border border-[#C9A961] bg-[#132D57] p-3 text-center">
			<p className="text-sm text-[#B8A874]" style={SERIF}>
				{label}
			</p>
			<p className="text-xl font-bold text-[#F5E9C8] tabular-nums" style={SERIF}>
				{value}
			</p>
		</div>
	);

	return (
		<div
			data-testid="pause-overlay"
			className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm transition-opacity duration-300"
			aria-hidden="false"
		>
			<div
				data-testid="pause-modal"
				role="dialog"
				aria-labelledby="pause-title"
				aria-modal="true"
				className="mx-4 h-full w-full max-w-lg scale-100 rounded-2xl border-2 border-[#C9A961] bg-[#0A1A35] p-8 shadow-2xl transition-all duration-300 md:h-auto md:w-auto"
			>
				{/* Title */}
				<h2
					id="pause-title"
					className="mb-6 text-center text-3xl font-bold text-[#E5C875]"
					style={SERIF}
				>
					一時停止中
				</h2>

				{/* Countdown Display */}
				{isRunningCountdown ? (
					<div data-testid="countdown-display" className="mb-8 text-center">
						<div
							className="animate-pulse text-6xl font-extrabold text-[#E5C875] tabular-nums"
							style={MONO}
						>
							{countdown}
						</div>
						<p className="mt-2 text-sm text-[#B8A874]" style={SERIF}>
							スペースキーでスキップ
						</p>
					</div>
				) : !showExitConfirm ? (
					<>
						{/* Game Stats */}
						<div className="mb-8 space-y-4">
							<div className="grid grid-cols-2 gap-4">
								{statBox('進捗', `${gameStats.currentCard}/${gameStats.totalCards}枚完了`)}
								{statBox('経過時間', formatTime(gameStats.elapsedTime))}
							</div>

							<div className="grid grid-cols-2 gap-4">
								{statBox('スコア', `スコア: ${gameStats.score}`)}
								{statBox('正確率', `正確率: ${gameStats.accuracy.toFixed(2)}%`)}
							</div>

							<div className="rounded-lg border border-[#C9A961] bg-[#132D57] p-3 text-center">
								<p className="text-sm text-[#B8A874]" style={SERIF}>
									一時停止回数: {gameStats.pauseCount}回
								</p>
							</div>
						</div>

						{/* Action Buttons */}
						<div className="flex flex-col gap-3">
							<button
								onClick={handleResume}
								className="flex w-full items-center justify-center gap-2.5 rounded-lg border border-[#E5C875] bg-[#D4A017] px-6 py-3 text-lg font-bold text-white transition-colors hover:bg-[#BE8F14]"
								style={SERIF}
							>
								<Play className="h-5 w-5" />
								再開
							</button>

							{onSettings && (
								<button
									onClick={onSettings}
									className="flex w-full items-center justify-center gap-2.5 rounded-lg border border-[#5A6472] bg-[#3A4552] px-6 py-3 font-semibold text-white transition-colors hover:bg-[#4A5562]"
									style={SERIF}
								>
									<Settings className="h-5 w-5" />
									設定
								</button>
							)}

							<button
								onClick={handleExit}
								className="flex w-full items-center justify-center gap-2.5 rounded-lg border border-[#E5453D] bg-[#C8302A] px-6 py-3 font-semibold text-white transition-colors hover:bg-[#A8261F]"
								style={SERIF}
							>
								<X className="h-5 w-5" />
								終了
							</button>
						</div>

						<p className="mt-4 text-center text-sm text-[#B8A874]" style={SERIF}>
							ESCキーで再開
						</p>
					</>
				) : null}

				{/* Exit Confirmation Dialog */}
				{showExitConfirm && (
					<div className="text-center">
						<h3 className="mb-6 text-xl font-bold text-[#F5E9C8]" style={SERIF}>
							本当に終了しますか？
						</h3>
						<div className="flex justify-center gap-4">
							<button
								onClick={confirmExit}
								className="rounded-lg border border-[#E5453D] bg-[#C8302A] px-8 py-2.5 font-semibold text-white transition-colors hover:bg-[#A8261F]"
								style={SERIF}
							>
								はい
							</button>
							<button
								onClick={cancelExit}
								className="rounded-lg border border-[#5A6472] bg-[#3A4552] px-8 py-2.5 font-semibold text-white transition-colors hover:bg-[#4A5562]"
								style={SERIF}
							>
								いいえ
							</button>
						</div>
					</div>
				)}
			</div>
		</div>
	);
}
