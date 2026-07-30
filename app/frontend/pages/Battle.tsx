import { useEffect, useMemo, useRef, useState } from 'react';
import { Head, router } from '@inertiajs/react';
import { LoaderCircle, Timer, X } from 'lucide-react';
import type { KarutaCard } from '@/types';
import type { BattleOutcome, BattleRoomProps, BattleStats } from '@/types/battle';
import { gameStore, useGameStore, type GameScore } from '@/stores/game-store';
import { battleStore, useBattleStore } from '@/stores/battle-store';
import { formatClock } from '@/lib/format-clock';
import { InputValidator } from '@/lib/typing/input-validator';
import { TypingSoundManager } from '@/lib/audio/typing-sounds';
import { getKarutaCards } from '@/lib/data/karuta-cards';
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
import Countdown from '@/components/game/Countdown';
import TimeAttackTimer from '@/components/game/TimeAttackTimer';
import OpponentProgress from '@/components/battle/OpponentProgress';
import BattleExitConfirm from '@/components/battle/BattleExitConfirm';
import BattleResult from '@/components/battle/BattleResult';
import MatchingModal from '@/components/battle/MatchingModal';
import backgroundImage from '@/assets/images/background.webp';

// デザインカンプ（design.pen）準拠のフォント指定
const SERIF = { fontFamily: "'Noto Serif JP', serif" } as const;

// 対戦は同条件での勝負のため難易度は標準固定（ADR 0010）
const BATTLE_DIFFICULTY = 'standard' as const;

interface BattleProps {
	room: BattleRoomProps;
}

/**
 * 対戦プレイ画面（個別同時プレイ）。
 * ローカルのタイピング進行は game-store（サーバ確定の presetDeck 使用）、
 * 相手の状態と勝敗は battle-store が持つ。Game.tsx と同じ配線を
 * ポーズ・ヒント・スキップ・保存なしで再構成している（ADR 0010）。
 */
export default function Battle({ room }: BattleProps) {
	const mode = room.gameMode;

	// 対戦ストアの状態
	const phase = useBattleStore((s) => s.phase);
	const storeRoomId = useBattleStore((s) => s.roomId);
	const passphrase = useBattleStore((s) => s.passphrase);
	const myUserId = useBattleStore((s) => s.myUserId);
	const myReady = useBattleStore((s) => s.myReady);
	const opponentReady = useBattleStore((s) => s.opponentReady);
	const opponentTaken = useBattleStore((s) => s.opponentTaken);
	const opponentStats = useBattleStore((s) => s.opponentStats);
	const opponentLeft = useBattleStore((s) => s.opponentLeft);
	const storeMyStats = useBattleStore((s) => s.myStats);
	const outcome = useBattleStore((s) => s.outcome);

	// ゲームストアの状態（Game.tsx と同じ配線）
	const currentCard = useGameStore((s) => s.cards.current);
	const cardIndex = useGameStore((s) => s.cards.currentIndex);
	const completedCardsCount = useGameStore((s) => s.cards.completed.length);
	const score: GameScore = useGameStore((s) => s.score);
	const currentInput = useGameStore((s) => s.input.current);
	const remainingTime = useGameStore((s) => s.timer.remainingTime);
	const sessionIsActive = useGameStore((s) => s.session?.isActive);
	const sessionEndTime = useGameStore((s) => s.session?.endTime);
	const timeAttackElapsedTime = useGameStore((s) => s.timer.elapsedTime);
	const timeAttackPenalty = useGameStore((s) => s.timer.penalty || 0);
	const timeAttackMistakes = useGameStore((s) => s.statistics.mistakes);

	// ページローカル状態
	const [showCountdown, setShowCountdown] = useState(false);
	const [gameStarted, setGameStarted] = useState(false);
	const [showExitConfirm, setShowExitConfirm] = useState(false);

	// 入力検証・表示状態（Game.tsx と同じ）
	const validatorRef = useRef<InputValidator | null>(null);
	const [displayHiragana, setDisplayHiragana] = useState('');
	const [romajiGuide, setRomajiGuide] = useState('');
	const [inputStates, setInputStates] = useState<InputCharState[]>([]);
	const [romajiStates, setRomajiStates] = useState<RomajiCharState[]>([]);
	const [completedHiraganaCount, setCompletedHiraganaCount] = useState(0);
	const [showError, setShowError] = useState(false);

	const soundManagerRef = useRef<TypingSoundManager | null>(null);
	const previousCardIdRef = useRef<string | null>(null);
	const finishedSentRef = useRef(false);

	// サーバが確定した山札（カード id → カード解決。両者同一順序）
	const presetDeck = useMemo(() => {
		const byId = new Map(getKarutaCards().map((card) => [card.id, card]));
		return room.deck
			.map((id) => byId.get(id))
			.filter((card): card is KarutaCard => card !== undefined);
	}, [room.deck]);
	const totalCards = presetDeck.length;

	// リザルトのスナップショット（再戦のマッチング開始でストアがリセットされても表示を保つ）
	const [resultSnapshot, setResultSnapshot] = useState<{
		outcome: BattleOutcome | null;
		myStats: BattleStats | null;
		opponentStats: BattleStats | null;
		opponentLeft: boolean;
	} | null>(null);

	// ガード: リロード・直リンクでは対戦へ復帰しない（ADR 0006 / 0010）。ストアが部屋を知らなければトップへ
	const isValidEntry = storeRoomId === room.id;
	useEffect(() => {
		if (!isValidEntry && phase !== 'matching') {
			router.visit('/');
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	// 初期化: セッション開始（プリロード込み）→ ready 送信。
	// NOTE: 対戦からの離脱はアンマウントではなく battle-store の navigate 監視で判定する
	// （StrictMode の mount→cleanup→再mount でクリーンアップが誤発火するため。handleNavigateAway 参照）
	/* eslint-disable react-hooks/set-state-in-effect */
	useEffect(() => {
		if (!isValidEntry) return;

		soundManagerRef.current = new TypingSoundManager();
		let cancelled = false;
		void (async () => {
			await gameStore.startSession(mode, getKarutaCards(), BATTLE_DIFFICULTY, { presetDeck });
			if (!cancelled) {
				battleStore.sendReady();
			}
		})();

		return () => {
			cancelled = true;
			const state = gameStore.getState();
			if (state.session?.isActive) {
				gameStore.endSession(true);
			}
			soundManagerRef.current?.destroy();
			soundManagerRef.current = null;
			previousCardIdRef.current = null;
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	// 両者の ready が揃ったら開始カウントダウン（フェイルセーフは battle-store 側）
	useEffect(() => {
		if (myReady && opponentReady && !gameStarted && !showCountdown) {
			setShowCountdown(true);
		}
	}, [myReady, opponentReady, gameStarted, showCountdown]);
	/* eslint-enable react-hooks/set-state-in-effect */

	const handleCountdownComplete = () => {
		setShowCountdown(false);
		setGameStarted(true);
		battleStore.markPlaying();

		const soundManager = soundManagerRef.current;
		if (soundManager) {
			soundManager.startBGM();
			const card = gameStore.getState().cards.current;
			if (card) {
				soundManager.playCardReading(card.id);
			}
		}
		gameStore.startGameAfterCountdown();
	};

	// カード変更時の処理（バリデータ更新・ガイド初期化・効果音）。標準難易度固定
	useEffect(() => {
		if (!currentCard) return;
		if (currentCard.id === previousCardIdRef.current) return;

		const soundManager = soundManagerRef.current;
		if (previousCardIdRef.current && soundManager) {
			soundManager.playComplete();
		}
		previousCardIdRef.current = currentCard.id;

		if (soundManager && gameStarted) {
			soundManager.playCardReading(currentCard.id);
		}

		const validator = new InputValidator();
		const targetText = currentCard.hiragana.replace(/\s/g, '');
		validator.setTarget(targetText);
		validatorRef.current = validator;

		const guide = buildDefaultRomajiGuide(validator, targetText);
		setDisplayHiragana(currentCard.hiragana);
		setRomajiGuide(guide);
		setInputStates(new Array(parseHiraganaUnits(targetText).length).fill('pending'));
		setRomajiStates(new Array(guide.length).fill('pending'));
		setCompletedHiraganaCount(0);
	}, [currentCard, gameStarted]);

	// 取得札数を相手へリアルタイム送信する
	useEffect(() => {
		if (!gameStarted) return;
		battleStore.sendProgress(completedCardsCount);
	}, [completedCardsCount, gameStarted]);

	// ローカルのプレイ終了（タイムアタック=10枚完走 / ランダム=60秒）で結果を送信する
	useEffect(() => {
		if (finishedSentRef.current || !gameStarted) return;

		const allCardsCompleted =
			completedCardsCount === totalCards && totalCards > 0 && sessionIsActive;
		const sessionEnded = !!(sessionEndTime && !sessionIsActive);
		if (!allCardsCompleted && !sessionEnded) return;

		finishedSentRef.current = true;

		const soundManager = soundManagerRef.current;
		soundManager?.stopCardReading();
		soundManager?.playGameEnd();
		soundManager?.stopBGM();

		const state = gameStore.getState();
		const finalTime = state.timer.elapsedTime + state.timer.penalty;
		battleStore.sendFinished({
			score: mode === 'random' ? Math.round(state.score.total || 0) : null,
			timeMs: mode === 'timeattack' ? Math.round(finalTime) : null,
			taken: state.cards.completed.length,
			accuracy: Number((state.score.accuracy ?? 100).toFixed(2)),
			wpm: Math.round(state.score.speed ?? 0),
			maxCombo: Math.round(state.score.maxCombo ?? 0)
		});
	}, [completedCardsCount, totalCards, sessionIsActive, sessionEndTime, gameStarted, mode]);

	// 勝敗確定（相手の先着完走・相手の離脱など）で自分のセッションを終了する
	useEffect(() => {
		if (!outcome) return;
		const state = gameStore.getState();
		if (state.session?.isActive) {
			gameStore.endSession();
		}
	}, [outcome]);

	// リザルト表示値を保持（再戦のマッチング中もリザルトを出し続けるため）
	/* eslint-disable react-hooks/set-state-in-effect */
	useEffect(() => {
		if (phase === 'waitingOpponent' || phase === 'finished') {
			setResultSnapshot({ outcome, myStats: storeMyStats, opponentStats, opponentLeft });
		}
	}, [phase, outcome, storeMyStats, opponentStats, opponentLeft]);
	/* eslint-enable react-hooks/set-state-in-effect */

	const handleCharacterInput = (char: string) => {
		const validator = validatorRef.current;
		if (!validator || !currentCard) return;

		const prevInput = gameStore.getState().input.current;
		const newInput = prevInput + char;
		const targetText = displayHiragana.replace(/\s/g, '');

		const result = validator.validateInput(targetText, newInput);

		if (result.isValid) {
			const hiraganaUnits = parseHiraganaUnits(targetText);
			const { completedCount } = matchHiraganaProgress(hiraganaUnits, newInput, validator);

			setInputStates(buildInputStatesAfterInput(hiraganaUnits.length, completedCount));
			setCompletedHiraganaCount(completedCount);

			const guide = buildDynamicRomajiGuide({
				validator,
				targetText,
				currentInput: newInput,
				completedCount
			});
			setRomajiGuide(guide);
			setRomajiStates(buildRomajiStates(guide.length, newInput.length));

			gameStore.updateInput(newInput);
			soundManagerRef.current?.playCorrect();
			setShowError(false);
		} else {
			setShowError(true);

			const hiraganaUnits = parseHiraganaUnits(targetText);
			const { states, errorIndex } = buildInputStatesOnError(
				hiraganaUnits.length,
				completedHiraganaCount
			);
			setInputStates(states);
			setRomajiStates(buildRomajiStatesOnError(romajiGuide.length, prevInput.length));

			soundManagerRef.current?.playIncorrect();
			gameStore.updateInput(prevInput + char);

			// タイムアタックはミスごとにペナルティ（記録タイムにのみ影響。ADR 0010）
			if (mode === 'timeattack') {
				gameStore.update((s) => ({
					...s,
					timer: {
						...s.timer,
						penalty: s.timer.penalty + TIMEATTACK_MISTAKE_PENALTY_MS
					}
				}));
			}

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

		const guide = buildDynamicRomajiGuide({
			validator,
			targetText,
			currentInput: newInput,
			completedCount
		});
		setRomajiGuide(guide);
		setRomajiStates(buildRomajiStates(guide.length, newInput.length));

		gameStore.updateInput(newInput);
	};

	// 自発的な退出（Esc / 終了ボタン → 確認 → 相手の不戦勝）
	const confirmExit = () => {
		soundManagerRef.current?.stopCardReading();
		soundManagerRef.current?.stopBGM();
		gameStore.endSession(true);
		battleStore.leaveBattle();
		router.visit('/');
	};

	// キーボードハンドラ（最新の状態を参照するために ref 経由で呼び出す）
	const keydownRef = useRef<(event: KeyboardEvent) => void>(() => {});
	const handleKeydown = (event: KeyboardEvent) => {
		if (showExitConfirm) {
			if (event.key === 'Escape') {
				setShowExitConfirm(false);
			}
			return;
		}
		if (!gameStarted || showCountdown || !currentCard || phase !== 'playing') {
			if (event.key === 'Escape' && gameStarted) {
				setShowExitConfirm(true);
			}
			return;
		}

		if (event.key.length === 1 || event.key === 'Backspace') {
			event.preventDefault();
		}

		if (event.key === 'Backspace') {
			handleBackspace();
		} else if (
			event.key.length === 1 &&
			(/^[a-zA-Z]$/.test(event.key) || event.key === '-' || event.key === ',' || event.key === '、')
		) {
			const inputChar = event.key === ',' || event.key === '、' ? '、' : event.key.toLowerCase();
			handleCharacterInput(inputChar);
		} else if (event.key === 'Escape') {
			setShowExitConfirm(true);
		}
	};

	useEffect(() => {
		keydownRef.current = handleKeydown;
	});

	useEffect(() => {
		const listener = (event: KeyboardEvent) => keydownRef.current(event);
		document.addEventListener('keydown', listener);
		return () => document.removeEventListener('keydown', listener);
	}, []);

	const handleRematch = () => {
		if (!passphrase || myUserId === null) return;
		// 同じモード・同じ合言葉で通常のマッチングをやり直す（両者が押せば自然に再マッチ）
		void battleStore.startMatching(mode, passphrase, myUserId);
	};

	const handleGoHome = () => {
		battleStore.leaveBattle();
		router.visit('/');
	};

	if (!isValidEntry && phase !== 'matching') {
		return null;
	}

	// リザルト表示（自分の終了後）。再戦マッチング中はスナップショットで表示を維持する
	const displayResult =
		phase === 'matching' && resultSnapshot
			? resultSnapshot
			: { outcome, myStats: storeMyStats, opponentStats, opponentLeft };
	const showResult =
		phase === 'waitingOpponent' || phase === 'finished' || (phase === 'matching' && resultSnapshot);

	return (
		<main
			className="min-h-screen bg-cover bg-fixed bg-center"
			style={{ backgroundImage: `url(${backgroundImage})` }}
		>
			<Head title="対戦 - 上毛かるたタイピング" />
			<div
				data-testid="battle-container"
				className="mx-auto flex min-h-screen w-full max-w-5xl flex-col px-4 py-6 sm:px-8 sm:py-8"
			>
				{showResult ? (
					<BattleResult
						mode={mode}
						outcome={displayResult.outcome}
						myStats={displayResult.myStats}
						opponentStats={displayResult.opponentStats}
						opponentLeft={displayResult.opponentLeft}
						onRematch={handleRematch}
						onGoHome={handleGoHome}
					/>
				) : (
					<>
						{/* ゲームヘッダー */}
						{mode === 'timeattack' ? (
							<div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2">
								<TimeAttackTimer
									elapsedTime={timeAttackElapsedTime}
									penalty={timeAttackPenalty}
									isCompleted={cardIndex >= totalCards}
								/>
								<div className="flex items-center justify-around rounded-lg border border-[#C9A961] bg-[#0A1A35]/80 px-6 py-4 shadow-lg">
									<div className="flex items-center gap-2">
										<span className="text-base font-semibold text-[#C9A961]" style={SERIF}>
											進捗
										</span>
										<span className="text-lg font-bold text-[#F5E9C8] tabular-nums" style={SERIF}>
											{Math.min(cardIndex + 1, totalCards)} / {totalCards}
										</span>
									</div>
									<div className="flex items-center gap-2">
										<span className="text-base font-semibold text-[#C9A961]" style={SERIF}>
											ミス
										</span>
										<span className="text-lg font-bold text-[#F5E9C8] tabular-nums" style={SERIF}>
											{timeAttackMistakes}回
										</span>
									</div>
								</div>
							</div>
						) : (
							<header className="mb-6 flex items-center justify-between rounded-lg border border-[#C9A961] bg-[#0A1A35]/80 px-6 py-4 shadow-lg sm:px-8">
								<div className="flex items-center gap-2">
									<span className="text-base font-semibold text-[#C9A961]" style={SERIF}>
										進捗:
									</span>
									<span className="text-lg font-bold text-[#F5E9C8] tabular-nums" style={SERIF}>
										{Math.min(cardIndex + 1, totalCards)} / {totalCards}
									</span>
								</div>
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
										{formatClock(remainingTime)}
									</span>
								</div>
							</header>
						)}

						{/* あなた vs 相手の取得札カウンター */}
						<OpponentProgress
							myTaken={completedCardsCount}
							opponentTaken={opponentTaken}
							opponentLeft={opponentLeft}
						/>

						{/* 相手の準備待ちオーバーレイ */}
						{!gameStarted && !showCountdown && (
							<div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 backdrop-blur-sm">
								<div className="flex flex-col items-center gap-4 rounded-xl border border-[#C9A961] bg-[#0A1A35] px-10 py-8 text-center shadow-2xl">
									<LoaderCircle className="h-10 w-10 animate-spin text-[#E5C875]" />
									<p className="text-lg font-bold text-[#F5E9C8]" style={SERIF}>
										相手の準備を待っています…
									</p>
								</div>
							</div>
						)}

						{/* カウントダウンオーバーレイ（両者の ready が揃ってから開始） */}
						{showCountdown && <Countdown onComplete={handleCountdownComplete} duration={3} />}

						{/* 退出確認 */}
						<BattleExitConfirm
							show={showExitConfirm}
							onConfirm={confirmExit}
							onCancel={() => setShowExitConfirm(false)}
						/>

						{/* カード表示 */}
						{gameStarted && (
							<>
								{currentCard && displayHiragana ? (
									<CardDisplay
										card={currentCard}
										shake={showError}
										difficulty={BATTLE_DIFFICULTY}
									/>
								) : (
									<div className="mb-6 rounded-xl border-2 border-[#C9A961] bg-[#F5E9C8]/95 p-8 text-center">
										<p className="text-[#2A1F0F]" style={SERIF}>
											カードを読み込み中...
										</p>
									</div>
								)}

								{currentCard && (
									<div className="mb-6 flex flex-col items-center gap-2 rounded-lg border border-[#C9A961] bg-[#0A1A35]/80 px-6 py-5 shadow-lg">
										<InputHighlight
											text={parseHiraganaUnits(displayHiragana.replace(/\s/g, '')).join('')}
											inputStates={inputStates}
											currentPosition={completedHiraganaCount}
											showRomaji={true}
											romaji={romajiGuide}
											romajiStates={romajiStates}
											animateErrors={true}
											currentRomajiPosition={currentInput.length}
											difficulty={BATTLE_DIFFICULTY}
											showHint={false}
										/>
									</div>
								)}

								{/* ライブスコア（正確率 / コンボ / スコア） */}
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
										<p
											className="text-2xl font-extrabold text-[#F5E9C8] tabular-nums"
											style={SERIF}
										>
											{score.total || 0}
										</p>
									</div>
								</div>

								{/* コントロール（ポーズ・スキップなし。退出のみ） */}
								<div className="flex justify-center">
									<button
										onClick={() => setShowExitConfirm(true)}
										className="flex items-center gap-2.5 rounded-lg border border-[#E5453D] bg-[#C8302A] px-8 py-3.5 font-bold text-white shadow-md transition-colors hover:bg-[#A8261F]"
										style={SERIF}
									>
										<X className="h-[18px] w-[18px]" />
										退出
									</button>
								</div>
							</>
						)}
					</>
				)}
			</div>

			{/* 再戦のマッチング待機（リザルト画面の上に重ねる） */}
			<MatchingModal
				show={phase === 'matching'}
				passphrase={passphrase ?? ''}
				onCancel={() => {
					void battleStore.cancelMatching();
					router.visit('/');
				}}
			/>
		</main>
	);
}
