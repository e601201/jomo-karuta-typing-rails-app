/**
 * ゲーム状態管理ストア（zustand 版）
 *
 * 旧リポジトリの Svelte ストア（src/lib/stores/game.ts）の移植。
 * ロジックは createStore（zustand/vanilla）上で動くため React の外からも操作できる。
 * タイマー・自動保存のインターバルはこのモジュール（ストアのクロージャ）が保持し、
 * React のエフェクトには置かない。
 */

import { createStore, type StoreApi } from 'zustand/vanilla';
import { useStore } from 'zustand';
import { InputValidator } from '@/lib/typing/input-validator';
import type { KarutaCard, GameMode, RandomModeDifficulty } from '@/types';
import { LocalStorageService } from '@/lib/storage/local-storage';
import { calcTypingScore } from '@/lib/game/score';
import { ImagePreloader } from '@/lib/image-preloader';

export interface GameSession {
	id: string;
	mode: GameMode;
	startTime: Date;
	endTime?: Date;
	isActive: boolean;
	totalCards: number;
	isManualExit?: boolean;
	difficulty?: RandomModeDifficulty; // ランダムモードの難易度
}

export interface CompletedCard {
	card: KarutaCard;
	time: number;
	mistakes: number;
	accuracy: number;
}

export interface GameScore {
	total: number;
	accuracy: number;
	speed: number;
	combo: number;
	maxCombo: number;
}

export interface GameTimer {
	startTime: Date | null;
	elapsedTime: number;
	cardStartTime: Date | null;
	cardElapsedTime: number;
	isPaused: boolean;
	pausedDuration: number;
	pauseStartTime: Date | null;
	pauseCount: number;
	totalPauseTime: number;
	timeLimit: number | null; // 制限時間（ミリ秒）
	remainingTime: number; // 残り時間（ミリ秒）
	// タイムアタック用
	penalty: number; // ペナルティ時間（ミリ秒）
	finalTime: number | null; // 最終タイム（実タイム＋ペナルティ）
}

export interface GameState {
	session: GameSession | null;
	cards: {
		current: KarutaCard | null;
		currentIndex: number;
		remaining: KarutaCard[];
		completed: CompletedCard[];
		wasSkipped?: boolean;
		// タイムアタック用
		allCards?: KarutaCard[]; // 全44枚の元カード
		selectedCards?: KarutaCard[]; // タイムアタックで選択された10枚
	};
	input: {
		current: string;
		position: number;
		mistakes: number;
		validator: InputValidator | null;
	};
	score: GameScore;
	timer: GameTimer;
	statistics: {
		totalKeystrokes: number;
		correctKeystrokes: number;
		mistakes: number;
		currentCombo: number;
		maxCombo: number;
		// タイムアタック用
		skips: number; // スキップ回数
	};
}

export interface GameProgress {
	completed: number;
	total: number;
	percentage: number;
}

export interface GameStatisticsSummary {
	wpm: number;
	accuracy: number;
	combo: number;
	maxCombo: number;
	totalKeystrokes: number;
	mistakes: number;
}

// 初期状態
const initialState: GameState = {
	session: null,
	cards: {
		current: null,
		currentIndex: 0,
		remaining: [],
		completed: []
	},
	input: {
		current: '',
		position: 0,
		mistakes: 0,
		validator: null
	},
	score: {
		total: 0,
		accuracy: 100,
		speed: 0,
		combo: 0,
		maxCombo: 0
	},
	timer: {
		startTime: null,
		elapsedTime: 0,
		cardStartTime: null,
		cardElapsedTime: 0,
		isPaused: false,
		pausedDuration: 0,
		pauseStartTime: null,
		pauseCount: 0,
		totalPauseTime: 0,
		timeLimit: null,
		remainingTime: 0,
		penalty: 0,
		finalTime: null
	},
	statistics: {
		totalKeystrokes: 0,
		correctKeystrokes: 0,
		mistakes: 0,
		currentCombo: 0,
		maxCombo: 0,
		skips: 0
	}
};

// セレクタ: 旧派生ストアと同じ計算値を返す純関数

// 旧 currentCardStore 相当: 現在のカード
export function selectCurrentCard(state: GameState): KarutaCard | null {
	return state.cards.current;
}

// 旧 progressStore 相当: 進捗
export function selectProgress(state: GameState): GameProgress {
	const total = state.session?.totalCards || 0;
	const completed = state.cards.completed.length;
	const percentage = total > 0 ? (completed / total) * 100 : 0;

	return {
		completed,
		total,
		percentage
	};
}

// 旧 scoreStore 相当: スコア
export function selectScore(state: GameState): GameScore {
	return state.score;
}

// 旧 statisticsStore 相当: 統計情報（練習モードと同様）
export function selectStatistics(state: GameState): GameStatisticsSummary {
	// WPM計算
	const elapsedMinutes = state.timer.elapsedTime / 60000;
	const words = state.statistics.correctKeystrokes / 5;
	const wpm = elapsedMinutes > 0 ? Math.round(words / elapsedMinutes) : 0;

	// 正確率計算
	const accuracy =
		state.statistics.totalKeystrokes > 0
			? Math.round((state.statistics.correctKeystrokes / state.statistics.totalKeystrokes) * 100)
			: 100;

	return {
		wpm,
		accuracy,
		combo: state.statistics.currentCombo,
		maxCombo: state.statistics.maxCombo,
		totalKeystrokes: state.statistics.totalKeystrokes,
		mistakes: state.statistics.mistakes
	};
}

// ゲームストアを作成
export function createGameStore() {
	// メインストア（zustand vanilla）
	const store: StoreApi<GameState> = createStore<GameState>(() => initialState);

	// 旧 svelte writable の update / set 相当のヘルパー
	// （update 関数は常に完全な GameState を返すため、replace で置き換える）
	function update(fn: (state: GameState) => GameState) {
		store.setState(fn(store.getState()), true);
	}

	function set(state: GameState) {
		store.setState(state, true);
	}

	// タイマー更新用のインターバル
	let timerInterval: ReturnType<typeof setInterval> | null = null;

	// 自動保存用のインターバル
	let autoSaveInterval: ReturnType<typeof setInterval> | null = null;

	// ストレージサービス
	let storageService: LocalStorageService | null = null;

	// セッション開始
	async function startSession(
		mode: GameMode,
		cards: KarutaCard[],
		difficulty?: RandomModeDifficulty
	) {
		if (cards.length === 0) return;

		let gameCards = [...cards];
		const allCards = cards; // 元の全カードを保持

		// モードごとの処理
		if (mode === 'random') {
			// ランダムモードの場合はカードをシャッフル
			gameCards = shuffleArray(gameCards);
		} else if (mode === 'timeattack') {
			// タイムアタックモードの場合は10枚をランダム選択
			const shuffled = shuffleArray([...cards]);
			gameCards = shuffled.slice(0, 10);
		}

		// 画像を優先度付きでプリロード（最初の5枚を優先）
		await ImagePreloader.preloadWithPriority(gameCards, 5);

		const sessionId = generateSessionId();
		const startTime = new Date();

		// 練習・特定札・タイムアタックは制限時間なし、それ以外（ランダム）は60秒
		const timeLimitTime = 60000;
		const timeLimit =
			mode === 'practice' || mode === 'specific' || mode === 'timeattack' ? null : timeLimitTime;

		update((state) => ({
			...state,
			session: {
				id: sessionId,
				mode,
				startTime,
				isActive: true,
				totalCards: gameCards.length,
				difficulty: mode === 'random' ? difficulty : undefined
			},
			cards: {
				current: gameCards[0],
				currentIndex: 0,
				remaining: gameCards.slice(1),
				completed: [],
				wasSkipped: false,
				allCards: mode === 'timeattack' ? allCards : undefined,
				selectedCards: mode === 'timeattack' ? gameCards : undefined
			},
			input: {
				current: '',
				position: 0,
				mistakes: 0,
				validator: new InputValidator()
			},
			score: {
				total: 0,
				accuracy: 100,
				speed: 0,
				combo: 0,
				maxCombo: 0
			},
			timer: {
				startTime,
				elapsedTime: 0,
				cardStartTime: startTime,
				cardElapsedTime: 0,
				isPaused: false,
				pausedDuration: 0,
				pauseStartTime: null,
				pauseCount: 0,
				totalPauseTime: 0,
				timeLimit,
				remainingTime: timeLimit || 0,
				penalty: 0,
				finalTime: null
			},
			statistics: {
				totalKeystrokes: 0,
				correctKeystrokes: 0,
				mistakes: 0,
				currentCombo: 0,
				maxCombo: 0,
				skips: 0
			}
		}));

		// InputValidatorにターゲットを設定（スペースを除去）
		const state = store.getState();
		if (state.input.validator && state.cards.current) {
			// 初心者モードの場合はhiraganaShortを使用
			const hiraganaText =
				difficulty === 'beginner' && state.cards.current.hiraganaShort
					? state.cards.current.hiraganaShort
					: state.cards.current.hiragana;
			const targetText = hiraganaText.replace(/\s/g, '');
			state.input.validator.setTarget(targetText);
		}

		// タイマーはカウントダウン後に開始されるため、ここでは開始しない

		// LocalStorageServiceを初期化
		storageService = new LocalStorageService();

		// 自動保存を開始（練習モード以外でも5秒ごとに保存）
		startAutoSave();
	}

	// スキップ（完了扱いにしない）
	function skipCard() {
		const state = store.getState();

		// セッション未開始またはカードがない場合は何もしない
		if (!state.session?.isActive || !state.cards.current) {
			return;
		}

		// タイムアタックモードの場合はペナルティを追加
		if (state.session.mode === 'timeattack') {
			update((s) => ({
				...s,
				timer: {
					...s.timer,
					penalty: s.timer.penalty + 10000 // 10秒のペナルティ
				},
				statistics: {
					...s.statistics,
					skips: s.statistics.skips + 1
				}
			}));
		}

		// データ不整合の検出と修正
		if (state.cards.currentIndex >= state.session.totalCards) {
			// インデックスが範囲外の場合は修正
			console.warn(
				`Data inconsistency detected: currentIndex (${state.cards.currentIndex}) >= totalCards (${state.session.totalCards})`
			);
			endSession();
			return;
		}

		update((s) => {
			// 全てのカードが処理された場合
			if (s.cards.remaining.length === 0) {
				console.log('All cards processed. Ending session.');
				return {
					...s,
					session: {
						...s.session!,
						isActive: false,
						endTime: new Date()
					}
				};
			}

			const nextCard = s.cards.remaining[0];
			const newIndex = s.cards.currentIndex + 1;

			// InputValidatorに新しいターゲットを設定（スペースを除去）
			if (s.input.validator && nextCard) {
				// 初心者モードの場合はhiraganaShortを使用
				const hiraganaText =
					s.session?.difficulty === 'beginner' && nextCard.hiraganaShort
						? nextCard.hiraganaShort
						: nextCard.hiragana;
				const targetText = hiraganaText.replace(/\s/g, '');
				s.input.validator.setTarget(targetText);
			}

			// スキップした場合はcompleted配列に追加しない
			return {
				...s,
				cards: {
					current: nextCard,
					currentIndex: newIndex,
					remaining: s.cards.remaining.slice(1),
					completed: s.cards.completed, // そのまま維持
					wasSkipped: true // スキップフラグを追加
				},
				input: {
					...s.input,
					current: '',
					position: 0,
					mistakes: 0
				},
				timer: {
					...s.timer,
					cardStartTime: new Date()
				}
			};
		});
	}

	// 次のカードへ
	function nextCard() {
		const state = store.getState();

		// セッション未開始またはカードがない場合は何もしない
		if (!state.session?.isActive || !state.cards.current) {
			return;
		}

		// データ不整合の検出と修正
		if (state.cards.currentIndex >= state.session.totalCards) {
			// インデックスが範囲外の場合は修正
			update((s) => ({
				...s,
				cards: {
					...s.cards,
					currentIndex: Math.max(
						0,
						Math.min(s.session?.totalCards ? s.session.totalCards - 1 : 0, s.cards.currentIndex)
					)
				}
			}));
			return;
		}

		// インデックスの範囲チェックと修正
		if (
			state.cards.currentIndex >= state.session.totalCards - 1 &&
			state.cards.remaining.length === 0
		) {
			// すでに最後のカードの場合は終了
			endSession();
			return;
		}

		// 現在のカードを完了済みに追加
		const cardTime =
			state.timer.cardElapsedTime ||
			Date.now() - (state.timer.cardStartTime?.getTime() || Date.now());

		const completedCard: CompletedCard = {
			card: state.cards.current,
			time: cardTime,
			mistakes: state.input.mistakes,
			accuracy: calculateAccuracy(state.input.position, state.input.mistakes)
		};

		update((s) => {
			const newCompleted = [...s.cards.completed, completedCard];

			// 履歴を最大100件に制限
			if (newCompleted.length > 100) {
				newCompleted.shift();
			}

			// 次のカードがあるか確認
			if (s.cards.remaining.length === 0) {
				// ゲーム終了 - 完了済みリストを更新してから終了
				const finalState = {
					...s,
					cards: {
						...s.cards,
						completed: newCompleted
					}
				};
				setTimeout(() => endSession(), 0); // 非同期で終了処理
				return finalState;
			}

			const nextCard = s.cards.remaining[0];
			const newIndex = s.cards.currentIndex + 1;

			// InputValidatorに新しいターゲットを設定（スペースを除去）
			if (s.input.validator && nextCard) {
				// 初心者モードの場合はhiraganaShortを使用
				const hiraganaText =
					s.session?.difficulty === 'beginner' && nextCard.hiraganaShort
						? nextCard.hiraganaShort
						: nextCard.hiragana;
				const targetText = hiraganaText.replace(/\s/g, '');
				s.input.validator.setTarget(targetText);
			}

			return {
				...s,
				cards: {
					current: nextCard,
					currentIndex: newIndex,
					remaining: s.cards.remaining.slice(1),
					completed: newCompleted,
					wasSkipped: false // 正常完了フラグ
				},
				input: {
					...s.input,
					current: '',
					position: 0,
					mistakes: 0
				},
				timer: {
					...s.timer,
					cardStartTime: new Date(),
					cardElapsedTime: 0
				}
			};
		});
	}

	// カード完了
	function completeCard() {
		// コンボ更新はprocessKeystrokeで行うため、ここでは不要
		// 次のカードへ進むだけ
		nextCard();
	}

	// キーストロークを処理（練習モードと同様の実装）
	function processKeystroke(isCorrect: boolean) {
		update((state) => {
			const newState = { ...state };
			newState.statistics = { ...state.statistics };
			newState.score = { ...state.score };

			newState.statistics.totalKeystrokes++;

			if (isCorrect) {
				newState.statistics.correctKeystrokes++;
				newState.statistics.currentCombo++;
				newState.statistics.maxCombo = Math.max(
					newState.statistics.maxCombo,
					newState.statistics.currentCombo
				);
			} else {
				newState.statistics.mistakes++;
				newState.statistics.currentCombo = 0;
			}

			// スコアも更新
			newState.score.combo = newState.statistics.currentCombo;
			newState.score.maxCombo = newState.statistics.maxCombo;

			return newState;
		});
	}

	// 入力更新
	function updateInput(input: string) {
		const state = store.getState();

		// セッション未開始または無効な状態
		if (!state.session?.isActive || !state.input.validator || !state.cards.current) {
			return;
		}

		// 前回の入力との差分を検出
		const previousInput = state.input.current;
		const inputDiff = input.length - previousInput.length;

		// 入力検証（スペースを除去してから検証）
		// 初心者モードの場合はhiraganaShortを使用
		const hiraganaText =
			state.session.difficulty === 'beginner' && state.cards.current.hiraganaShort
				? state.cards.current.hiraganaShort
				: state.cards.current.hiragana;
		const targetText = hiraganaText.replace(/\s/g, '');
		const result = state.input.validator.validateInput(targetText, input);

		// 新しい文字が入力された場合のみキーストロークを処理
		if (inputDiff > 0) {
			// 新しく入力された各文字に対してキーストローク処理
			for (let i = 0; i < inputDiff; i++) {
				// 入力が正しいかどうかを判定
				processKeystroke(result.isValid);
			}
		}
		// バックスペースの場合は処理しない

		if (result.isValid) {
			// 正しい入力
			update((s) => ({
				...s,
				input: {
					...s.input,
					current: input,
					position: input.length
				}
			}));

			// 完全一致の場合は次へ
			if (result.progress === 1) {
				completeCard();
			}
		} else if (inputDiff > 0) {
			// 誤入力の場合（新しい入力があった場合のみ）
			update((s) => ({
				...s,
				input: {
					...s.input,
					mistakes: s.input.mistakes + inputDiff
					// currentは更新しない（誤入力を受け付けない）
				}
			}));
			// 誤入力でも processKeystroke で totalKeystrokes / mistakes が増えるため、
			// ライブ正確率（score.accuracy）を即時再計算する（#37）。早期 return すると
			// 末尾の updateScore() に到達せず、次の正打まで accuracy が陳腐化していた。
			// コンボの即時 0 リセットは processKeystroke 側で完了している。
			updateScore();
			return previousInput; // UI側で処理が必要
		}

		// 正確率とスピードを更新
		updateScore();
	}

	// スコア更新（WPM計算に変更）
	function updateScore() {
		update((state) => {
			// 精度（0..1）
			const accuracy =
				state.statistics.totalKeystrokes > 0
					? state.statistics.correctKeystrokes / state.statistics.totalKeystrokes
					: 1;

			// WPM（5文字=1語）
			const elapsedMinutes = state.timer.elapsedTime / 60000;
			const words = state.statistics.correctKeystrokes / 5;
			const wpm = elapsedMinutes > 0 ? Math.round(words / elapsedMinutes) : 0;

			// Q: 解いた（完了した）札数
			const Q = state.cards.completed.length;

			const total = calcTypingScore(
				{
					Q,
					accuracy,
					wpm,
					maxCombo: state.statistics.maxCombo
				},
				state.session?.difficulty
			);

			return {
				...state,
				score: {
					...state.score,
					total,
					accuracy: accuracy * 100,
					speed: wpm,
					combo: state.statistics.currentCombo,
					maxCombo: state.statistics.maxCombo
				}
			};
		});
	}

	// セッションを保存
	function saveSession() {
		const state = store.getState();
		if (!storageService || !state.session?.isActive || !state.timer.startTime) return;

		const elapsedTime = state.timer.elapsedTime;
		const accuracy =
			state.statistics.totalKeystrokes > 0
				? state.statistics.correctKeystrokes / state.statistics.totalKeystrokes
				: 1;

		// WPM計算
		const elapsedMinutes = elapsedTime / 60000;
		const words = state.statistics.correctKeystrokes / 5;
		const wpm = elapsedMinutes > 0 ? Math.round(words / elapsedMinutes) : 0;

		const total = calcTypingScore(
			{
				Q: state.cards.completed.length,
				accuracy,
				wpm,
				maxCombo: state.statistics.maxCombo
			},
			state.session?.difficulty
		);

		const session = {
			id: state.session.id,
			mode: state.session.mode,
			startTime: state.timer.startTime.toISOString(),
			cards: {
				current: state.cards.current,
				currentIndex: state.cards.currentIndex,
				remaining: state.cards.remaining,
				completed: state.cards.completed
			},
			score: {
				total,
				accuracy: accuracy * 100,
				speed: wpm,
				combo: state.statistics.currentCombo,
				maxCombo: state.statistics.maxCombo
			},
			timer: {
				elapsedTime,
				pausedDuration: state.timer.totalPauseTime
			}
		};

		try {
			storageService.saveSession(session);
		} catch (error) {
			console.warn('Failed to save session:', error);
		}
	}

	// 自動保存を開始
	function startAutoSave() {
		stopAutoSave();
		autoSaveInterval = setInterval(() => {
			saveSession();
		}, 5000); // 5秒ごとに保存
	}

	// 自動保存を停止
	function stopAutoSave() {
		if (autoSaveInterval) {
			clearInterval(autoSaveInterval);
			autoSaveInterval = null;
		}
	}

	// 一時停止
	function pauseGame() {
		update((state) => ({
			...state,
			timer: {
				...state.timer,
				isPaused: true,
				pauseStartTime: new Date(),
				pauseCount: state.timer.pauseCount + 1
			}
		}));

		// タイマー停止
		if (timerInterval) {
			clearInterval(timerInterval);
			timerInterval = null;
		}

		// 自動保存も停止
		stopAutoSave();
	}

	// 再開
	function resumeGame() {
		const state = store.getState();

		if (!state.timer.isPaused || !state.timer.pauseStartTime) {
			return;
		}

		const pauseDuration = Date.now() - state.timer.pauseStartTime.getTime();

		update((s) => ({
			...s,
			timer: {
				...s.timer,
				isPaused: false,
				pausedDuration: s.timer.pausedDuration + pauseDuration,
				totalPauseTime: s.timer.totalPauseTime + pauseDuration,
				pauseStartTime: null
			}
		}));

		// タイマー再開
		startTimer();

		// 自動保存再開
		startAutoSave();
	}

	// セッション終了
	function endSession(isManualExit = false) {
		const state = store.getState();

		if (!state.session) return;

		// タイムアタックモードの場合は最終タイムを計算
		let finalTime = null;
		if (state.session.mode === 'timeattack' && !isManualExit) {
			finalTime = state.timer.elapsedTime + state.timer.penalty;
		}

		// 最後にセッションを保存
		saveSession();

		update((s) => ({
			...s,
			session: s.session
				? {
						...s.session,
						endTime: new Date(),
						isActive: false,
						isManualExit
					}
				: null,
			timer: {
				...s.timer,
				isPaused: false,
				finalTime: finalTime
			}
		}));

		// タイマー停止
		if (timerInterval) {
			clearInterval(timerInterval);
			timerInterval = null;
		}

		// 自動保存停止
		stopAutoSave();

		// LocalStorageのセッションをクリア
		if (storageService) {
			storageService.clearSession();
		}
	}

	// セッションリセット
	function resetSession() {
		// タイマー停止
		if (timerInterval) {
			clearInterval(timerInterval);
			timerInterval = null;
		}

		// 自動保存停止
		stopAutoSave();

		set(initialState);
	}

	// タイマー更新
	function updateTimer() {
		const state = store.getState();

		if (!state.session?.isActive || state.timer.isPaused) {
			return;
		}

		const now = Date.now();
		const startTime = state.timer.startTime?.getTime() || now;
		const cardStartTime = state.timer.cardStartTime?.getTime() || now;
		const elapsedTime = now - startTime - state.timer.pausedDuration;

		// 制限時間がある場合は残り時間を計算
		let remainingTime = 0;
		if (state.timer.timeLimit !== null) {
			remainingTime = Math.max(0, state.timer.timeLimit - elapsedTime);

			// 時間切れの場合はゲーム終了
			if (remainingTime === 0 && state.session.isActive) {
				endSession();
				return;
			}
		}

		update((s) => ({
			...s,
			timer: {
				...s.timer,
				elapsedTime: elapsedTime,
				cardElapsedTime: now - cardStartTime,
				remainingTime: remainingTime
			}
		}));
	}

	// タイマー開始
	function startTimer() {
		if (timerInterval) {
			clearInterval(timerInterval);
		}

		timerInterval = setInterval(() => {
			updateTimer();
		}, 100);
	}

	// ゲーム実際の開始（カウントダウン後）
	function startGameAfterCountdown() {
		const state = store.getState();

		if (!state.session?.isActive) {
			return;
		}

		// 開始時刻をリセット（カウントダウン後の現在時刻に）
		const now = new Date();
		update((s) => ({
			...s,
			timer: {
				...s.timer,
				startTime: now,
				cardStartTime: now,
				elapsedTime: 0,
				cardElapsedTime: 0
			}
		}));

		// タイマー開始
		startTimer();

		// 自動保存もここで開始（カウントダウン後）
		startAutoSave();
	}

	// ユーティリティ関数
	function generateSessionId(): string {
		return `session-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
	}

	function shuffleArray<T>(array: T[]): T[] {
		const arr = [...array];
		for (let i = arr.length - 1; i > 0; i--) {
			const j = Math.floor(Math.random() * (i + 1));
			[arr[i], arr[j]] = [arr[j], arr[i]];
		}
		return arr;
	}

	function calculateAccuracy(correct: number, mistakes: number): number {
		const total = correct + mistakes;
		if (total === 0) return 100;
		return Math.round((correct / total) * 1000) / 10;
	}

	// WPMを計算
	function calculateWPM(): number {
		const state = store.getState();
		if (!state.timer.startTime) return 0;

		const elapsedMinutes = state.timer.elapsedTime / 60000;
		if (elapsedMinutes <= 0) return 0;

		const words = state.statistics.correctKeystrokes / 5; // 5文字を1単語と仮定
		return Math.round(words / elapsedMinutes);
	}

	// 正確率を計算（キーストロークベース）
	function calculateKeystrokeAccuracy(): number {
		const state = store.getState();
		if (state.statistics.totalKeystrokes === 0) return 100;

		return Math.round(
			(state.statistics.correctKeystrokes / state.statistics.totalKeystrokes) * 100
		);
	}

	// クリーンアップ
	function destroy() {
		if (timerInterval) {
			clearInterval(timerInterval);
			timerInterval = null;
		}

		// 自動保存も停止
		stopAutoSave();
	}

	return {
		// vanilla StoreApi（getState/setState/subscribe）
		store,
		// 旧 svelte writable 相当のハンドル（テストの機械的変換用）
		gameStore: {
			getState: store.getState,
			setState: store.setState,
			subscribe: store.subscribe,
			set,
			update
		},
		startSession,
		nextCard,
		skipCard,
		completeCard,
		updateInput,
		processKeystroke,
		pauseGame,
		resumeGame,
		endSession,
		resetSession,
		updateTimer,
		startGameAfterCountdown,
		saveSession,
		startAutoSave,
		stopAutoSave,
		calculateWPM,
		calculateKeystrokeAccuracy,
		destroy
	};
}

// Export singleton instance
const storeInstance = createGameStore();

// vanilla StoreApi（React 外からの getState / setState / subscribe 用）
export const gameStoreApi: StoreApi<GameState> = storeInstance.store;

// 旧公開シングルトンと同じ形の API を保持したオブジェクト
// NOTE: subscribe は zustand のセマンティクス — svelte store と異なり、
// 購読時にリスナーが即時呼び出しされることは「ない」（状態変化時のみ呼ばれる）。
export const gameStore = {
	...storeInstance,
	getState: gameStoreApi.getState,
	subscribe: gameStoreApi.subscribe,
	set: storeInstance.gameStore.set,
	update: storeInstance.gameStore.update
};

// React コンポーネント用フック（セレクタで購読範囲を絞る）
export function useGameStore<T>(selector: (state: GameState) => T): T {
	return useStore(gameStoreApi, selector);
}
