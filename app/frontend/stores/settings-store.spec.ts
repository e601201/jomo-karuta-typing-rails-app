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
	});

	afterEach(() => {
		vi.clearAllMocks();
	});

	describe('Default Settings', () => {
		it('TC-001: should have default settings on initialization', () => {
			const settings = settingsStore.getState();

			expect(settings.mode).toBe('random');
			expect(settings.display.fontSize).toBe('medium');
			expect(settings.display.theme).toBe('auto');
			expect(settings.sound.effectsEnabled).toBe(true);
			expect(settings.sound.effectsVolume).toBe(50);
			expect(settings.keyboard.layout).toBe('JIS');
			expect(settings.accessibility.highContrast).toBe(false);
		});

		it('should provide default settings getter', () => {
			const defaults = settingsStore.getDefaults();

			expect(defaults.display.fontSize).toBe('medium');
			expect(defaults.sound.effectsVolume).toBe(50);
			expect(defaults.keyboard.layout).toBe('JIS');
		});
	});

	describe('Settings Updates', () => {
		it('TC-004: should update partial input settings', () => {
			settingsStore.updateSetting('partialLength', 5);
			const settings = settingsStore.getState();

			expect(settings.partialLength).toBe(5);
		});

		it('TC-005: should validate input ranges', () => {
			// Test partialLength range (3-10)
			settingsStore.updateSetting('partialLength', 2);
			expect(settingsStore.getState().partialLength).toBe(3);

			settingsStore.updateSetting('partialLength', 11);
			expect(settingsStore.getState().partialLength).toBe(10);

			settingsStore.updateSetting('partialLength', 7);
			expect(settingsStore.getState().partialLength).toBe(7);
		});

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

		it('TC-018: should update keyboard shortcuts', () => {
			settingsStore.updateSetting('keyboard.shortcuts.pause', 'Space');
			settingsStore.updateSetting('keyboard.shortcuts.skip', 'Enter');

			const settings = settingsStore.getState();
			expect(settings.keyboard.shortcuts.pause).toBe('Space');
			expect(settings.keyboard.shortcuts.skip).toBe('Enter');
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
					animations: true,
					animationSpeed: 'fast',
					showFurigana: true,
					showMeaning: false
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
				{ path: 'partialLength', invalid: 15, expected: 10 },
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
});
