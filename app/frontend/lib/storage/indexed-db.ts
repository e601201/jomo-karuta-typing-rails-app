/**
 * IndexedDBサービス
 * Dexie.jsを使用した大容量データの永続化
 */

import Dexie, { type Table } from 'dexie';

// 型定義
export interface GameHistory {
	id?: number;
	sessionId: string;
	mode: 'practice' | 'specific' | 'random';
	startTime: Date;
	endTime: Date;
	cards: CardResult[];
	score: {
		total: number;
		accuracy: number;
		speed: number;
		maxCombo: number;
	};
	settings: Record<string, unknown>; // GameSettings型をインポートする代わりに簡略化
}

export interface CardResult {
	cardId: string;
	startTime: Date;
	endTime: Date;
	inputHistory: InputEvent[];
	mistakes: number;
	wpm: number;
	accuracy: number;
}

export interface InputEvent {
	timestamp: Date;
	input: string;
	expected: string;
	correct: boolean;
	position: number;
}

export interface DetailedStats {
	id?: number;
	date: Date;
	dailyStats: {
		gamesPlayed: number;
		cardsCompleted: number;
		totalTime: number;
		averageAccuracy: number;
		averageSpeed: number;
		bestScore: number;
	};
	weeklyAggregates?: WeeklyStats;
	monthlyAggregates?: MonthlyStats;
}

export interface WeeklyStats {
	totalGames: number;
	totalCards: number;
	totalTime: number;
	averageAccuracy: number;
	averageSpeed: number;
	bestScore: number;
}

export interface MonthlyStats {
	totalGames: number;
	totalCards: number;
	totalTime: number;
	averageAccuracy: number;
	averageSpeed: number;
	bestScore: number;
	averageDailyGames: number;
}

export interface CardHistory {
	id?: number;
	cardId: string;
	attempts: AttemptRecord[];
	bestTime: number;
	bestAccuracy: number;
	lastAttempt: Date;
}

export interface AttemptRecord {
	date: Date;
	time: number;
	accuracy: number;
	mistakes: number;
	wpm: number;
}

export interface SearchQuery {
	mode?: string;
	startDate?: Date;
	endDate?: Date;
	minScore?: number;
}

export interface StatsSummary {
	totalGames: number;
	averageScore: number;
	bestScore: number;
	totalPlayTime: number;
	averageAccuracy: number;
}

export interface AchievementProgress {
	id: string;
	name: string;
	description: string;
	progress: number;
	target: number;
	unlocked: boolean;
}

// お気に入り型定義
export interface FavoriteData {
	id: string;
	name: string;
	cardIds: string[];
	createdAt: string;
	updatedAt?: string;
}

// Dexieデータベースクラス
class JomoKarutaDB extends Dexie {
	gameHistory!: Table<GameHistory>;
	detailedStats!: Table<DetailedStats>;
	cardHistory!: Table<CardHistory>;
	favorites!: Table<FavoriteData>;

	constructor() {
		super('JomoKarutaDB');

		// スキーマ定義（バージョン1）
		this.version(1).stores({
			gameHistory: '++id, sessionId, mode, startTime, [mode+startTime]',
			detailedStats: '++id, date',
			cardHistory: '++id, cardId, bestTime, bestAccuracy, lastAttempt'
		});

		// バージョン2: お気に入り追加
		this.version(2).stores({
			gameHistory: '++id, sessionId, mode, startTime, [mode+startTime]',
			detailedStats: '++id, date',
			cardHistory: '++id, cardId, bestTime, bestAccuracy, lastAttempt',
			favorites: 'id, name, createdAt'
		});
	}
}

/**
 * IndexedDBサービスクラス
 */
export class IndexedDBService {
	private db: JomoKarutaDB;
	private initialized = false;

	constructor() {
		this.db = new JomoKarutaDB();
	}

	/**
	 * データベースを初期化
	 */
	async initialize(): Promise<void> {
		try {
			await this.db.open();
			this.initialized = true;
		} catch (error) {
			console.error('Failed to initialize IndexedDB:', error);
			throw new Error('IndexedDB is not available', { cause: error });
		}
	}

	/**
	 * 初期化状態を確認
	 */
	isInitialized(): boolean {
		return this.initialized;
	}

	/**
	 * ゲーム履歴を保存
	 */
	async saveGameHistory(history: GameHistory): Promise<number> {
		this.ensureInitialized();

		// データ検証
		if (!history.sessionId || !history.mode) {
			throw new Error('Invalid game history data');
		}

		return await this.db.gameHistory.add(history);
	}

	/**
	 * ゲーム履歴を取得
	 */
	async getGameHistory(limit = 100, offset = 0): Promise<GameHistory[]> {
		this.ensureInitialized();

		return await this.db.gameHistory
			.orderBy('startTime')
			.reverse()
			.offset(offset)
			.limit(limit)
			.toArray();
	}

	/**
	 * モードで履歴をフィルタリング
	 */
	async getGameHistoryByMode(mode: string): Promise<GameHistory[]> {
		this.ensureInitialized();

		return await this.db.gameHistory.where('mode').equals(mode).toArray();
	}

	/**
	 * 古い履歴を削除
	 */
	async deleteOldHistory(daysToKeep: number): Promise<void> {
		this.ensureInitialized();

		const cutoffDate = new Date(Date.now() - daysToKeep * 24 * 60 * 60 * 1000);

		await this.db.gameHistory.where('startTime').below(cutoffDate).delete();
	}

	/**
	 * 日次統計を保存
	 */
	async saveDailyStats(stats: DetailedStats): Promise<void> {
		this.ensureInitialized();

		// 既存のデータがあれば更新、なければ追加
		const existing = await this.db.detailedStats.where('date').equals(stats.date).first();

		if (existing) {
			await this.db.detailedStats.update(existing.id!, stats);
		} else {
			await this.db.detailedStats.add(stats);
		}
	}

	/**
	 * 日次統計を取得
	 */
	async getDailyStats(date: Date): Promise<DetailedStats | null> {
		this.ensureInitialized();

		const stats = await this.db.detailedStats.where('date').equals(date).first();
		return stats || null;
	}

	/**
	 * 期間指定で統計を取得
	 */
	async getStatsRange(startDate: Date, endDate: Date): Promise<DetailedStats[]> {
		this.ensureInitialized();

		return await this.db.detailedStats
			.where('date')
			.between(startDate, endDate, true, true)
			.toArray();
	}

	/**
	 * 週次集計を計算
	 */
	async aggregateWeeklyStats(weekStart: Date): Promise<WeeklyStats> {
		this.ensureInitialized();

		const weekEnd = new Date(weekStart);
		weekEnd.setDate(weekEnd.getDate() + 6);

		const stats = await this.getStatsRange(weekStart, weekEnd);

		const aggregated: WeeklyStats = {
			totalGames: 0,
			totalCards: 0,
			totalTime: 0,
			averageAccuracy: 0,
			averageSpeed: 0,
			bestScore: 0
		};

		if (stats.length === 0) {
			return aggregated;
		}

		let totalAccuracy = 0;
		let totalSpeed = 0;

		stats.forEach((s) => {
			aggregated.totalGames += s.dailyStats.gamesPlayed;
			aggregated.totalCards += s.dailyStats.cardsCompleted;
			aggregated.totalTime += s.dailyStats.totalTime;
			totalAccuracy += s.dailyStats.averageAccuracy * s.dailyStats.gamesPlayed;
			totalSpeed += s.dailyStats.averageSpeed * s.dailyStats.gamesPlayed;
			aggregated.bestScore = Math.max(aggregated.bestScore, s.dailyStats.bestScore);
		});

		aggregated.averageAccuracy = totalAccuracy / aggregated.totalGames;
		aggregated.averageSpeed = totalSpeed / aggregated.totalGames;

		return aggregated;
	}

	/**
	 * 月次集計を計算
	 */
	async aggregateMonthlyStats(month: Date): Promise<MonthlyStats> {
		this.ensureInitialized();

		const monthStart = new Date(month.getFullYear(), month.getMonth(), 1);
		const monthEnd = new Date(month.getFullYear(), month.getMonth() + 1, 0);

		const stats = await this.getStatsRange(monthStart, monthEnd);

		const aggregated: MonthlyStats = {
			totalGames: 0,
			totalCards: 0,
			totalTime: 0,
			averageAccuracy: 0,
			averageSpeed: 0,
			bestScore: 0,
			averageDailyGames: 0
		};

		if (stats.length === 0) {
			return aggregated;
		}

		let totalAccuracy = 0;
		let totalSpeed = 0;

		stats.forEach((s) => {
			aggregated.totalGames += s.dailyStats.gamesPlayed;
			aggregated.totalCards += s.dailyStats.cardsCompleted;
			aggregated.totalTime += s.dailyStats.totalTime;
			totalAccuracy += s.dailyStats.averageAccuracy * s.dailyStats.gamesPlayed;
			totalSpeed += s.dailyStats.averageSpeed * s.dailyStats.gamesPlayed;
			aggregated.bestScore = Math.max(aggregated.bestScore, s.dailyStats.bestScore);
		});

		aggregated.averageAccuracy = totalAccuracy / aggregated.totalGames;
		aggregated.averageSpeed = totalSpeed / aggregated.totalGames;
		aggregated.averageDailyGames = aggregated.totalGames / stats.length;

		return aggregated;
	}

	/**
	 * カードの挑戦記録を保存
	 */
	async saveCardAttempt(cardId: string, attempt: AttemptRecord): Promise<void> {
		this.ensureInitialized();

		// 既存の履歴を取得
		const history = await this.db.cardHistory.where('cardId').equals(cardId).first();

		if (history) {
			// 履歴に追加
			history.attempts.push(attempt);

			// 最新100件のみ保持
			if (history.attempts.length > 100) {
				history.attempts = history.attempts.slice(-100);
			}

			// ベスト記録を更新
			history.bestTime = Math.min(history.bestTime, attempt.time);
			history.bestAccuracy = Math.max(history.bestAccuracy, attempt.accuracy);
			history.lastAttempt = attempt.date;

			await this.db.cardHistory.update(history.id!, {
				attempts: history.attempts,
				bestTime: history.bestTime,
				bestAccuracy: history.bestAccuracy,
				lastAttempt: history.lastAttempt
			});
		} else {
			// 新規作成
			await this.db.cardHistory.add({
				cardId,
				attempts: [attempt],
				bestTime: attempt.time,
				bestAccuracy: attempt.accuracy,
				lastAttempt: attempt.date
			});
		}
	}

	/**
	 * カード履歴を取得
	 */
	async getCardHistory(cardId: string): Promise<CardHistory | null> {
		this.ensureInitialized();

		const history = await this.db.cardHistory.where('cardId').equals(cardId).first();
		return history || null;
	}

	/**
	 * 上位カードを取得
	 */
	async getTopCards(limit: number): Promise<CardHistory[]> {
		this.ensureInitialized();

		return await this.db.cardHistory.orderBy('bestTime').limit(limit).toArray();
	}

	/**
	 * 苦手カードを特定
	 */
	async getStruggleCards(limit: number): Promise<CardHistory[]> {
		this.ensureInitialized();

		return await this.db.cardHistory.orderBy('bestAccuracy').limit(limit).toArray();
	}

	/**
	 * データベースをエクスポート
	 */
	async exportDatabase(): Promise<Blob> {
		this.ensureInitialized();

		const data = {
			gameHistory: await this.db.gameHistory.toArray(),
			detailedStats: await this.db.detailedStats.toArray(),
			cardHistory: await this.db.cardHistory.toArray(),
			version: 1,
			exportDate: new Date()
		};

		const json = JSON.stringify(data);
		return new Blob([json], { type: 'application/json' });
	}

	/**
	 * データベースをインポート
	 */
	async importDatabase(blob: Blob): Promise<void> {
		this.ensureInitialized();

		const text = await blob.text();
		const data = JSON.parse(text);

		// データ検証
		if (!data.version || !data.gameHistory) {
			throw new Error('Invalid import data');
		}

		// トランザクションで一括インポート
		await this.db.transaction(
			'rw',
			this.db.gameHistory,
			this.db.detailedStats,
			this.db.cardHistory,
			async () => {
				// 既存データをクリア
				await this.clearDatabase();

				// データを復元
				if (data.gameHistory) {
					await this.db.gameHistory.bulkAdd(data.gameHistory);
				}
				if (data.detailedStats) {
					await this.db.detailedStats.bulkAdd(data.detailedStats);
				}
				if (data.cardHistory) {
					await this.db.cardHistory.bulkAdd(data.cardHistory);
				}
			}
		);
	}

	/**
	 * データベースをクリア
	 */
	async clearDatabase(): Promise<void> {
		if (!this.initialized) {
			await this.initialize();
		}

		await this.db.gameHistory.clear();
		await this.db.detailedStats.clear();
		await this.db.cardHistory.clear();
	}

	/**
	 * データベースサイズを取得
	 */
	async getDatabaseSize(): Promise<number> {
		this.ensureInitialized();

		// 各テーブルのレコード数から概算
		const gameHistoryCount = await this.db.gameHistory.count();
		const statsCount = await this.db.detailedStats.count();
		const cardHistoryCount = await this.db.cardHistory.count();

		// 1レコードあたりの平均サイズを仮定（バイト）
		const avgGameHistorySize = 2000;
		const avgStatsSize = 500;
		const avgCardHistorySize = 1000;

		return (
			gameHistoryCount * avgGameHistorySize +
			statsCount * avgStatsSize +
			cardHistoryCount * avgCardHistorySize
		);
	}

	/**
	 * 不要データを削除（vacuum）
	 */
	async vacuum(): Promise<void> {
		this.ensureInitialized();

		// 90日以上前のゲーム履歴を削除
		await this.deleteOldHistory(90);

		// 30日以上前の日次統計を削除（集計データは保持）
		const cutoffDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
		await this.db.detailedStats
			.where('date')
			.below(cutoffDate)
			.and((item) => !item.weeklyAggregates && !item.monthlyAggregates)
			.delete();

		// カード履歴の古い挑戦記録を整理
		const cardHistories = await this.db.cardHistory.toArray();
		for (const history of cardHistories) {
			if (history.attempts.length > 100) {
				history.attempts = history.attempts.slice(-100);
				await this.db.cardHistory.update(history.id!, {
					attempts: history.attempts,
					bestTime: history.bestTime,
					bestAccuracy: history.bestAccuracy,
					lastAttempt: history.lastAttempt
				});
			}
		}
	}

	/**
	 * 複合条件で検索
	 */
	async searchHistory(query: SearchQuery): Promise<GameHistory[]> {
		this.ensureInitialized();

		let collection = this.db.gameHistory.toCollection();

		if (query.mode) {
			collection = this.db.gameHistory.where('mode').equals(query.mode);
		}

		let results = await collection.toArray();

		// 追加フィルタリング
		if (query.startDate) {
			results = results.filter((h) => h.startTime >= query.startDate!);
		}
		if (query.endDate) {
			results = results.filter((h) => h.startTime <= query.endDate!);
		}
		if (query.minScore) {
			results = results.filter((h) => h.score.total >= query.minScore!);
		}

		return results;
	}

	/**
	 * 統計サマリーを取得
	 */
	async getStatsSummary(): Promise<StatsSummary> {
		this.ensureInitialized();

		const histories = await this.db.gameHistory.toArray();

		if (histories.length === 0) {
			return {
				totalGames: 0,
				averageScore: 0,
				bestScore: 0,
				totalPlayTime: 0,
				averageAccuracy: 0
			};
		}

		let totalScore = 0;
		let totalPlayTime = 0;
		let totalAccuracy = 0;
		let bestScore = 0;

		histories.forEach((h) => {
			totalScore += h.score.total;
			totalAccuracy += h.score.accuracy;
			bestScore = Math.max(bestScore, h.score.total);
			totalPlayTime += h.endTime.getTime() - h.startTime.getTime();
		});

		return {
			totalGames: histories.length,
			averageScore: totalScore / histories.length,
			bestScore,
			totalPlayTime,
			averageAccuracy: totalAccuracy / histories.length
		};
	}

	/**
	 * アチーブメント進捗を計算
	 */
	async getAchievementProgress(): Promise<AchievementProgress[]> {
		this.ensureInitialized();

		const summary = await this.getStatsSummary();
		const achievements: AchievementProgress[] = [];

		// 初心者アチーブメント
		achievements.push({
			id: 'first_game',
			name: '初めての挑戦',
			description: '最初のゲームをプレイ',
			progress: Math.min(summary.totalGames, 1),
			target: 1,
			unlocked: summary.totalGames >= 1
		});

		// ゲーム数アチーブメント
		achievements.push({
			id: 'games_10',
			name: '練習中',
			description: '10回プレイ',
			progress: summary.totalGames,
			target: 10,
			unlocked: summary.totalGames >= 10
		});

		achievements.push({
			id: 'games_100',
			name: 'かるたマスター',
			description: '100回プレイ',
			progress: summary.totalGames,
			target: 100,
			unlocked: summary.totalGames >= 100
		});

		// スコアアチーブメント
		achievements.push({
			id: 'score_10000',
			name: 'ハイスコアラー',
			description: 'スコア10000点達成',
			progress: summary.bestScore,
			target: 10000,
			unlocked: summary.bestScore >= 10000
		});

		// 精度アチーブメント
		achievements.push({
			id: 'accuracy_95',
			name: '正確無比',
			description: '平均精度95%以上',
			progress: summary.averageAccuracy,
			target: 95,
			unlocked: summary.averageAccuracy >= 95
		});

		return achievements;
	}

	/**
	 * 初期化を確認
	 */
	private ensureInitialized(): void {
		if (!this.initialized) {
			throw new Error('IndexedDBService is not initialized');
		}
	}

	/**
	 * 初期化のエイリアス（+page.svelteから使用）
	 */
	async init(): Promise<void> {
		return this.initialize();
	}

	/**
	 * 最新のセッションを取得
	 */
	async getLatestSession(): Promise<{
		id: string;
		mode: 'practice' | 'specific' | 'random';
		startedAt: Date;
		completedCards: number;
		totalCards: number;
	} | null> {
		this.ensureInitialized();

		const latestHistory = await this.db.gameHistory.orderBy('startTime').reverse().first();

		if (!latestHistory) {
			return null;
		}

		return {
			id: latestHistory.sessionId,
			mode: latestHistory.mode,
			startedAt: latestHistory.startTime,
			completedCards: latestHistory.cards.length,
			totalCards: 44 // 上毛かるたの総数
		};
	}

	/**
	 * 進捗があるかチェック
	 */
	async hasProgress(): Promise<boolean> {
		this.ensureInitialized();

		const session = await this.getLatestSession();
		return session !== null && session.completedCards < session.totalCards;
	}
}

export const db = new JomoKarutaDB();
