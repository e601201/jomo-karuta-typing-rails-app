/**
 * ローカルストレージサービス
 * ゲームデータの永続化を管理
 */

import type { KarutaCard } from '@/types/game';

// 型定義
export interface UserProfile {
	nickname: string;
	createdAt: string;
	lastPlayedAt: string;
	totalPlayTime: number; // ミリ秒
}

export interface GameProgress {
	completedCards: string[]; // カードID配列
	achievements: Achievement[];
}

export interface Achievement {
	id: string;
	unlockedAt: string;
}

export interface SavedSession {
	id: string;
	mode: string;
	startTime: string;
	cards: {
		current: Partial<KarutaCard> | null;
		currentIndex: number;
		remaining: unknown[];
		completed: unknown[];
	};
	score: {
		total: number;
		accuracy: number;
		speed: number;
		combo: number;
		maxCombo: number;
	};
	timer: {
		elapsedTime: number;
		pausedDuration: number;
	};
}

/**
 * saveSession が受け取りうる入力形状
 * SavedSession 互換のフラットな形状と、GameState 由来のネストした形状の両方を許容する
 */
export interface SaveSessionInput {
	id?: string;
	mode?: string;
	startTime?: string;
	cards?: Partial<SavedSession['cards']>;
	score?: SavedSession['score'];
	timer?: SavedSession['timer'];
	session?: {
		id?: string;
		mode?: string;
		startTime?: string;
	};
}

export interface GameStatistics {
	totalGames: number;
	totalCards: number;
	totalTime: number;
	averageAccuracy: number;
	averageSpeed: number;
	cardStats: {
		[cardId: string]: {
			attempts: number;
			completions: number;
			averageTime: number;
			averageMistakes: number;
		};
	};
}

// ストレージキー
// （ユーザー設定は settings-store が 'userSettings' キーで管理するため、ここでは扱わない）
const STORAGE_KEYS = {
	VERSION: 'jkt_version',
	PROFILE: 'jkt_profile',
	PROGRESS: 'jkt_progress',
	SESSION: 'jkt_session',
	STATISTICS: 'jkt_statistics'
} as const;

// 現在のバージョン
const CURRENT_VERSION = '1.0.0';

/**
 * ローカルストレージサービスクラス
 */
export class LocalStorageService {
	private memoryStorage: Map<string, string> = new Map();
	private useMemoryFallback = false;

	constructor() {
		// コンストラクタは軽量に保つ
	}

	/**
	 * サービスの初期化
	 */
	initialize(): void {
		// ストレージの利用可能性チェック
		if (!this.checkStorageAvailability()) {
			this.useMemoryFallback = true;
			console.warn('LocalStorage is not available. Using memory fallback.');
			return;
		}

		// バージョンチェックとマイグレーション
		const storedVersion = this.getItem(STORAGE_KEYS.VERSION);
		if (storedVersion && storedVersion !== CURRENT_VERSION) {
			this.migrate(storedVersion, CURRENT_VERSION);
		}

		// 現在のバージョンを保存
		this.setItem(STORAGE_KEYS.VERSION, CURRENT_VERSION);
	}

	/**
	 * ストレージが利用可能かチェック
	 */
	isStorageAvailable(): boolean {
		return !this.useMemoryFallback;
	}

	/**
	 * プロファイルを取得
	 */
	getProfile(): UserProfile | null {
		const stored = this.getItem(STORAGE_KEYS.PROFILE);
		if (!stored) {
			return null;
		}

		try {
			return JSON.parse(stored);
		} catch {
			return null;
		}
	}

	/**
	 * プロファイルを保存
	 */
	saveProfile(profile: Partial<UserProfile>): void {
		const current = this.getProfile();
		if (current && profile.totalPlayTime) {
			// プレイ時間を累積
			profile.totalPlayTime = (current.totalPlayTime || 0) + profile.totalPlayTime;
		}
		const merged = current ? { ...current, ...profile } : (profile as UserProfile);
		this.setItem(STORAGE_KEYS.PROFILE, JSON.stringify(merged));
	}

	/**
	 * 進捗を取得
	 */
	getProgress(): GameProgress {
		const stored = this.getItem(STORAGE_KEYS.PROGRESS);
		if (!stored) {
			return {
				completedCards: [],
				achievements: []
			};
		}

		try {
			return JSON.parse(stored);
		} catch {
			return {
				completedCards: [],
				achievements: []
			};
		}
	}

	/**
	 * 進捗を保存
	 */
	saveProgress(progress: Partial<GameProgress>): void {
		const current = this.getProgress();
		const merged = { ...current, ...progress };
		this.setItem(STORAGE_KEYS.PROGRESS, JSON.stringify(merged));
	}

	/**
	 * 完了した札を追加
	 */
	addCompletedCard(cardId: string): void {
		const progress = this.getProgress();
		if (!progress.completedCards.includes(cardId)) {
			progress.completedCards.push(cardId);
			this.saveProgress(progress);
		}
	}

	/**
	 * アチーブメントを解除
	 */
	unlockAchievement(achievementId: string): void {
		const progress = this.getProgress();
		const exists = progress.achievements.find((a) => a.id === achievementId);

		if (!exists) {
			progress.achievements.push({
				id: achievementId,
				unlockedAt: new Date().toISOString()
			});
			this.saveProgress(progress);
		}
	}

	/**
	 * セッションを保存
	 */
	saveSession(session: SaveSessionInput): void {
		// GameStateから必要な情報のみ抽出
		const savedSession: SavedSession = {
			id: (session.id || session.session?.id) as string,
			mode: (session.mode || session.session?.mode) as string,
			startTime: (session.startTime || session.session?.startTime) as string,
			cards: (session.cards as SavedSession['cards']) || {
				current: session.cards?.current ?? null,
				currentIndex: session.cards?.currentIndex || 0,
				remaining: session.cards?.remaining || [],
				completed: session.cards?.completed || []
			},
			score: session.score || {
				total: 0,
				accuracy: 100,
				speed: 0,
				combo: 0,
				maxCombo: 0
			},
			timer: session.timer || {
				elapsedTime: 0,
				pausedDuration: 0
			}
		};

		this.setItem(STORAGE_KEYS.SESSION, JSON.stringify(savedSession));
	}

	/**
	 * セッションを読み込み
	 */
	loadSession(): SavedSession | null {
		const stored = this.getItem(STORAGE_KEYS.SESSION);
		if (!stored) {
			return null;
		}

		try {
			return JSON.parse(stored);
		} catch {
			return null;
		}
	}

	/**
	 * セッションをクリア
	 */
	clearSession(): void {
		this.removeItem(STORAGE_KEYS.SESSION);
	}

	/**
	 * セッションが存在するか確認
	 */
	hasSession(): boolean {
		return this.getItem(STORAGE_KEYS.SESSION) !== null;
	}

	/**
	 * 統計を取得
	 */
	getStatistics(): GameStatistics {
		const stored = this.getItem(STORAGE_KEYS.STATISTICS);
		if (!stored) {
			return {
				totalGames: 0,
				totalCards: 0,
				totalTime: 0,
				averageAccuracy: 0,
				averageSpeed: 0,
				cardStats: {}
			};
		}

		try {
			return JSON.parse(stored);
		} catch {
			return {
				totalGames: 0,
				totalCards: 0,
				totalTime: 0,
				averageAccuracy: 0,
				averageSpeed: 0,
				cardStats: {}
			};
		}
	}

	/**
	 * 統計を更新
	 */
	updateStatistics(stats: Partial<GameStatistics>): void {
		const current = this.getStatistics();
		const merged = { ...current, ...stats };
		this.setItem(STORAGE_KEYS.STATISTICS, JSON.stringify(merged));
	}

	/**
	 * カード別統計を更新
	 */
	updateCardStats(
		cardId: string,
		data: {
			attempts?: number;
			completions?: number;
			averageTime?: number;
			averageMistakes?: number;
		}
	): void {
		const stats = this.getStatistics();
		stats.cardStats[cardId] = {
			...stats.cardStats[cardId],
			...data
		};
		this.updateStatistics(stats);
	}

	/**
	 * 統計をリセット
	 */
	resetStatistics(): void {
		this.setItem(
			STORAGE_KEYS.STATISTICS,
			JSON.stringify({
				totalGames: 0,
				totalCards: 0,
				totalTime: 0,
				averageAccuracy: 0,
				averageSpeed: 0,
				cardStats: {}
			})
		);
	}

	/**
	 * データをエクスポート
	 */
	exportData(): string {
		const data = {
			version: CURRENT_VERSION,
			profile: this.getProfile(),
			progress: this.getProgress(),
			session: this.loadSession(),
			statistics: this.getStatistics()
		};

		// Base64エンコード
		const jsonStr = JSON.stringify(data);
		// UTF-8文字列をBase64に変換
		if (typeof btoa !== 'undefined') {
			// UTF-8 → UTF-16 → Base64
			const utf16 = encodeURIComponent(jsonStr).replace(/%([0-9A-F]{2})/g, (_match, p1) =>
				String.fromCharCode(parseInt(p1, 16))
			);
			return btoa(utf16);
		}
		throw new Error('Base64 encoding not available');
	}

	/**
	 * データをインポート
	 */
	importData(encodedData: string): boolean {
		try {
			// Base64デコード
			let json: string;
			// Base64からUTF-8文字列に変換
			if (typeof atob !== 'undefined') {
				// Base64 → UTF-16 → UTF-8
				const utf16 = atob(encodedData);
				json = decodeURIComponent(
					utf16
						.split('')
						.map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
						.join('')
				);
			} else {
				throw new Error('Base64 decoding not available');
			}
			const data = JSON.parse(json);

			// バージョンチェック
			if (!data.version) {
				return false;
			}

			// データを復元
			if (data.profile) {
				this.setItem(STORAGE_KEYS.PROFILE, JSON.stringify(data.profile));
			}
			if (data.progress) {
				this.setItem(STORAGE_KEYS.PROGRESS, JSON.stringify(data.progress));
			}
			if (data.session) {
				this.setItem(STORAGE_KEYS.SESSION, JSON.stringify(data.session));
			}
			if (data.statistics) {
				this.setItem(STORAGE_KEYS.STATISTICS, JSON.stringify(data.statistics));
			}

			return true;
		} catch {
			return false;
		}
	}

	/**
	 * すべてのデータをクリア
	 */
	clearAllData(): void {
		if (this.useMemoryFallback) {
			this.memoryStorage.clear();
		} else {
			try {
				localStorage.clear();
			} catch {
				// エラーを無視
			}
		}
	}

	/**
	 * ストレージサイズを取得（バイト）
	 */
	getStorageSize(): number {
		let totalSize = 0;

		if (this.useMemoryFallback) {
			// メモリストレージのサイズを概算
			this.memoryStorage.forEach((value) => {
				totalSize += JSON.stringify(value).length * 2; // 文字列は2バイト/文字
			});
		} else {
			// LocalStorageのサイズを計算
			Object.values(STORAGE_KEYS).forEach((key) => {
				const value = this.getItem(key);
				if (value) {
					totalSize += key.length * 2 + value.length * 2;
				}
			});
		}

		return totalSize;
	}

	/**
	 * データマイグレーション
	 */
	private migrate(oldVersion: string, newVersion: string): void {
		// バージョンごとのマイグレーション処理
		// （旧 v0.9.0 → v1.0.0 の設定マイグレーションは設定管理の settings-store 移行に伴い削除）
		const [oldMajor, oldMinor, oldPatch] = oldVersion.split('.').map(Number);
		const [newMajor, newMinor, newPatch] = newVersion.split('.').map(Number);

		if (
			oldMajor > newMajor ||
			(oldMajor === newMajor && oldMinor > newMinor) ||
			(oldMajor === newMajor && oldMinor === newMinor && oldPatch > newPatch)
		) {
			// ダウングレードまたは不明なバージョン
			console.warn('Unknown or future version detected. Clearing all data.');
			this.clearAllData();
		}
	}

	/**
	 * ストレージの利用可能性をチェック
	 */
	private checkStorageAvailability(): boolean {
		if (typeof window === 'undefined' || !window.localStorage) {
			return false;
		}

		try {
			const testKey = '__localStorage_test__';
			localStorage.setItem(testKey, 'test');
			localStorage.removeItem(testKey);
			return true;
		} catch {
			return false;
		}
	}

	/**
	 * アイテムを取得（フォールバック対応）
	 */
	private getItem(key: string): string | null {
		if (this.useMemoryFallback) {
			return this.memoryStorage.get(key) || null;
		}

		try {
			return localStorage.getItem(key);
		} catch {
			return null;
		}
	}

	/**
	 * アイテムを設定（フォールバック対応）
	 */
	private setItem(key: string, value: string): void {
		if (this.useMemoryFallback) {
			this.memoryStorage.set(key, value);
			return;
		}

		try {
			localStorage.setItem(key, value);
		} catch (error) {
			if (error instanceof DOMException) {
				if (error.name === 'QuotaExceededError') {
					// 容量超過時の処理
					console.warn('Storage quota exceeded. Trying to free up space...');
					this.handleQuotaExceeded();
					// 再試行
					try {
						localStorage.setItem(key, value);
					} catch {
						// それでも失敗したらメモリにフォールバック
						this.useMemoryFallback = true;
						this.memoryStorage.set(key, value);
					}
				} else if (error.name === 'SecurityError') {
					// セキュリティエラー（プライベートモードなど）
					this.useMemoryFallback = true;
					this.memoryStorage.set(key, value);
				}
			}
		}
	}

	/**
	 * アイテムを削除（フォールバック対応）
	 */
	private removeItem(key: string): void {
		if (this.useMemoryFallback) {
			this.memoryStorage.delete(key);
			return;
		}

		try {
			localStorage.removeItem(key);
		} catch {
			// エラーを無視
		}
	}

	/**
	 * 容量超過時の処理
	 */
	private handleQuotaExceeded(): void {
		// 古いセッションデータを削除
		this.clearSession();

		// 統計データをコンパクト化
		const stats = this.getStatistics();
		if (Object.keys(stats.cardStats).length > 100) {
			// 古いカード統計を削除
			const sortedCards = Object.entries(stats.cardStats)
				.sort((a, b) => (b[1].attempts || 0) - (a[1].attempts || 0))
				.slice(0, 50);
			stats.cardStats = Object.fromEntries(sortedCards);
			this.updateStatistics(stats);
		}
	}
}
