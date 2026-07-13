/**
 * IndexedDBサービスのテスト
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';

// IndexedDBのモック設定（Node.js環境用）
import 'fake-indexeddb/auto';
import Dexie from 'dexie';

import { IndexedDBService } from './indexed-db';
import type { GameHistory, DetailedStats, AttemptRecord } from './indexed-db';

// 各テスト前に共有DB 'JomoKarutaDB' を完全削除して初期化する。
// clearDatabase はデータのみ消し autoincrement キー生成器やスキーマを残すため、
// 全体実行時にキー重複（ConstraintError）やデータ汚染が起きる。DBごと削除すれば
// 各テストが必ずまっさらな状態（id=1 から）で始まる。
beforeEach(async () => {
	await Dexie.delete('JomoKarutaDB');
});

// テスト用モックデータ
const mockGameHistory: GameHistory = {
	sessionId: 'session-123',
	mode: 'practice',
	startTime: new Date('2024-01-01T10:00:00'),
	endTime: new Date('2024-01-01T10:30:00'),
	cards: [
		{
			cardId: 'tsu',
			startTime: new Date('2024-01-01T10:00:00'),
			endTime: new Date('2024-01-01T10:02:00'),
			inputHistory: [],
			mistakes: 2,
			wpm: 120,
			accuracy: 95.5
		}
	],
	score: {
		total: 5000,
		accuracy: 95.5,
		speed: 120,
		maxCombo: 10
	},
	settings: {
		display: { theme: 'dark', fontSize: 'medium', showFurigana: false },
		sound: { enabled: true, volume: 50, effectsEnabled: true },
		game: { defaultMode: 'practice', partialInputLength: 5, showHints: false }
	}
};

const mockDailyStats: DetailedStats = {
	date: new Date('2024-01-01'),
	dailyStats: {
		gamesPlayed: 10,
		cardsCompleted: 440,
		totalTime: 3600000,
		averageAccuracy: 92.5,
		averageSpeed: 115,
		bestScore: 8500
	}
};

const mockAttempt: AttemptRecord = {
	date: new Date('2024-01-02T10:00:00'),
	time: 110000,
	accuracy: 97.0,
	mistakes: 1,
	wpm: 125
};

describe('IndexedDBService - 初期化', () => {
	let service: IndexedDBService;

	beforeEach(() => {
		service = new IndexedDBService();
	});

	afterEach(async () => {
		// データベースをクリーンアップ
		if (service && service.isInitialized()) {
			await service.clearDatabase();
		}
	});

	it('データベースが正しく初期化される', async () => {
		await service.initialize();

		// データベースが開かれていることを確認
		expect(service.isInitialized()).toBe(true);
	});

	it('既存のデータベースに再接続できる', async () => {
		// 初回接続
		await service.initialize();
		await service.saveGameHistory({ ...mockGameHistory });

		// 新しいインスタンスで再接続
		const newService = new IndexedDBService();
		await newService.initialize();

		// データが保持されていることを確認
		const histories = await newService.getGameHistory(1);
		expect(histories).toHaveLength(1);
		expect(histories[0].sessionId).toBe('session-123');
	});
});

describe('IndexedDBService - ゲーム履歴', () => {
	let service: IndexedDBService;

	beforeEach(async () => {
		service = new IndexedDBService();
		await service.initialize();
	});

	afterEach(async () => {
		if (service && service.isInitialized()) {
			await service.clearDatabase();
		}
	});

	it('ゲーム履歴を保存できる', async () => {
		const id = await service.saveGameHistory({ ...mockGameHistory });

		expect(id).toBeGreaterThan(0);
	});

	it('ゲーム履歴を取得できる', async () => {
		// 複数の履歴を保存
		await service.saveGameHistory({ ...mockGameHistory });
		await service.saveGameHistory({
			...mockGameHistory,
			sessionId: 'session-124',
			startTime: new Date('2024-01-02T10:00:00')
		});

		const histories = await service.getGameHistory(10);

		expect(histories).toHaveLength(2);
		// 新しい順でソートされている
		expect(histories[0].sessionId).toBe('session-124');
	});

	it('モードで履歴をフィルタリングできる', async () => {
		await service.saveGameHistory({ ...mockGameHistory });
		await service.saveGameHistory({
			...mockGameHistory,
			sessionId: 'session-124',
			mode: 'random'
		});

		const practiceHistories = await service.getGameHistoryByMode('practice');

		expect(practiceHistories).toHaveLength(1);
		expect(practiceHistories[0].mode).toBe('practice');
	});

	it('古い履歴を削除できる', async () => {
		// 100日前の履歴
		const oldHistory = {
			...mockGameHistory,
			sessionId: 'old-session',
			startTime: new Date(Date.now() - 100 * 24 * 60 * 60 * 1000),
			endTime: new Date(Date.now() - 100 * 24 * 60 * 60 * 1000)
		};
		await service.saveGameHistory(oldHistory);

		// 最近の履歴（mockGameHistory の固定日付は90日以上前なので現在時刻で上書き）
		await service.saveGameHistory({
			...mockGameHistory,
			startTime: new Date(),
			endTime: new Date()
		});

		// 90日以前のデータを削除
		await service.deleteOldHistory(90);

		const histories = await service.getGameHistory();
		expect(histories).toHaveLength(1);
		expect(histories[0].sessionId).toBe('session-123');
	});

	it('大量データでもパフォーマンスが維持される', async () => {
		const startTime = performance.now();

		// 1000件のゲーム履歴を保存
		const promises = [];
		for (let i = 0; i < 1000; i++) {
			promises.push(
				service.saveGameHistory({
					...mockGameHistory,
					sessionId: `session-${i}`,
					startTime: new Date(Date.now() - i * 60000)
				})
			);
		}
		await Promise.all(promises);

		const saveTime = performance.now() - startTime;
		expect(saveTime).toBeLessThan(5000); // 5秒以内

		// 取得のパフォーマンス
		const fetchStart = performance.now();
		const histories = await service.getGameHistory(100);
		const fetchTime = performance.now() - fetchStart;

		expect(fetchTime).toBeLessThan(100); // 100ms以内
		expect(histories).toHaveLength(100);
	});
});

describe('IndexedDBService - 詳細統計', () => {
	let service: IndexedDBService;

	beforeEach(async () => {
		service = new IndexedDBService();
		await service.initialize();
	});

	afterEach(async () => {
		if (service && service.isInitialized()) {
			await service.clearDatabase();
		}
	});

	it('日次統計を保存できる', async () => {
		await service.saveDailyStats({ ...mockDailyStats });

		const stats = await service.getDailyStats(new Date('2024-01-01'));
		expect(stats).toBeDefined();
		expect(stats?.dailyStats.gamesPlayed).toBe(10);
	});

	it('期間指定で統計を取得できる', async () => {
		// 複数日の統計を保存
		for (let i = 0; i < 5; i++) {
			await service.saveDailyStats({
				...mockDailyStats,
				date: new Date(`2024-01-0${i + 1}`)
			});
		}

		const stats = await service.getStatsRange(new Date('2024-01-02'), new Date('2024-01-04'));

		expect(stats).toHaveLength(3);
		expect(stats[0].date.toISOString().split('T')[0]).toBe('2024-01-02');
	});

	it('週次集計を計算できる', async () => {
		// 1週間分のデータを作成
		for (let i = 0; i < 7; i++) {
			await service.saveDailyStats({
				date: new Date(`2024-01-0${i + 1}`),
				dailyStats: {
					gamesPlayed: 10,
					cardsCompleted: 44,
					totalTime: 3600000,
					averageAccuracy: 90 + i,
					averageSpeed: 110 + i,
					bestScore: 8000 + i * 100
				}
			});
		}

		const weeklyStats = await service.aggregateWeeklyStats(new Date('2024-01-01'));

		expect(weeklyStats.totalGames).toBe(70);
		expect(weeklyStats.totalCards).toBe(308);
		expect(weeklyStats.averageAccuracy).toBeCloseTo(93, 0);
	});

	it('月次集計を計算できる', async () => {
		// 1ヶ月分のデータを作成（簡略化）
		for (let i = 1; i <= 10; i++) {
			await service.saveDailyStats({
				date: new Date(`2024-01-${i.toString().padStart(2, '0')}`),
				dailyStats: {
					gamesPlayed: 5,
					cardsCompleted: 44,
					totalTime: 1800000,
					averageAccuracy: 92,
					averageSpeed: 115,
					bestScore: 8500
				}
			});
		}

		const monthlyStats = await service.aggregateMonthlyStats(new Date('2024-01-15'));

		expect(monthlyStats.totalGames).toBe(50);
		expect(monthlyStats.averageDailyGames).toBe(5);
	});
});

describe('IndexedDBService - カード履歴', () => {
	let service: IndexedDBService;

	beforeEach(async () => {
		service = new IndexedDBService();
		await service.initialize();
	});

	afterEach(async () => {
		if (service && service.isInitialized()) {
			await service.clearDatabase();
		}
	});

	it('カードの挑戦記録を保存できる', async () => {
		await service.saveCardAttempt('tsu', mockAttempt);

		const history = await service.getCardHistory('tsu');
		expect(history).toBeDefined();
		expect(history?.attempts).toHaveLength(1);
		expect(history?.attempts[0].wpm).toBe(125);
	});

	it('カード履歴を取得できる', async () => {
		// 複数の挑戦記録を追加
		await service.saveCardAttempt('tsu', mockAttempt);
		await service.saveCardAttempt('tsu', {
			...mockAttempt,
			date: new Date('2024-01-03T10:00:00'),
			wpm: 130
		});

		const history = await service.getCardHistory('tsu');

		expect(history?.attempts).toHaveLength(2);
		expect(history?.bestTime).toBe(110000);
		expect(history?.bestAccuracy).toBe(97.0);
	});

	it('上位カードを取得できる', async () => {
		// 複数カードのデータを作成
		const cards = ['tsu', 'ne', 'u', 'i', 'o'];
		for (let i = 0; i < cards.length; i++) {
			await service.saveCardAttempt(cards[i], {
				...mockAttempt,
				time: 100000 + i * 10000,
				accuracy: 98 - i
			});
		}

		const topCards = await service.getTopCards(3);

		expect(topCards).toHaveLength(3);
		expect(topCards[0].cardId).toBe('tsu');
		// tsu(i=0) の time は 100000+0 = 100000
		expect(topCards[0].bestTime).toBe(100000);
	});

	it('苦手カードを特定できる', async () => {
		// 精度の悪いカードを作成
		const cards = ['tsu', 'ne', 'u'];
		const accuracies = [85, 75, 95];
		for (let i = 0; i < cards.length; i++) {
			await service.saveCardAttempt(cards[i], {
				...mockAttempt,
				accuracy: accuracies[i],
				mistakes: 10 - accuracies[i] / 10
			});
		}

		const struggleCards = await service.getStruggleCards(2);

		expect(struggleCards).toHaveLength(2);
		expect(struggleCards[0].cardId).toBe('ne'); // 最も精度が低い
		expect(struggleCards[1].cardId).toBe('tsu');
	});

	it('履歴数の上限を管理できる', async () => {
		// 101件の記録を「古い順」に追加（実利用と同じ時系列の追記）。
		// i=100 が最古(100日前, time=200000)、i=0 が最新(今日, time=100000)。
		for (let i = 100; i >= 0; i--) {
			await service.saveCardAttempt('tsu', {
				...mockAttempt,
				date: new Date(Date.now() - i * 86400000),
				time: 100000 + i * 1000
			});
		}

		const history = await service.getCardHistory('tsu');

		// 最新100件のみ保持される（最古1件が切り捨てられる）
		expect(history?.attempts).toHaveLength(100);
		// 最新の記録（time=100000）が末尾に残っている
		expect(history?.attempts[history.attempts.length - 1].time).toBe(100000);
		// 最古の記録（time=200000）は切り捨てられている
		expect(history?.attempts.some((a) => a.time === 200000)).toBe(false);
	});
});

describe('IndexedDBService - データ管理', () => {
	let service: IndexedDBService;

	beforeEach(async () => {
		service = new IndexedDBService();
		await service.initialize();
	});

	afterEach(async () => {
		if (service && service.isInitialized()) {
			await service.clearDatabase();
		}
	});

	it('データベースをエクスポートできる', async () => {
		// データを追加
		await service.saveGameHistory({ ...mockGameHistory });
		await service.saveDailyStats({ ...mockDailyStats });

		const blob = await service.exportDatabase();

		expect(blob).toBeInstanceOf(Blob);
		expect(blob.size).toBeGreaterThan(0);
	});

	it('データベースをインポートできる', async () => {
		// データを追加してエクスポート
		await service.saveGameHistory({ ...mockGameHistory });
		const exportedData = await service.exportDatabase();

		// データベースをクリアして新しいインスタンス
		await service.clearDatabase();
		const newService = new IndexedDBService();
		await newService.initialize();

		// インポート
		await newService.importDatabase(exportedData);

		// データが復元されていることを確認
		const histories = await newService.getGameHistory();
		expect(histories).toHaveLength(1);
		expect(histories[0].sessionId).toBe('session-123');
	});

	it('データベースをクリアできる', async () => {
		await service.saveGameHistory({ ...mockGameHistory });
		await service.clearDatabase();

		const histories = await service.getGameHistory();
		expect(histories).toHaveLength(0);
	});

	it('データベースサイズを取得できる', async () => {
		await service.saveGameHistory({ ...mockGameHistory });

		const size = await service.getDatabaseSize();

		expect(size).toBeGreaterThan(0);
		expect(size).toBeTypeOf('number');
	});

	it('不要データを削除できる（vacuum）', async () => {
		// 古いデータを追加
		for (let i = 0; i < 10; i++) {
			await service.saveGameHistory({
				...mockGameHistory,
				sessionId: `old-${i}`,
				startTime: new Date(Date.now() - 100 * 24 * 60 * 60 * 1000)
			});
		}

		// 新しいデータを追加
		await service.saveGameHistory({ ...mockGameHistory });

		// vacuum実行
		await service.vacuum();

		// 古いデータが削除されている
		const histories = await service.getGameHistory();
		expect(histories.length).toBeLessThan(11);
	});
});

describe('IndexedDBService - クエリ機能', () => {
	let service: IndexedDBService;

	beforeEach(async () => {
		service = new IndexedDBService();
		await service.initialize();

		// テストデータを準備
		for (let i = 0; i < 20; i++) {
			await service.saveGameHistory({
				...mockGameHistory,
				sessionId: `session-${i}`,
				mode: i % 3 === 0 ? 'practice' : i % 3 === 1 ? 'specific' : 'random',
				startTime: new Date(Date.now() - i * 86400000),
				score: {
					...mockGameHistory.score,
					total: 3000 + i * 500
				}
			});
		}
	});

	afterEach(async () => {
		if (service && service.isInitialized()) {
			await service.clearDatabase();
		}
	});

	it('複合条件で検索できる', async () => {
		const results = await service.searchHistory({
			mode: 'practice',
			startDate: new Date(Date.now() - 10 * 86400000),
			endDate: new Date(),
			minScore: 5000
		});

		expect(results.length).toBeGreaterThan(0);
		results.forEach((r) => {
			expect(r.mode).toBe('practice');
			expect(r.score.total).toBeGreaterThanOrEqual(5000);
		});
	});

	it('統計サマリーを取得できる', async () => {
		const summary = await service.getStatsSummary();

		expect(summary.totalGames).toBe(20);
		expect(summary.averageScore).toBeGreaterThan(0);
		expect(summary.bestScore).toBeGreaterThanOrEqual(12500);
	});

	it('アチーブメント進捗を計算できる', async () => {
		const progress = await service.getAchievementProgress();

		expect(Array.isArray(progress)).toBe(true);
		expect(progress.length).toBeGreaterThan(0);
	});

	it('インデックスを活用した高速検索', async () => {
		const startTime = performance.now();

		const results = await service.searchHistory({
			mode: 'practice',
			minScore: 5000
		});

		const searchTime = performance.now() - startTime;

		expect(searchTime).toBeLessThan(50); // 50ms以内
		expect(results).toBeTypeOf('object');
	});
});

describe('IndexedDBService - エラーハンドリング', () => {
	let service: IndexedDBService;

	beforeEach(async () => {
		service = new IndexedDBService();
		await service.initialize();
	});

	afterEach(async () => {
		if (service && service.isInitialized()) {
			await service.clearDatabase();
		}
	});

	it('破損データを検出できる', async () => {
		// 不正なデータを直接追加する試み
		const invalidData = {
			sessionId: 'invalid',
			// modeが欠けている
			startTime: 'not-a-date', // 不正な日付
			cards: 'not-an-array' // 不正な型
		} as unknown as GameHistory;

		// エラーをキャッチして処理
		await expect(service.saveGameHistory(invalidData)).rejects.toThrow();
	});

	it('同時アクセスを処理できる', async () => {
		// 複数の同時書き込み
		const promises = [];
		for (let i = 0; i < 10; i++) {
			promises.push(
				service.saveGameHistory({
					...mockGameHistory,
					sessionId: `concurrent-${i}`
				})
			);
		}

		const results = await Promise.all(promises);

		// 全ての書き込みが成功
		expect(results).toHaveLength(10);
		results.forEach((id) => {
			expect(id).toBeGreaterThan(0);
		});
	});
});

describe('IndexedDBService - パフォーマンス', () => {
	let service: IndexedDBService;

	beforeEach(() => {
		service = new IndexedDBService();
	});

	afterEach(async () => {
		if (service && service.isInitialized()) {
			await service.clearDatabase();
		}
	});

	it('初期化が200ms以内に完了する', async () => {
		const startTime = performance.now();
		await service.initialize();
		const initTime = performance.now() - startTime;

		expect(initTime).toBeLessThan(200);
	});

	it('単純クエリが30ms以内に完了する', async () => {
		await service.initialize();
		await service.saveGameHistory({ ...mockGameHistory });

		const startTime = performance.now();
		const results = await service.getGameHistory(10);
		const queryTime = performance.now() - startTime;

		expect(queryTime).toBeLessThan(30);
		expect(results).toHaveLength(1);
	});

	it('集計クエリが100ms以内に完了する', async () => {
		await service.initialize();

		// データを準備
		for (let i = 0; i < 30; i++) {
			await service.saveDailyStats({
				...mockDailyStats,
				date: new Date(`2024-01-${(i + 1).toString().padStart(2, '0')}`)
			});
		}

		const startTime = performance.now();
		const monthly = await service.aggregateMonthlyStats(new Date('2024-01-15'));
		const aggregateTime = performance.now() - startTime;

		expect(aggregateTime).toBeLessThan(100);
		expect(monthly).toBeDefined();
	});

	it('範囲クエリが150ms以内に完了する', async () => {
		await service.initialize();

		// データを準備
		for (let i = 0; i < 50; i++) {
			await service.saveGameHistory({
				...mockGameHistory,
				sessionId: `range-${i}`,
				startTime: new Date(Date.now() - i * 86400000)
			});
		}

		const startTime = performance.now();
		const results = await service.searchHistory({
			startDate: new Date(Date.now() - 30 * 86400000),
			endDate: new Date()
		});
		const rangeTime = performance.now() - startTime;

		expect(rangeTime).toBeLessThan(150);
		expect(results.length).toBeGreaterThan(0);
	});

	it('並行処理でもパフォーマンス維持', async () => {
		await service.initialize();

		// 10個の同時クエリ
		const startTime = performance.now();
		const promises = [];
		for (let i = 0; i < 10; i++) {
			promises.push(service.getGameHistory(10));
		}
		await Promise.all(promises);
		const totalTime = performance.now() - startTime;

		// 各クエリが平均100ms以内
		expect(totalTime / 10).toBeLessThan(100);
	});
});
