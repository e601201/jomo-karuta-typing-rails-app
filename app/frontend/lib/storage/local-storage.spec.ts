/**
 * ローカルストレージサービスのテスト
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { LocalStorageService } from './local-storage';
import type { GameSettings, UserProfile, SavedSession } from './local-storage';

// Base64 polyfill for Node.js environment (test only)
// Happy-dom v20 now provides btoa/atob, but keep as fallback
if (typeof btoa === 'undefined' && typeof global !== 'undefined') {
	(global as unknown as { btoa: (str: string) => string }).btoa = (str: string) =>
		Buffer.from(str, 'utf-8').toString('base64');
}
if (typeof atob === 'undefined' && typeof global !== 'undefined') {
	(global as unknown as { atob: (str: string) => string }).atob = (str: string) =>
		Buffer.from(str, 'base64').toString('utf-8');
}

// LocalStorageのモック
const localStorageMock = (() => {
	let store: Record<string, string> = {};
	return {
		getItem: vi.fn((key: string) => store[key] || null),
		setItem: vi.fn((key: string, value: string) => {
			store[key] = value;
		}),
		removeItem: vi.fn((key: string) => {
			delete store[key];
		}),
		clear: vi.fn(() => {
			store = {};
		}),
		get length() {
			return Object.keys(store).length;
		},
		key: vi.fn((index: number) => {
			return Object.keys(store)[index] || null;
		})
	};
})();

// グローバルオブジェクトのモック
if (typeof window !== 'undefined') {
	Object.defineProperty(window, 'localStorage', {
		value: localStorageMock,
		writable: true
	});
} else {
	// Node.js環境用
	if (typeof global !== 'undefined') {
		(global as unknown as { localStorage: Storage }).localStorage =
			localStorageMock as unknown as Storage;
		(global as unknown as { window: { localStorage: Storage } }).window = {
			localStorage: localStorageMock as unknown as Storage
		};
	}
}

// テスト用データ
const mockSettings: GameSettings = {
	display: {
		theme: 'dark',
		fontSize: 'medium',
		showFurigana: true
	},
	sound: {
		enabled: true,
		volume: 50,
		effectsEnabled: true
	},
	game: {
		defaultMode: 'random',
		partialInputLength: 5,
		showHints: false
	}
};

const mockProfile: UserProfile = {
	nickname: 'テストユーザー',
	createdAt: '2024-01-01T00:00:00Z',
	lastPlayedAt: '2024-01-02T10:00:00Z',
	totalPlayTime: 3600000
};

const mockSession: SavedSession = {
	id: 'session-123',
	mode: 'random',
	startTime: '2024-01-02T10:00:00Z',
	cards: {
		current: { id: 'tsu', hiragana: 'つる まう かたち の ぐんまけん' },
		currentIndex: 5,
		remaining: [],
		completed: []
	},
	score: {
		total: 1000,
		accuracy: 95.5,
		speed: 120,
		combo: 3,
		maxCombo: 10
	},
	timer: {
		elapsedTime: 180000,
		pausedDuration: 5000
	}
};

describe('LocalStorageService - 初期化', () => {
	let service: LocalStorageService;

	beforeEach(() => {
		localStorageMock.clear();
		vi.clearAllMocks();
	});

	it('サービスが正しく初期化される', () => {
		service = new LocalStorageService();
		service.initialize();

		expect(service.isStorageAvailable()).toBe(true);
		expect(localStorageMock.setItem).toHaveBeenCalledWith('jkt_version', expect.any(String));
	});

	it('ストレージが利用できない場合にフォールバックする', () => {
		// LocalStorageを無効化
		const globalObj = (typeof global !== 'undefined' ? global : window) as unknown as {
			localStorage: Storage | null;
			window?: { localStorage: Storage | null };
		};
		const originalLocalStorage = globalObj.window?.localStorage || globalObj.localStorage;
		if (globalObj.window) {
			Object.defineProperty(globalObj.window, 'localStorage', {
				value: null,
				writable: true
			});
		} else {
			globalObj.localStorage = null;
		}

		service = new LocalStorageService();
		service.initialize();

		expect(service.isStorageAvailable()).toBe(false);
		// メモリストレージが使用される
		expect(() => service.getSettings()).not.toThrow();

		// 元に戻す
		if (globalObj.window) {
			Object.defineProperty(globalObj.window, 'localStorage', {
				value: originalLocalStorage,
				writable: true
			});
		} else {
			globalObj.localStorage = originalLocalStorage;
		}
	});
});

describe('LocalStorageService - 設定管理', () => {
	let service: LocalStorageService;

	beforeEach(() => {
		localStorageMock.clear();
		service = new LocalStorageService();
		service.initialize();
	});

	it('設定を保存できる', () => {
		service.saveSettings(mockSettings);

		expect(localStorageMock.setItem).toHaveBeenCalledWith(
			'jkt_settings',
			JSON.stringify(mockSettings)
		);
	});

	it('設定を読み込める', () => {
		localStorageMock.setItem('jkt_settings', JSON.stringify(mockSettings));

		const settings = service.getSettings();

		expect(settings).toEqual(mockSettings);
	});

	it('部分的な設定更新ができる', () => {
		service.saveSettings(mockSettings);
		service.saveSettings({ display: { theme: 'light', fontSize: 'medium', showFurigana: true } });

		const settings = service.getSettings();

		expect(settings.display.theme).toBe('light');
		expect(settings.display.fontSize).toBe('medium'); // 保持される
		expect(settings.sound.enabled).toBe(true); // 保持される
	});

	it('設定をリセットできる', () => {
		service.saveSettings(mockSettings);
		service.resetSettings();

		const settings = service.getSettings();

		expect(settings).toEqual(service.getDefaultSettings());
		expect(localStorageMock.removeItem).toHaveBeenCalledWith('jkt_settings');
	});
});

describe('LocalStorageService - プロファイル管理', () => {
	let service: LocalStorageService;

	beforeEach(() => {
		localStorageMock.clear();
		service = new LocalStorageService();
		service.initialize();
	});

	it('プロファイルを保存できる', () => {
		service.saveProfile(mockProfile);

		expect(localStorageMock.setItem).toHaveBeenCalledWith(
			'jkt_profile',
			JSON.stringify(mockProfile)
		);
	});

	it('プロファイルが存在しない場合はnullを返す', () => {
		const profile = service.getProfile();

		expect(profile).toBeNull();
	});

	it('プレイ時間が累積される', () => {
		service.saveProfile(mockProfile);
		service.saveProfile({ totalPlayTime: 1800000 }); // 30分追加

		const profile = service.getProfile();

		expect(profile?.totalPlayTime).toBe(5400000); // 1時間30分
	});
});

describe('LocalStorageService - 進捗管理', () => {
	let service: LocalStorageService;

	beforeEach(() => {
		localStorageMock.clear();
		service = new LocalStorageService();
		service.initialize();
	});

	it('完了した札を追加できる', () => {
		service.addCompletedCard('tsu');
		service.addCompletedCard('ne');
		service.addCompletedCard('tsu'); // 重複

		const progress = service.getProgress();

		expect(progress.completedCards).toEqual(['tsu', 'ne']);
		expect(progress.completedCards.length).toBe(2);
	});

	it('ベストスコアを更新できる', () => {
		const scoreData = {
			score: 1000,
			accuracy: 95.5,
			speed: 120,
			date: new Date().toISOString()
		};

		service.updateBestScore('random', scoreData);

		const progress = service.getProgress();

		expect(progress.bestScores.random).toEqual(scoreData);

		// より低いスコアは更新されない
		service.updateBestScore('random', { ...scoreData, score: 900 });
		const progress2 = service.getProgress();
		expect(progress2.bestScores.random.score).toBe(1000);
	});

	it('アチーブメントを記録できる', () => {
		service.unlockAchievement('first_game');
		service.unlockAchievement('perfect_score');

		const progress = service.getProgress();

		expect(progress.achievements).toHaveLength(2);
		expect(progress.achievements[0].id).toBe('first_game');
		expect(progress.achievements[0].unlockedAt).toBeDefined();
	});
});

describe('LocalStorageService - セッション管理', () => {
	let service: LocalStorageService;

	beforeEach(() => {
		localStorageMock.clear();
		service = new LocalStorageService();
		service.initialize();
	});

	it('ゲームセッションを保存できる', () => {
		service.saveSession(mockSession);

		expect(localStorageMock.setItem).toHaveBeenCalledWith(
			'jkt_session',
			JSON.stringify(mockSession)
		);
	});

	it('セッションを復元できる', () => {
		localStorageMock.setItem('jkt_session', JSON.stringify(mockSession));

		const session = service.loadSession();

		expect(session).toEqual(mockSession);
	});

	it('セッションをクリアできる', () => {
		service.saveSession(mockSession);
		service.clearSession();

		expect(service.loadSession()).toBeNull();
		expect(service.hasSession()).toBe(false);
	});

	it('セッションの有無を確認できる', () => {
		expect(service.hasSession()).toBe(false);

		service.saveSession(mockSession);
		expect(service.hasSession()).toBe(true);

		service.clearSession();
		expect(service.hasSession()).toBe(false);
	});
});

describe('LocalStorageService - 統計管理', () => {
	let service: LocalStorageService;

	beforeEach(() => {
		localStorageMock.clear();
		service = new LocalStorageService();
		service.initialize();
	});

	it('統計データを更新できる', () => {
		service.updateStatistics({
			totalGames: 5,
			totalCards: 100,
			totalTime: 18000000,
			averageAccuracy: 92.5,
			averageSpeed: 115
		});

		const stats = service.getStatistics();

		expect(stats.totalGames).toBe(5);
		expect(stats.totalCards).toBe(100);
		expect(stats.averageAccuracy).toBe(92.5);
	});

	it('カード別統計を更新できる', () => {
		const cardData = {
			attempts: 3,
			completions: 2,
			averageTime: 5000,
			averageMistakes: 1.5
		};

		service.updateCardStats('tsu', cardData);

		const stats = service.getStatistics();

		expect(stats.cardStats['tsu']).toEqual(cardData);
	});

	it('統計データを初期化できる', () => {
		service.updateStatistics({ totalGames: 10, totalCards: 200 });
		service.updateCardStats('tsu', { attempts: 5 });

		service.resetStatistics();

		const stats = service.getStatistics();

		expect(stats.totalGames).toBe(0);
		expect(stats.totalCards).toBe(0);
		expect(stats.cardStats).toEqual({});
	});
});

describe('LocalStorageService - データ管理', () => {
	let service: LocalStorageService;

	beforeEach(() => {
		localStorageMock.clear();
		service = new LocalStorageService();
		service.initialize();
	});

	it('データをエクスポートできる', () => {
		service.saveSettings(mockSettings);
		service.saveProfile(mockProfile);

		const exportedData = service.exportData();

		expect(exportedData).toBeTypeOf('string');
		// Base64エンコードされていることを確認
		const decoded = JSON.parse(
			typeof Buffer !== 'undefined'
				? Buffer.from(exportedData, 'base64').toString('utf-8')
				: atob(exportedData)
		);
		expect(decoded.settings).toEqual(mockSettings);
		expect(decoded.profile).toEqual(mockProfile);
	});

	it('データをインポートできる', () => {
		const dataToImport = {
			version: '1.0.0',
			settings: mockSettings,
			profile: mockProfile,
			progress: { completedCards: ['tsu', 'ne'] }
		};
		const encoded =
			typeof Buffer !== 'undefined'
				? Buffer.from(JSON.stringify(dataToImport), 'utf-8').toString('base64')
				: btoa(JSON.stringify(dataToImport));

		const success = service.importData(encoded);

		expect(success).toBe(true);
		expect(service.getSettings()).toEqual(mockSettings);
		expect(service.getProfile()).toEqual(mockProfile);
	});

	it('不正なデータのインポートを拒否する', () => {
		const invalidData = 'not-base64-encoded-json';

		const success = service.importData(invalidData);

		expect(success).toBe(false);
	});

	it('すべてのデータをクリアできる', () => {
		service.saveSettings(mockSettings);
		service.saveProfile(mockProfile);
		service.saveSession(mockSession);

		service.clearAllData();

		expect(localStorageMock.clear).toHaveBeenCalled();
		expect(service.getProfile()).toBeNull();
		expect(service.loadSession()).toBeNull();
	});

	it('ストレージサイズを取得できる', () => {
		service.saveSettings(mockSettings);
		service.saveProfile(mockProfile);

		const size = service.getStorageSize();

		expect(size).toBeGreaterThan(0);
		expect(size).toBeTypeOf('number');
	});
});

describe('LocalStorageService - エラーハンドリング', () => {
	let service: LocalStorageService;

	beforeEach(() => {
		localStorageMock.clear();
		service = new LocalStorageService();
		service.initialize();
	});

	it('容量超過エラーを処理できる', () => {
		// setItemでQuotaExceededErrorをシミュレート
		localStorageMock.setItem.mockImplementationOnce(() => {
			throw new DOMException('QuotaExceededError');
		});

		// エラーをスローしない
		expect(() => service.saveSettings(mockSettings)).not.toThrow();
	});

	it('破損データを検出できる', () => {
		// 不正なJSONを設定
		localStorageMock.getItem.mockReturnValueOnce('{ invalid json }');

		const settings = service.getSettings();

		// デフォルト値を返す
		expect(settings).toEqual(service.getDefaultSettings());
	});

	it('プライベートモードで動作する', () => {
		// setItemでSecurityErrorをシミュレート
		localStorageMock.setItem.mockImplementation(() => {
			throw new DOMException('SecurityError');
		});

		service = new LocalStorageService();
		service.initialize();

		// メモリストレージにフォールバック
		expect(service.isStorageAvailable()).toBe(false);

		// メモリストレージで動作
		service.saveSettings(mockSettings);
		const settings = service.getSettings();
		expect(settings).toEqual(mockSettings);
	});
});

describe('LocalStorageService - マイグレーション', () => {
	let service: LocalStorageService;

	beforeEach(() => {
		localStorageMock.clear();
		vi.clearAllMocks();
	});

	it('古いバージョンからマイグレーションできる', () => {
		// v1データをセット
		const v1Settings = { theme: 'dark' }; // 古い形式

		// localStorageモックを設定
		const store: Record<string, string> = {
			jkt_version: '0.9.0',
			jkt_settings: JSON.stringify(v1Settings)
		};

		localStorageMock.getItem.mockImplementation((key: string) => store[key] || null);
		localStorageMock.setItem.mockImplementation((key: string, value: string) => {
			store[key] = value;
		});

		service = new LocalStorageService();
		service.initialize();

		// v1からv2への移行が実行される
		const settings = service.getSettings();
		expect(settings.display.theme).toBe('dark');
	});

	it('不明なバージョンを処理できる', () => {
		// localStorageモックを設定
		const store: Record<string, string> = {
			jkt_version: '99.99.99'
		};

		localStorageMock.getItem.mockImplementation((key: string) => store[key] || null);
		localStorageMock.setItem.mockImplementation((key: string, value: string) => {
			store[key] = value;
		});
		localStorageMock.clear.mockImplementation(() => {
			Object.keys(store).forEach((key) => delete store[key]);
		});

		service = new LocalStorageService();
		service.initialize();

		// データがクリアされて新規初期化される
		expect(localStorageMock.clear).toHaveBeenCalled();
	});
});

describe('LocalStorageService - パフォーマンス', () => {
	let service: LocalStorageService;

	beforeEach(() => {
		localStorageMock.clear();
		service = new LocalStorageService();
	});

	it('初期化が100ms以内に完了する', () => {
		const start = performance.now();
		service.initialize();
		const end = performance.now();

		expect(end - start).toBeLessThan(100);
	});

	it('データ読み込みが50ms以内に完了する', () => {
		service.initialize();
		service.saveSettings(mockSettings);

		const start = performance.now();
		service.getSettings();
		const end = performance.now();

		expect(end - start).toBeLessThan(50);
	});

	it('データ保存が30ms以内に完了する', () => {
		service.initialize();

		const start = performance.now();
		service.saveSettings(mockSettings);
		const end = performance.now();

		expect(end - start).toBeLessThan(30);
	});

	it('大量データでもメモリリークしない', () => {
		service.initialize();
		const initialMemory =
			(performance as unknown as { memory?: { usedJSHeapSize: number } }).memory?.usedJSHeapSize ||
			0;

		// 1000回の読み書き
		for (let i = 0; i < 1000; i++) {
			service.saveSettings({
				...mockSettings,
				display: { ...mockSettings.display, theme: i % 2 === 0 ? 'dark' : 'light' }
			});
			service.getSettings();
		}

		const finalMemory =
			(performance as unknown as { memory?: { usedJSHeapSize: number } }).memory?.usedJSHeapSize ||
			0;
		const memoryIncrease = finalMemory - initialMemory;

		// メモリ増加が妥当な範囲内
		expect(memoryIncrease).toBeLessThan(5000000); // 5MB以下
	});
});
