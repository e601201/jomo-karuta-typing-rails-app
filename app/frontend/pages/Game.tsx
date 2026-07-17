import { useEffect, useMemo, useRef, useState } from 'react';
import { Head, router } from '@inertiajs/react';
import type { GameMode, RandomModeDifficulty } from '@/types';
import { gameStore, useGameStore, type GameScore } from '@/stores/game-store';
import { InputValidator } from '@/lib/typing/input-validator';
import { TypingSoundManager } from '@/lib/audio/typing-sounds';
import { resolveGameParams } from '@/features/game/resolve-game-params';
import { parseHiraganaUnits } from '@/features/game/hiragana-units';
import {
	matchHiraganaProgress,
	buildInputStatesAfterInput,
	buildInputStatesAfterBackspace,
	buildInputStatesOnError,
	buildRomajiStates,
	buildRomajiStatesOnError,
	type InputCharState,
	type RomajiCharState
} from '@/features/game/input-states';
import { buildDefaultRomajiGuide, buildDynamicRomajiGuide } from '@/features/game/romaji-guide';
import { TIMEATTACK_MISTAKE_PENALTY_MS } from '@/features/game/timeattack';
import CardDisplay from '@/components/game/CardDisplay';
import InputHighlight from '@/components/game/InputHighlight';
import PauseOverlay from '@/components/game/PauseOverlay';
import Countdown from '@/components/game/Countdown';
import TimeAttackTimer from '@/components/game/TimeAttackTimer';
import TimeAttackProgress from '@/components/game/TimeAttackProgress';
import RankingRegistrationModal from '@/components/ranking/RankingRegistrationModal';
import {
	Timer,
	Pause,
	Play,
	SkipForward,
	X,
	Trophy,
	Megaphone,
	RotateCcw,
	House
} from 'lucide-react';
import backgroundImage from '@/assets/images/background.webp';

// デザインカンプ（design.pen）準拠のフォント指定
const SERIF = { fontFamily: "'Noto Serif JP', serif" } as const;
const MONO = { fontFamily: "'JetBrains Mono', monospace" } as const;

interface GameProps {
	mode?: string | null;
	difficulty?: string | null;
}

/**
 * ゲーム画面（旧 SvelteKit routes/game/+page.svelte の移植）。
 * タイピング判定・ガイド生成のロジックは features/game/ の純関数群に
 * 抽出済みで、このコンポーネントは配線のみを持つ。
 */
export default function Game(props: GameProps) {
	// URL パラメータ契約（検証・札解決）はクライアント側の純関数が担う
	const data = useMemo(
		() =>
			resolveGameParams({
				mode: props.mode,
				difficulty: props.difficulty
			}),
		[props.mode, props.difficulty]
	);

	// ストアからのゲーム状態
	const currentCard = useGameStore((s) => s.cards.current);
	const cardIndex = useGameStore((s) => s.cards.currentIndex);
	const completedCardsCount = useGameStore((s) => s.cards.completed.length);
	const score: GameScore = useGameStore((s) => s.score);
	const isPaused = useGameStore((s) => s.timer.isPaused);
	const elapsedTime = useGameStore((s) => s.timer.elapsedTime);
	const pauseCount = useGameStore((s) => s.timer.pauseCount || 0);
	const currentInput = useGameStore((s) => s.input.current);
	const remainingTime = useGameStore((s) => s.timer.remainingTime);
	const hasTimeLimit = useGameStore((s) => s.timer.timeLimit !== null);
	const wasSkipped = useGameStore((s) => s.cards.wasSkipped || false);
	const sessionDifficulty = useGameStore((s) => s.session?.difficulty);
	const sessionIsActive = useGameStore((s) => s.session?.isActive);
	const sessionEndTime = useGameStore((s) => s.session?.endTime);
	const sessionIsManualExit = useGameStore((s) => s.session?.isManualExit);
	const sessionTotalCards = useGameStore((s) => s.session?.totalCards);

	// タイムアタックモード用の状態
	const timeAttackElapsedTime = useGameStore((s) => s.timer.elapsedTime);
	const timeAttackPenalty = useGameStore((s) => s.timer.penalty || 0);
	const timeAttackMistakes = useGameStore((s) => s.statistics.mistakes);
	const timeAttackSkips = useGameStore((s) => s.statistics.skips || 0);
	const timeAttackFinalTime = timeAttackElapsedTime + timeAttackPenalty;

	// ページローカル状態
	const [gameMode, setGameMode] = useState<GameMode | null>(null);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [showExitConfirm, setShowExitConfirm] = useState(false);
	const [isGameComplete, setIsGameComplete] = useState(false);
	const [showCountdown, setShowCountdown] = useState(false);
	const [gameStarted, setGameStarted] = useState(false);
	const [showRankingModal, setShowRankingModal] = useState(false);
	const [isRankingRegistered, setIsRankingRegistered] = useState(false);
	const [currentDifficulty, setCurrentDifficulty] = useState<RandomModeDifficulty>('standard');
	const [showHint, setShowHint] = useState(false);

	// 入力検証・表示状態
	const validatorRef = useRef<InputValidator | null>(null);
	const [displayHiragana, setDisplayHiragana] = useState('');
	const [romajiGuide, setRomajiGuide] = useState('');
	const [inputStates, setInputStates] = useState<InputCharState[]>([]);
	const [romajiStates, setRomajiStates] = useState<RomajiCharState[]>([]);
	const [completedHiraganaCount, setCompletedHiraganaCount] = useState(0);
	const [showError, setShowError] = useState(false);

	const soundManagerRef = useRef<TypingSoundManager | null>(null);
	const hintTimerRef = useRef<number | null>(null);
	const previousCardIdRef = useRef<string | null>(null);
	const totalCards = gameMode === 'timeattack' ? 10 : data.cards?.length || 0;

	// 初期化（マウント時にセッション開始、アンマウント時に終了）
	// 旧 onMount の忠実な移植のため、マウント時の同期 setState を許容する
	/* eslint-disable react-hooks/set-state-in-effect */
	useEffect(() => {
		soundManagerRef.current = new TypingSoundManager();

		if (data.error) {
			setError(data.error);
			setIsLoading(false);
			return;
		}

		const mode = data.mode as GameMode;
		setGameMode(mode);
		setCurrentDifficulty(data.difficulty || 'standard');

		const cards = data.cards;
		if (!cards || cards.length === 0) {
			setError('カードデータの読み込みに失敗しました');
			setIsLoading(false);
			return;
		}

		// 難易度を反映（ランダム・タイムアタック共通）
		const difficulty = data.difficulty || undefined;

		gameStore.startSession(mode, cards, difficulty);
		setIsLoading(false);
		setShowCountdown(true);

		return () => {
			// 離れる前に進捗を保存（ゲーム完了済みなら endSession 済み）
			const state = gameStore.getState();
			if (state.session?.isActive) {
				gameStore.endSession();
			}
			if (soundManagerRef.current) {
				soundManagerRef.current.destroy();
				soundManagerRef.current = null;
			}
			previousCardIdRef.current = null;
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);
	/* eslint-enable react-hooks/set-state-in-effect */

	// カード変更時の処理（バリデータ更新・ガイド初期化・効果音）。
	// 旧実装のストア購読コールバックの忠実な移植。
	useEffect(() => {
		if (!currentCard) return;
		if (currentCard.id === previousCardIdRef.current) return;

		const soundManager = soundManagerRef.current;

		// 前のカードがあった場合（初回以外）、かつスキップでない場合のみ正解音を再生
		if (previousCardIdRef.current && soundManager && !wasSkipped) {
			soundManager.playComplete();
		}
		// wasSkipped フラグをリセット（次のカード用）
		if (wasSkipped) {
			gameStore.update((s) => ({
				...s,
				cards: { ...s.cards, wasSkipped: false }
			}));
		}

		previousCardIdRef.current = currentCard.id;

		// 新しいカードの読み上げを再生
		if (soundManager && gameStarted) {
			soundManager.playCardReading(currentCard.id);
		}

		// バリデータを更新（初心者モードは hiraganaShort を使用）
		const validator = new InputValidator();
		const hiraganaText =
			sessionDifficulty === 'beginner' && currentCard.hiraganaShort
				? currentCard.hiraganaShort
				: currentCard.hiragana;
		const targetText = hiraganaText.replace(/\s/g, '');
		validator.setTarget(targetText);
		validatorRef.current = validator;

		const guide = buildDefaultRomajiGuide(validator, targetText);
		setDisplayHiragana(hiraganaText);
		setRomajiGuide(guide);
		setInputStates(new Array(parseHiraganaUnits(targetText).length).fill('pending'));
		setRomajiStates(new Array(guide.length).fill('pending'));
		setCompletedHiraganaCount(0);
	}, [currentCard, wasSkipped, gameStarted, sessionDifficulty]);

	// ゲーム完了の判定（冪等: 既に完了済みなら終了音を再生しない）
	/* eslint-disable react-hooks/set-state-in-effect */
	useEffect(() => {
		if (isGameComplete || isLoading) return;
		const allCardsCompleted =
			completedCardsCount === totalCards && totalCards > 0 && sessionIsActive;
		const sessionEnded = !!(sessionEndTime && !sessionIsActive);

		if (allCardsCompleted || sessionEnded) {
			setIsGameComplete(true);
			const soundManager = soundManagerRef.current;
			soundManager?.stopCardReading();
			// 手動終了の場合は終了音を再生しない
			if (!sessionIsManualExit) {
				soundManager?.playGameEnd();
			}
			soundManager?.stopBGM();
		}
	}, [
		completedCardsCount,
		totalCards,
		sessionIsActive,
		sessionEndTime,
		sessionIsManualExit,
		isGameComplete,
		isLoading
	]);
	/* eslint-enable react-hooks/set-state-in-effect */

	// ヒント表示機能（上級者モードで Enter キー）
	const showHintText = () => {
		if (hintTimerRef.current) return; // 既にヒント表示中なら無視
		setShowHint(true);
		hintTimerRef.current = window.setTimeout(() => {
			setShowHint(false);
			hintTimerRef.current = null;
		}, 2000);
	};

	const handleCharacterInput = (char: string) => {
		const validator = validatorRef.current;
		if (!validator || !currentCard) return;

		const prevInput = gameStore.getState().input.current;
		const newInput = prevInput + char;
		// スペースのみを削除し、読点は残す
		const targetText = displayHiragana.replace(/\s/g, '');

		// 入力文字列全体を検証
		const result = validator.validateInput(targetText, newInput);

		if (result.isValid) {
			const hiraganaUnits = parseHiraganaUnits(targetText);
			const { completedCount } = matchHiraganaProgress(hiraganaUnits, newInput, validator);

			setInputStates(buildInputStatesAfterInput(hiraganaUnits.length, completedCount));
			setCompletedHiraganaCount(completedCount);

			// 入力に基づいて動的ローマ字ガイドを更新
			const guide = buildDynamicRomajiGuide({
				validator,
				targetText,
				currentInput: newInput,
				completedCount
			});
			setRomajiGuide(guide);
			setRomajiStates(buildRomajiStates(guide.length, newInput.length));

			// ゲームストアを更新（完全一致時はストア側で自動的に次の札へ進む）
			gameStore.updateInput(newInput);

			// 正しい入力の音を再生
			soundManagerRef.current?.playCorrect();
			setShowError(false);
		} else {
			// エラーを表示
			setShowError(true);

			const hiraganaUnits = parseHiraganaUnits(targetText);
			const { states, errorIndex } = buildInputStatesOnError(
				hiraganaUnits.length,
				completedHiraganaCount
			);
			setInputStates(states);
			setRomajiStates(buildRomajiStatesOnError(romajiGuide.length, prevInput.length));

			// 間違った入力の音を再生
			soundManagerRef.current?.playIncorrect();

			// 誤入力をストアに反映（ミスとしてカウント、現在入力は更新しない）
			gameStore.updateInput(prevInput + char);

			// タイムアタックモードの場合はミスごとにペナルティを追加
			if (gameMode === 'timeattack') {
				gameStore.update((s) => ({
					...s,
					timer: {
						...s.timer,
						penalty: s.timer.penalty + TIMEATTACK_MISTAKE_PENALTY_MS
					}
				}));
			}

			// 500ms後にエラーインジケータをリセット
			window.setTimeout(() => {
				setShowError(false);
				setInputStates((prev) => {
					if (errorIndex < prev.length) {
						const next = [...prev];
						next[errorIndex] = 'pending';
						return next;
					}
					return prev;
				});
				setRomajiStates((prev) => {
					if (prevInput.length < prev.length) {
						const next = [...prev];
						next[prevInput.length] = 'pending';
						return next;
					}
					return prev;
				});
			}, 500);
		}
	};

	const handleBackspace = () => {
		const validator = validatorRef.current;
		if (!validator) return;

		const prevInput = gameStore.getState().input.current;
		if (prevInput.length === 0) return;

		const newInput = prevInput.slice(0, -1);
		const targetText = displayHiragana.replace(/\s/g, '') || '';
		const hiraganaUnits = parseHiraganaUnits(targetText);
		const { completedCount, partiallyCompleteIndex } = matchHiraganaProgress(
			hiraganaUnits,
			newInput,
			validator
		);

		setCompletedHiraganaCount(completedCount);
		setInputStates(
			buildInputStatesAfterBackspace(hiraganaUnits.length, completedCount, partiallyCompleteIndex)
		);

		// バックスペース後に動的ローマ字ガイドを更新
		const guide = buildDynamicRomajiGuide({
			validator,
			targetText,
			currentInput: newInput,
			completedCount
		});
		setRomajiGuide(guide);
		setRomajiStates(buildRomajiStates(guide.length, newInput.length));

		// バックスペース後の入力をストアへ反映（バックスペースはコンボを崩さない）
		gameStore.updateInput(newInput);
	};

	const handlePause = () => {
		const soundManager = soundManagerRef.current;
		if (isPaused) {
			gameStore.resumeGame();
			soundManager?.resumeBGM();
		} else {
			gameStore.pauseGame();
			if (soundManager) {
				soundManager.pauseBGM();
				soundManager.stopCardReading();
			}
		}
	};

	const handleResumeFromOverlay = () => {
		gameStore.resumeGame();
		soundManagerRef.current?.resumeBGM();
	};

	const handleSkip = () => {
		// 入力状態をリセット
		setCompletedHiraganaCount(0);

		// ハイライトをクリアするため入力状態配列をリセット
		if (currentCard) {
			const targetText = displayHiragana.replace(/\s/g, '');
			const hiraganaUnits = parseHiraganaUnits(targetText);
			setInputStates(new Array(hiraganaUnits.length).fill('pending'));
			setRomajiStates(new Array(romajiGuide.length).fill('pending'));
		}

		// スキップ時に読み上げを停止して札を弾く音を再生
		const soundManager = soundManagerRef.current;
		if (soundManager) {
			soundManager.stopCardReading();
			soundManager.playFlickCard();
		}

		// 全モード共通でカードをスキップ（完了扱いにしない）。
		// 最後の札のスキップやデッキ終端、タイムアタックのペナルティはstore側で処理される。
		gameStore.skipCard();
	};

	const confirmExit = () => {
		gameStore.endSession(true);
		soundManagerRef.current?.stopCardReading();
		soundManagerRef.current?.stopBGM();
		router.visit('/');
	};

	const handleCountdownComplete = () => {
		setShowCountdown(false);
		setGameStarted(true);

		// BGMを開始
		const soundManager = soundManagerRef.current;
		if (soundManager) {
			soundManager.startBGM();
			// 最初のカードの読み上げを再生
			const card = gameStore.getState().cards.current;
			if (card) {
				soundManager.playCardReading(card.id);
			}
		}

		// カウントダウン後にゲームタイマーを開始（全モード共通）
		gameStore.startGameAfterCountdown();
	};

	// キーボードハンドラ（最新の状態を参照するために ref 経由で呼び出す）
	const keydownRef = useRef<(event: KeyboardEvent) => void>(() => {});
	const handleKeydown = (event: KeyboardEvent) => {
		if (isPaused || isGameComplete || !currentCard || showCountdown) return;

		// Enterキーでヒント表示（上級者モードのみ）
		if (event.key === 'Enter') {
			if (currentDifficulty === 'advanced') {
				event.preventDefault();
				showHintText();
				return;
			}
		}

		// ゲームキーのデフォルト動作を防止
		if (event.key.length === 1 || event.key === 'Backspace') {
			event.preventDefault();
		}

		// 入力を処理
		if (event.key === 'Backspace') {
			handleBackspace();
		} else if (
			event.key.length === 1 &&
			(/^[a-zA-Z]$/.test(event.key) || event.key === '-' || event.key === ',' || event.key === '、')
		) {
			// カンマと読点を処理
			const inputChar = event.key === ',' || event.key === '、' ? '、' : event.key.toLowerCase();
			handleCharacterInput(inputChar);
		} else if (event.key === 'Escape') {
			handlePause();
		}
	};

	// レンダーごとに最新のハンドラを ref に同期する（render 中の ref 書き込みは不可のため effect で行う）
	useEffect(() => {
		keydownRef.current = handleKeydown;
	});

	useEffect(() => {
		const listener = (event: KeyboardEvent) => keydownRef.current(event);
		document.addEventListener('keydown', listener);
		return () => document.removeEventListener('keydown', listener);
	}, []);

	const formatTime = (ms: number): string => {
		const seconds = Math.floor(ms / 1000);
		const minutes = Math.floor(seconds / 60);
		const secs = seconds % 60;
		return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
	};

	const modeLabel =
		gameMode === 'random'
			? 'ランダム'
			: gameMode === 'timeattack'
				? 'タイムアタック'
				: String(gameMode ?? '');

	const difficultyLabel =
		currentDifficulty === 'beginner'
			? '初心者モード'
			: currentDifficulty === 'standard'
				? '標準モード'
				: '上級モード';

	const handleShare = () => {
		const shareText = `【上毛かるたタイピング】
${modeLabel} ${difficultyLabel}で${score.total.toLocaleString()}点獲得！

📊 ゲーム結果
・正解した札: ${completedCardsCount}枚
・正確率: ${score.accuracy.toFixed(2)}%
・WPM: ${score.speed}
・最大コンボ: ${score.maxCombo}

#上毛かるた #タイピングゲーム`;

		const shareUrl = window.location.origin;
		const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`;
		window.open(twitterUrl, '_blank', 'width=550,height=420');
	};

	const handleReplay = () => {
		// BGMを確実に停止
		soundManagerRef.current?.stopBGM();

		// 同じモードで再プレイ
		const url = new URL(window.location.href);
		url.searchParams.delete('continue');
		if (gameMode) {
			url.searchParams.set('mode', gameMode);
		}
		window.location.href = url.toString();
	};

	return (
		<main
			className="min-h-screen bg-cover bg-fixed bg-center"
			style={{ backgroundImage: `url(${backgroundImage})` }}
		>
			<Head title="タイピングゲーム - 上毛かるた" />
			<div
				data-testid="game-container"
				className="mx-auto flex min-h-screen w-full max-w-5xl flex-col px-4 py-6 sm:px-8 sm:py-8"
			>
				{isLoading ? (
					<div className="flex min-h-[400px] flex-1 items-center justify-center">
						<div className="h-12 w-12 animate-spin rounded-full border-b-2 border-[#E5C875]"></div>
						<p className="ml-4 text-[#F5E9C8]" style={SERIF}>
							ゲームを準備中...
						</p>
					</div>
				) : error ? (
					<div className="flex flex-1 items-center justify-center">
						<div className="rounded-xl border border-[#C8302A] bg-[#0A1A35]/85 p-8 text-center shadow-xl">
							<p className="mb-4 text-[#FF8A84]" style={SERIF}>
								{error}
							</p>
							<a href="/" className="text-[#E5C875] hover:underline" style={SERIF}>
								メインメニューに戻る
							</a>
						</div>
					</div>
				) : isGameComplete ? (
					<div className="flex flex-1 items-center justify-center py-4">
						<div className="w-full max-w-[720px] rounded-xl border-2 border-[#C9A961] bg-[#0A1A35]/90 px-6 py-8 shadow-2xl sm:px-12 sm:py-10">
							<div className="flex flex-col items-center gap-6">
								{/* タイトル */}
								<h2 className="text-4xl font-black text-[#E5C875] sm:text-[44px]" style={SERIF}>
									ゲーム終了！
								</h2>

								{/* モード表示 */}
								<div className="flex items-center gap-3">
									<span
										className={`rounded-full border border-[#C9A961] px-5 py-2 text-sm font-bold text-[#F5E9C8] ${
											gameMode === 'timeattack' ? 'bg-[#C8302A]' : 'bg-[#0F2952]'
										}`}
										style={SERIF}
									>
										{modeLabel}
									</span>
									{(gameMode === 'random' || gameMode === 'timeattack') && (
										<span
											className="rounded-full border border-[#C9A961] bg-[#0F2952] px-5 py-2 text-sm font-bold text-[#F5E9C8]"
											style={SERIF}
										>
											{difficultyLabel}
										</span>
									)}
								</div>

								{/* スコア（中段・目立つように） / タイムアタックはタイム表示 */}
								{gameMode === 'timeattack' ? (
									<div className="flex w-full flex-col items-center gap-1.5 rounded-[10px] border border-[#C9A961] bg-[#132D57] px-8 py-7 text-center">
										<p className="text-base font-medium text-[#B8A874]" style={SERIF}>
											最終タイム
										</p>
										<div className="flex items-end gap-1.5">
											<span
												className="text-6xl font-extrabold text-[#E5C875] tabular-nums"
												style={MONO}
											>
												{((timeAttackElapsedTime + timeAttackPenalty) / 1000).toFixed(2)}
											</span>
											<span className="pb-1.5 text-2xl font-semibold text-[#F5E9C8]" style={SERIF}>
												秒
											</span>
										</div>
										{timeAttackPenalty > 0 && (
											<>
												<p className="text-sm font-semibold text-[#E5453D]" style={SERIF}>
													ペナルティ: +{(timeAttackPenalty / 1000).toFixed(2)}秒
												</p>
												<p className="text-xs text-[#B8A874]" style={SERIF}>
													（ミス: {timeAttackMistakes}回 / スキップ: {timeAttackSkips}回）
												</p>
											</>
										)}
									</div>
								) : (
									<div className="flex w-full flex-col items-center gap-1.5 rounded-[10px] border border-[#C9A961] bg-[#132D57] px-8 py-7 text-center">
										<p className="text-base font-medium text-[#B8A874]" style={SERIF}>
											スコア
										</p>
										<span
											className="text-6xl font-extrabold text-[#E5C875] tabular-nums"
											style={MONO}
										>
											{score.total.toLocaleString()}
										</span>
									</div>
								)}

								{/* 詳細統計 */}
								<div data-testid="final-score" className="grid w-full grid-cols-2 gap-3">
									{[
										{ label: '正解した札', value: `${completedCardsCount}`, unit: '枚' },
										{ label: '正確率', value: `${score.accuracy.toFixed(2)}%`, unit: '' },
										{ label: 'WPM(単語数/分)', value: `${score.speed}`, unit: '' },
										{ label: '最大コンボ', value: `${score.maxCombo}`, unit: '' }
									].map((stat) => (
										<div
											key={stat.label}
											className="flex flex-col items-center gap-2 rounded-lg border border-[#C9A961] bg-[#132D57] px-6 py-5"
										>
											<p className="text-sm font-medium text-[#B8A874]" style={SERIF}>
												{stat.label}
											</p>
											<div className="flex items-end gap-1">
												<span
													className="text-3xl font-extrabold text-[#E5C875] tabular-nums"
													style={MONO}
												>
													{stat.value}
												</span>
												{stat.unit && (
													<span
														className="pb-0.5 text-base font-semibold text-[#F5E9C8]"
														style={SERIF}
													>
														{stat.unit}
													</span>
												)}
											</div>
										</div>
									))}
								</div>

								{/* ボタン群 */}
								<div className="flex w-full flex-col gap-3">
									{(gameMode === 'random' || gameMode === 'timeattack') && !isRankingRegistered && (
										<button
											onClick={() => setShowRankingModal(true)}
											className="flex w-full items-center justify-center gap-2.5 rounded-lg border border-[#E5C875] bg-linear-to-r from-[#E5C875] to-[#D4681A] px-6 py-4 text-lg font-bold text-white shadow-md transition-transform hover:scale-[1.02]"
											style={SERIF}
										>
											<Trophy className="h-5 w-5" />
											ランキングに登録する
										</button>
									)}
									<div className="grid grid-cols-2 gap-3">
										<button
											onClick={() => router.visit('/ranking')}
											className="flex items-center justify-center gap-2 rounded-lg border border-[#C9A961] bg-[#0F2952] px-4 py-3.5 text-[15px] font-semibold text-[#F5E9C8] transition-colors hover:bg-[#163A6B]"
											style={SERIF}
										>
											<Trophy className="h-4 w-4 text-[#E5C875]" />
											ランキングを見る
										</button>
										<button
											onClick={handleShare}
											className="flex items-center justify-center gap-2 rounded-lg border border-[#C9A961] bg-[#0F2952] px-4 py-3.5 text-[15px] font-semibold text-[#F5E9C8] transition-colors hover:bg-[#163A6B]"
											style={SERIF}
										>
											<Megaphone className="h-4 w-4 text-[#E5C875]" />
											結果をX(Twitter)でシェア
										</button>
									</div>
									<button
										onClick={handleReplay}
										className="flex w-full items-center justify-center gap-2.5 rounded-lg border border-[#E5C875] bg-linear-to-r from-[#3A6BC8] to-[#1E3A6B] px-6 py-4 text-lg font-bold text-white shadow-md transition-transform hover:scale-[1.02]"
										style={SERIF}
									>
										<RotateCcw className="h-[18px] w-[18px]" />
										もう一度遊ぶ
									</button>
									<button
										onClick={() => router.visit('/')}
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
				) : (
					<>
						{/* ゲームヘッダー */}
						{gameMode === 'timeattack' ? (
							<div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2">
								<TimeAttackTimer
									elapsedTime={timeAttackElapsedTime}
									penalty={timeAttackPenalty}
									isCompleted={cardIndex >= (sessionTotalCards || 10)}
								/>
								<TimeAttackProgress
									current={cardIndex + 1}
									total={sessionTotalCards || 10}
									mistakes={timeAttackMistakes}
									skips={timeAttackSkips}
								/>
							</div>
						) : (
							<header className="mb-6 flex items-center justify-between rounded-lg border border-[#C9A961] bg-[#0A1A35]/80 px-6 py-4 shadow-lg sm:px-8">
								<div className="flex items-center gap-2">
									<span className="text-base font-semibold text-[#C9A961]" style={SERIF}>
										進捗:
									</span>
									<span className="text-lg font-bold text-[#F5E9C8] tabular-nums" style={SERIF}>
										{cardIndex + 1} / {totalCards}
									</span>
								</div>
								{hasTimeLimit && remainingTime !== null && (
									<div className="flex items-center gap-2">
										<Timer
											className={`h-[18px] w-[18px] ${
												remainingTime < 10000 ? 'text-[#E5453D]' : 'text-[#C9A961]'
											}`}
										/>
										<span className="text-base font-semibold text-[#C9A961]" style={SERIF}>
											残り時間:
										</span>
										<span
											className={`text-xl font-bold tabular-nums ${
												remainingTime < 10000 ? 'text-[#E5453D]' : 'text-[#F5E9C8]'
											}`}
											style={SERIF}
										>
											{formatTime(remainingTime)}
										</span>
									</div>
								)}
							</header>
						)}

						{/* 拡張一時停止オーバーレイ */}
						<PauseOverlay
							isPaused={isPaused}
							gameStats={{
								currentCard: cardIndex,
								totalCards,
								elapsedTime,
								pauseCount,
								score: score.total || 0,
								accuracy: score.accuracy || 100
							}}
							onResume={handleResumeFromOverlay}
							onExit={confirmExit}
						/>

						{/* カウントダウンオーバーレイ */}
						{showCountdown && <Countdown onComplete={handleCountdownComplete} duration={3} />}

						{/* 終了確認 */}
						{showExitConfirm && (
							<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
								<div className="mx-4 rounded-xl border border-[#C9A961] bg-[#0A1A35] p-8 text-center shadow-2xl">
									<h2 className="mb-6 text-xl font-bold text-[#F5E9C8]" style={SERIF}>
										本当に終了しますか？
									</h2>
									<div className="flex justify-center gap-4">
										<button
											onClick={confirmExit}
											className="rounded-lg border border-[#E5453D] bg-[#C8302A] px-8 py-2.5 font-semibold text-white transition-colors hover:bg-[#A8261F]"
											style={SERIF}
										>
											はい
										</button>
										<button
											onClick={() => setShowExitConfirm(false)}
											className="rounded-lg border border-[#5A6472] bg-[#3A4552] px-8 py-2.5 font-semibold text-white transition-colors hover:bg-[#4A5562]"
											style={SERIF}
										>
											いいえ
										</button>
									</div>
								</div>
							</div>
						)}

						{/* カード表示 */}
						{!showCountdown && (
							<>
								{currentCard && displayHiragana ? (
									<CardDisplay
										card={currentCard}
										shake={showError}
										difficulty={currentDifficulty}
									/>
								) : (
									<div className="mb-6 rounded-xl border-2 border-[#C9A961] bg-[#F5E9C8]/95 p-8 text-center">
										<p className="text-[#2A1F0F]" style={SERIF}>
											カードを読み込み中...
										</p>
									</div>
								)}

								{/* 入力ハイライト表示 */}
								{currentCard && (
									<div className="mb-6 flex flex-col items-center gap-2 rounded-lg border border-[#C9A961] bg-[#0A1A35]/80 px-6 py-5 shadow-lg">
										<InputHighlight
											text={parseHiraganaUnits(displayHiragana.replace(/\s/g, '')).join('')}
											inputStates={inputStates}
											currentPosition={completedHiraganaCount}
											showRomaji={currentDifficulty !== 'advanced'}
											romaji={romajiGuide}
											romajiStates={romajiStates}
											animateErrors={true}
											currentRomajiPosition={currentInput.length}
											difficulty={currentDifficulty}
											showHint={showHint}
										/>
									</div>
								)}
							</>
						)}

						{/* スコア表示 */}
						{!showCountdown && (
							<div className="mb-6 grid grid-cols-3 gap-4 rounded-lg border border-[#C9A961] bg-[#0A1A35]/80 px-6 py-5 text-center shadow-lg sm:px-8">
								<div className="flex flex-col items-center gap-1.5">
									<p className="text-sm font-medium text-[#B8A874]" style={SERIF}>
										正確率
									</p>
									<p
										data-testid="accuracy-display"
										className="text-2xl font-extrabold text-[#E5C875] tabular-nums"
										style={SERIF}
									>
										{(score.accuracy ?? 100).toFixed(2)}%
									</p>
								</div>
								<div className="flex flex-col items-center gap-1.5">
									<p className="text-sm font-medium text-[#B8A874]" style={SERIF}>
										コンボ
									</p>
									<p
										data-testid="combo-display"
										className="text-2xl font-extrabold text-[#F5E9C8] tabular-nums"
										style={SERIF}
									>
										{score.combo || 0}
									</p>
								</div>
								<div className="flex flex-col items-center gap-1.5">
									<p className="text-sm font-medium text-[#B8A874]" style={SERIF}>
										スコア
									</p>
									<p className="text-2xl font-extrabold text-[#F5E9C8] tabular-nums" style={SERIF}>
										{score.total || 0}
									</p>
								</div>
							</div>
						)}

						{/* ゲームコントロール */}
						{!showCountdown && (
							<div className="flex flex-wrap justify-center gap-4 sm:gap-5">
								<button
									onClick={handlePause}
									className="flex items-center gap-2.5 rounded-lg border border-[#E5C875] bg-[#D4A017] px-8 py-3.5 font-bold text-white shadow-md transition-colors hover:bg-[#BE8F14]"
									style={SERIF}
								>
									{isPaused ? (
										<Play className="h-[18px] w-[18px]" />
									) : (
										<Pause className="h-[18px] w-[18px]" />
									)}
									{isPaused ? '再開' : '一時停止'}
								</button>
								<button
									onClick={handleSkip}
									className="flex items-center gap-2.5 rounded-lg border border-[#5A6472] bg-[#3A4552] px-8 py-3.5 font-bold text-white shadow-md transition-colors hover:bg-[#4A5562]"
									style={SERIF}
								>
									<SkipForward className="h-[18px] w-[18px]" />
									スキップ
								</button>
								<button
									onClick={() => setShowExitConfirm(true)}
									className="flex items-center gap-2.5 rounded-lg border border-[#E5453D] bg-[#C8302A] px-8 py-3.5 font-bold text-white shadow-md transition-colors hover:bg-[#A8261F]"
									style={SERIF}
								>
									<X className="h-[18px] w-[18px]" />
									終了
								</button>
							</div>
						)}

						{/* モバイル用の非表示入力 */}
						<input
							type="text"
							className="sr-only"
							autoComplete="off"
							autoCorrect="off"
							autoCapitalize="off"
							spellCheck={false}
						/>
					</>
				)}
			</div>

			{/* ランキング登録モーダル */}
			<RankingRegistrationModal
				isOpen={showRankingModal}
				score={score.total || 0}
				difficulty={
					gameMode === 'random' || gameMode === 'timeattack' ? currentDifficulty : undefined
				}
				gameMode={gameMode || undefined}
				time={gameMode === 'timeattack' ? timeAttackFinalTime : undefined}
				onClose={() => setShowRankingModal(false)}
				onSuccess={() => {
					setIsRankingRegistered(true);
					setShowRankingModal(false);
				}}
			/>
		</main>
	);
}
