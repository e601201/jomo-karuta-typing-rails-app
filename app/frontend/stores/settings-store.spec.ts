import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { settingsStore } from './settings-store';
import type { UserSettings } from '@/types/game';

// Mock localStorage
const localStorageMock = {
	getItem: vi.fn(),
	setItem: vi.fn(),
	removeItem: vi.fn(),
	clear: vi.fn()
};

Object.defineProperty(window, 'localStorage', {
	value: localStorageMock,
	writable: true
});

describe('Settings Store', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		settingsStore.reset();
		settingsStore.resetServerSync();
	});

	afterEach(() => {
		vi.clearAllMocks();
	});

	describe('Default Settings', () => {
		it('TC-001: should have default settings on initialization', () => {
			const settings = settingsStore.getState();

			expect(settings.display.fontSize).toBe('medium');
			expect(settings.display.theme).toBe('auto');
			expect(settings.sound.effectsEnabled).toBe(true);
			expect(settings.sound.effectsVolume).toBe(50);
			expect(settings.keyboard.inputMethod).toBe('romaji');
		});

		it('should provide default settings getter', () => {
			const defaults = settingsStore.getDefaults();

			expect(defaults.display.fontSize).toBe('medium');
			expect(defaults.sound.effectsVolume).toBe(50);
			expect(defaults.keyboard.inputMethod).toBe('romaji');
		});
	});

	describe('Settings Updates', () => {
		it('TC-007: should update sound settings', () => {
			settingsStore.updateSetting('sound.effectsEnabled', false);
			settingsStore.updateSetting('sound.effectsVolume', 75);

			const settings = settingsStore.getState();
			expect(settings.sound.effectsEnabled).toBe(false);
			expect(settings.sound.effectsVolume).toBe(75);
		});

		it('TC-008: should validate volume ranges (0-100)', () => {
			settingsStore.updateSetting('sound.effectsVolume', -10);
			expect(settingsStore.getState().sound.effectsVolume).toBe(0);

			settingsStore.updateSetting('sound.bgmVolume', 150);
			expect(settingsStore.getState().sound.bgmVolume).toBe(100);
		});

		it('TC-009: should validate voice speed (0.5-2.0)', () => {
			settingsStore.updateSetting('sound.voiceSpeed', 0.3);
			expect(settingsStore.getState().sound.voiceSpeed).toBe(0.5);

			settingsStore.updateSetting('sound.voiceSpeed', 2.5);
			expect(settingsStore.getState().sound.voiceSpeed).toBe(2.0);

			settingsStore.updateSetting('sound.voiceSpeed', 1.5);
			expect(settingsStore.getState().sound.voiceSpeed).toBe(1.5);
		});

		it('TC-010: should update display settings', () => {
			settingsStore.updateSetting('display.fontSize', 'large');
			settingsStore.updateSetting('display.theme', 'dark');
			settingsStore.updateSetting('display.animations', false);

			const settings = settingsStore.getState();
			expect(settings.display.fontSize).toBe('large');
			expect(settings.display.theme).toBe('dark');
			expect(settings.display.animations).toBe(false);
		});

		it('TC-018: should update keyboard input method', () => {
			settingsStore.updateSetting('keyboard.inputMethod', 'kana');

			const settings = settingsStore.getState();
			expect(settings.keyboard.inputMethod).toBe('kana');
		});
	});

	describe('Data Persistence', () => {
		it('TC-019: should save settings to localStorage', async () => {
			settingsStore.updateSetting('display.theme', 'dark');
			await settingsStore.save();

			expect(localStorageMock.setItem).toHaveBeenCalledWith(
				'userSettings',
				expect.stringContaining('"theme":"dark"')
			);
		});

		it('TC-020: should load settings from localStorage', async () => {
			const savedSettings: Partial<UserSettings> = {
				display: {
					fontSize: 'large',
					theme: 'dark',
					animations: true
				}
			};

			localStorageMock.getItem.mockReturnValue(JSON.stringify(savedSettings));
			await settingsStore.load();

			const settings = settingsStore.getState();
			expect(settings.display.fontSize).toBe('large');
			expect(settings.display.theme).toBe('dark');
		});

		it('should handle corrupted localStorage data', async () => {
			localStorageMock.getItem.mockReturnValue('invalid json');
			await settingsStore.load();

			// Should keep default settings
			const settings = settingsStore.getState();
			expect(settings.display.fontSize).toBe('medium');
		});
	});

	describe('Reset Functionality', () => {
		it('TC-021: should reset all settings to default', () => {
			// Change some settings
			settingsStore.updateSetting('display.fontSize', 'large');
			settingsStore.updateSetting('sound.effectsVolume', 80);

			// Reset to defaults
			settingsStore.reset();

			const settings = settingsStore.getState();
			expect(settings.display.fontSize).toBe('medium');
			expect(settings.sound.effectsVolume).toBe(50);
		});

		it('TC-022: should reset specific section', () => {
			// Change settings in multiple sections
			settingsStore.updateSetting('display.fontSize', 'large');
			settingsStore.updateSetting('sound.effectsVolume', 80);

			// Reset only display section
			settingsStore.resetSection('display');

			const settings = settingsStore.getState();
			expect(settings.display.fontSize).toBe('medium');
			expect(settings.sound.effectsVolume).toBe(80); // Should remain changed
		});
	});

	describe('Export/Import', () => {
		it('TC-023: should export settings as JSON', () => {
			settingsStore.updateSetting('display.theme', 'dark');
			const exported = settingsStore.export();

			const parsed = JSON.parse(exported);
			expect(parsed.version).toBeDefined();
			expect(parsed.settings.display.theme).toBe('dark');
			expect(parsed.exportDate).toBeDefined();
		});

		it('TC-024: should import valid settings', async () => {
			const importData = {
				version: '1.0.0',
				settings: {
					display: {
						fontSize: 'large',
						theme: 'dark'
					}
				}
			};

			await settingsStore.import(JSON.stringify(importData));

			const settings = settingsStore.getState();
			expect(settings.display.fontSize).toBe('large');
			expect(settings.display.theme).toBe('dark');
		});

		it('TC-027: should reject invalid import data', async () => {
			const invalidData = 'not valid json';

			await expect(settingsStore.import(invalidData)).rejects.toThrow();

			// Settings should remain unchanged
			const settings = settingsStore.getState();
			expect(settings.display.fontSize).toBe('medium');
		});
	});

	describe('Change Tracking', () => {
		it('TC-028: should track hasChanges flag', () => {
			expect(settingsStore.hasChanges()).toBe(false);

			settingsStore.updateSetting('display.theme', 'dark');
			expect(settingsStore.hasChanges()).toBe(true);

			settingsStore.save();
			expect(settingsStore.hasChanges()).toBe(false);
		});

		it('should provide changed settings list', () => {
			settingsStore.updateSetting('display.theme', 'dark');
			settingsStore.updateSetting('sound.effectsVolume', 75);

			const changes = settingsStore.getChangedSettings();
			expect(changes).toContain('display.theme');
			expect(changes).toContain('sound.effectsVolume');
		});
	});

	describe('Validation', () => {
		it('TC-025: should validate all numeric ranges', () => {
			const validations = [
				{ path: 'sound.effectsVolume', invalid: 120, expected: 100 },
				{ path: 'sound.voiceSpeed', invalid: 3, expected: 2.0 }
			];

			validations.forEach(({ path, invalid, expected }) => {
				settingsStore.updateSetting(path, invalid);
				const value = path
					.split('.')
					.reduce<unknown>(
						(obj, key) => (obj as Record<string, unknown>)[key],
						settingsStore.getState()
					);
				expect(value).toBe(expected);
			});
		});

		it('should validate enum values', () => {
			// Invalid theme value should be ignored
			const currentTheme = settingsStore.getState().display.theme;
			settingsStore.updateSetting('display.theme', 'invalid');
			expect(settingsStore.getState().display.theme).toBe(currentTheme);

			// Valid theme value should be set
			settingsStore.updateSetting('display.theme', 'dark');
			expect(settingsStore.getState().display.theme).toBe('dark');
		});
	});

	describe('Deep Merge (未知キーの破棄)', () => {
		it('localStorage の旧フル形状から型にないキーを捨てて deep-merge する', async () => {
			const legacy = {
				mode: 'random',
				soundEnabled: true,
				display: { fontSize: 'large', theme: 'dark', animationSpeed: 'fast', showFurigana: true },
				keyboard: { layout: 'JIS', inputMethod: 'kana', shortcuts: { pause: 'Escape' } },
				accessibility: { highContrast: true }
			};
			localStorageMock.getItem.mockReturnValue(JSON.stringify(legacy));

			await settingsStore.load();

			const state = settingsStore.getState() as unknown as Record<string, unknown>;
			expect(state.mode).toBeUndefined();
			expect(state.accessibility).toBeUndefined();
			expect((state.display as Record<string, unknown>).animationSpeed).toBeUndefined();
			expect((state.keyboard as Record<string, unknown>).layout).toBeUndefined();
			// 型にあるキーは採用され、欠けているキーはデフォルトで補完される
			expect(settingsStore.getState().display.theme).toBe('dark');
			expect(settingsStore.getState().keyboard.inputMethod).toBe('kana');
			expect(settingsStore.getState().sound.bgmVolume).toBe(50);
		});
	});

	describe('Server Sync (アカウント単位の DB 保存)', () => {
		const serverSettings: UserSettings = {
			display: {
				fontSize: 'large',
				theme: 'dark',
				animations: false
			},
			sound: {
				effectsEnabled: false,
				effectsVolume: 30,
				bgmEnabled: false,
				bgmVolume: 20,
				typingSoundEnabled: false,
				typingSoundVolume: 10,
				voiceEnabled: true,
				voiceSpeed: 1.5
			},
			keyboard: {
				inputMethod: 'kana'
			}
		};

		function jsonResponse(status: number, body: unknown): Response {
			return {
				ok: status >= 200 && status < 300,
				status,
				text: () => Promise.resolve(JSON.stringify(body))
			} as unknown as Response;
		}

		// PUT されたボディをそのまま settings として返す（Rails 側の全置換の挙動を模す）
		function echoFetchMock() {
			return vi.fn((_url: string, init?: RequestInit) =>
				Promise.resolve(
					jsonResponse(200, { success: true, settings: JSON.parse(init?.body as string) })
				)
			);
		}

		let fetchMock: ReturnType<typeof vi.fn>;

		beforeEach(() => {
			localStorageMock.getItem.mockReset();
			fetchMock = echoFetchMock();
			vi.stubGlobal('fetch', fetchMock);
		});

		afterEach(() => {
			vi.unstubAllGlobals();
		});

		it('ログイン中はサーバー設定が常に勝ち localStorage にミラー書きされる', async () => {
			await settingsStore.initializeFromServer(serverSettings, true);

			const state = settingsStore.getState();
			expect(state.display.theme).toBe('dark');
			expect(state.keyboard.inputMethod).toBe('kana');
			expect(localStorageMock.setItem).toHaveBeenCalledWith(
				'userSettings',
				JSON.stringify(serverSettings)
			);
			// サーバー設定がある場合は PUT しない
			expect(fetchMock).not.toHaveBeenCalled();
		});

		it('同一サーバースナップショットの再適用では未保存の編集を上書きしない', async () => {
			await settingsStore.initializeFromServer(serverSettings, true);
			localStorageMock.setItem.mockClear();

			settingsStore.updateSetting('display.theme', 'light');

			// ページ遷移のたびに navigate イベントで同一の shared props が渡ってくる
			await settingsStore.initializeFromServer(serverSettings, true);

			expect(settingsStore.getState().display.theme).toBe('light');
			expect(settingsStore.hasChanges()).toBe(true);
			expect(settingsStore.getChangedSettings()).toContain('display.theme');
			// 再適用しないので localStorage への冗長なミラー書きも発生しない
			expect(localStorageMock.setItem).not.toHaveBeenCalled();
		});

		it('サーバースナップショットが変わったときは再適用される', async () => {
			await settingsStore.initializeFromServer(serverSettings, true);
			settingsStore.updateSetting('display.theme', 'light');

			const updatedServerSettings: UserSettings = {
				...serverSettings,
				sound: { ...serverSettings.sound, bgmVolume: 90 }
			};
			await settingsStore.initializeFromServer(updatedServerSettings, true);

			expect(settingsStore.getState().sound.bgmVolume).toBe(90);
			expect(settingsStore.getState().display.theme).toBe('dark');
			expect(settingsStore.hasChanges()).toBe(false);
		});

		it('初回引き継ぎはローカル設定を deep-merge して一度だけ PUT する', async () => {
			localStorageMock.getItem.mockReturnValue(
				JSON.stringify({ display: { fontSize: 'small', theme: 'light' } })
			);

			await settingsStore.initializeFromServer(null, true);
			await settingsStore.initializeFromServer(null, true);

			expect(fetchMock).toHaveBeenCalledTimes(1);
			const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
			expect(url).toBe('/api/settings');
			expect(init.method).toBe('PUT');
			const sent = JSON.parse(init.body as string) as UserSettings;
			expect(sent.display.fontSize).toBe('small');
			expect(sent.display.theme).toBe('light');
			expect(sent.sound.bgmVolume).toBe(50); // 欠けている項目はデフォルトで補完される
			expect(settingsStore.getState().display.fontSize).toBe('small');
		});

		it('ゲストの保存は従来どおり localStorage のみで PUT しない', async () => {
			await settingsStore.initializeFromServer(null, false);

			settingsStore.updateSetting('display.theme', 'dark');
			await settingsStore.save();

			expect(fetchMock).not.toHaveBeenCalled();
			expect(localStorageMock.setItem).toHaveBeenCalledWith(
				'userSettings',
				expect.stringContaining('"theme":"dark"')
			);
			expect(settingsStore.hasChanges()).toBe(false);
		});

		// 「もう一度遊ぶ」は window.location.href によるフルリロードで、ストアは
		// デフォルト値で作り直される。読み戻しがないとゲームに設定が効かなくなる
		it('ゲストはフルリロード後に localStorage の設定を読み戻す', async () => {
			localStorageMock.getItem.mockReturnValue(JSON.stringify(serverSettings));

			await settingsStore.initializeFromServer(null, false);

			expect(settingsStore.getState()).toEqual(serverSettings);
			expect(settingsStore.hasChanges()).toBe(false);
			// 読み戻しは読むだけで、新たな書き込み経路を作らない
			expect(localStorageMock.setItem).not.toHaveBeenCalled();
			expect(fetchMock).not.toHaveBeenCalled();
		});

		it('ゲストの読み戻しは一度だけで、SPA 遷移では未保存の編集を上書きしない', async () => {
			localStorageMock.getItem.mockReturnValue(JSON.stringify(serverSettings));
			await settingsStore.initializeFromServer(null, false);

			settingsStore.updateSetting('display.theme', 'light');

			// ページ遷移のたびに navigate イベントから同じ呼び出しが走る
			await settingsStore.initializeFromServer(null, false);

			expect(settingsStore.getState().display.theme).toBe('light');
			expect(settingsStore.hasChanges()).toBe(true);
		});

		it('localStorage に設定がないゲストはデフォルトのままになる', async () => {
			localStorageMock.getItem.mockReturnValue(null);

			await settingsStore.initializeFromServer(null, false);

			expect(settingsStore.getState()).toEqual(settingsStore.getDefaults());
			expect(localStorageMock.setItem).not.toHaveBeenCalled();
		});

		it('ログイン中の保存は PUT 成功後に localStorage にミラー書きする', async () => {
			await settingsStore.initializeFromServer(serverSettings, true);
			localStorageMock.setItem.mockClear();

			settingsStore.updateSetting('display.theme', 'light');
			await settingsStore.save();

			expect(fetchMock).toHaveBeenCalledTimes(1);
			expect(settingsStore.hasChanges()).toBe(false);
			expect(localStorageMock.setItem).toHaveBeenCalledWith(
				'userSettings',
				expect.stringContaining('"theme":"light"')
			);
		});

		it('PUT 失敗時はエラーを投げ changedPaths（未保存状態）を維持する', async () => {
			await settingsStore.initializeFromServer(serverSettings, true);
			localStorageMock.setItem.mockClear();

			settingsStore.updateSetting('sound.effectsVolume', 80);
			fetchMock.mockResolvedValue(jsonResponse(422, { success: false, errors: ['invalid'] }));

			await expect(settingsStore.save()).rejects.toThrow();
			expect(settingsStore.hasChanges()).toBe(true);
			expect(settingsStore.getChangedSettings()).toContain('sound.effectsVolume');
			// 失敗時は localStorage へのミラー書きもしない
			expect(localStorageMock.setItem).not.toHaveBeenCalled();
		});
	});
});
