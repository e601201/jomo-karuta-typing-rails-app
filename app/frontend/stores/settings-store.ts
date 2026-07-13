/**
 * ユーザー設定ストア
 * 旧リポジトリ src/lib/stores/settings.ts の zustand 移植。
 * localStorage キー 'userSettings'・デフォルト値・deep-merge・save/load/reset/
 * applyPreset/export/import の挙動を維持する（zustand persist は使わない）。
 */

import { createStore } from 'zustand/vanilla';
import { useStore } from 'zustand';
import type { UserSettings } from '@/types/game';

// Default settings
const defaultSettings: UserSettings = {
	// GameSettings
	mode: 'practice',
	inputMode: 'partial',
	partialLength: 5,
	soundEnabled: true,
	bgmEnabled: true,
	showHints: true,
	showRomaji: true,
	fontSize: 'medium',
	theme: 'auto',

	// Extended settings
	display: {
		fontSize: 'medium',
		theme: 'auto',
		animations: true,
		animationSpeed: 'normal',
		showFurigana: true,
		showMeaning: true,
		showCardImages: true
	},
	sound: {
		effectsEnabled: true,
		effectsVolume: 50,
		bgmEnabled: true,
		bgmVolume: 50,
		typingSoundEnabled: true,
		typingSoundVolume: 50,
		voiceEnabled: false,
		voiceSpeed: 1.0
	},
	practice: {
		order: 'sequential',
		repetitions: 1,
		timeLimit: null,
		difficulty: 'custom'
	},
	keyboard: {
		layout: 'JIS',
		inputMethod: 'romaji',
		shortcuts: {
			pause: 'Escape',
			skip: 'Tab',
			retry: 'Control+R'
		}
	},
	accessibility: {
		highContrast: false,
		reduceMotion: false,
		screenReaderMode: false,
		keyboardOnly: false
	}
};

// Difficulty presets
const difficultyPresets = {
	beginner: {
		showHints: true,
		showRomaji: true,
		partialLength: 5,
		practice: {
			timeLimit: null,
			repetitions: 2
		}
	},
	intermediate: {
		showHints: false,
		showRomaji: true,
		partialLength: 7,
		practice: {
			timeLimit: 60,
			repetitions: 1
		}
	},
	advanced: {
		showHints: false,
		showRomaji: false,
		partialLength: 10,
		practice: {
			timeLimit: 30,
			repetitions: 1
		}
	}
};

// zustand vanilla ストア（状態は UserSettings そのもの）
const store = createStore<UserSettings>(() => defaultSettings);

function createSettingsStore() {
	let changedPaths = new Set<string>();

	// Helper function to get nested property
	function getNestedProperty(obj: Record<string, unknown>, path: string): unknown {
		return path
			.split('.')
			.reduce<unknown>(
				(current, key) => (current as Record<string, unknown> | undefined)?.[key],
				obj
			);
	}

	// Helper function to set nested property
	function setNestedProperty(obj: Record<string, unknown>, path: string, value: unknown): void {
		const keys = path.split('.');
		const lastKey = keys.pop()!;
		// 各階層をクローンしてから降りる。元の共有オブジェクト（defaultSettings 等）を
		// 破壊的に書き換えないようにするため。
		const target = keys.reduce<Record<string, unknown>>((current, key) => {
			current[key] = { ...((current[key] as Record<string, unknown>) ?? {}) };
			return current[key] as Record<string, unknown>;
		}, obj);
		target[lastKey] = value;
	}

	// Validation functions
	function validateRange(value: number, min: number, max: number): number {
		return Math.max(min, Math.min(max, value));
	}

	function validateValue(path: string, value: unknown): unknown {
		// Numeric range validations
		const rangeValidations: Record<string, { min: number; max: number }> = {
			partialLength: { min: 3, max: 10 },
			'sound.effectsVolume': { min: 0, max: 100 },
			'sound.bgmVolume': { min: 0, max: 100 },
			'sound.typingSoundVolume': { min: 0, max: 100 },
			'sound.voiceSpeed': { min: 0.5, max: 2.0 },
			'practice.repetitions': { min: 1, max: 5 }
		};

		if (rangeValidations[path]) {
			const { min, max } = rangeValidations[path];
			return validateRange(value as number, min, max);
		}

		// Enum validations
		const enumValidations: Record<string, string[]> = {
			'display.fontSize': ['small', 'medium', 'large', 'extra-large'],
			'display.theme': ['light', 'dark', 'auto'],
			'display.animationSpeed': ['slow', 'normal', 'fast'],
			'practice.order': ['sequential', 'random', 'weak-first'],
			'practice.difficulty': ['beginner', 'intermediate', 'advanced', 'custom'],
			'keyboard.layout': ['JIS', 'US'],
			'keyboard.inputMethod': ['romaji', 'kana']
		};

		if (enumValidations[path] && !enumValidations[path].includes(value as string)) {
			// Return current value if invalid
			return getNestedProperty(store.getState() as unknown as Record<string, unknown>, path);
		}

		return value;
	}

	return {
		// zustand ストアの現在値取得と購読（Svelte の get(store)/subscribe に相当）
		getState: store.getState,
		subscribe: store.subscribe,

		// Get default settings
		getDefaults: () => defaultSettings,

		// Update a specific setting
		updateSetting: (path: string, value: unknown) => {
			const validatedValue = validateValue(path, value);

			const newSettings = { ...store.getState() };
			setNestedProperty(newSettings as unknown as Record<string, unknown>, path, validatedValue);
			changedPaths.add(path);
			store.setState(newSettings, true);
		},

		// Apply difficulty preset
		applyPreset: (difficulty: 'beginner' | 'intermediate' | 'advanced') => {
			const preset = difficultyPresets[difficulty];

			const settings = store.getState();
			store.setState(
				{
					...settings,
					showHints: preset.showHints,
					showRomaji: preset.showRomaji,
					partialLength: preset.partialLength,
					practice: {
						...settings.practice,
						...preset.practice,
						difficulty
					}
				},
				true
			);

			// Mark relevant paths as changed
			changedPaths.add('showHints');
			changedPaths.add('showRomaji');
			changedPaths.add('partialLength');
			changedPaths.add('practice.timeLimit');
			changedPaths.add('practice.repetitions');
			changedPaths.add('practice.difficulty');
		},

		// Save settings to localStorage
		save: async () => {
			const settings = store.getState();
			try {
				localStorage.setItem('userSettings', JSON.stringify(settings));
				changedPaths.clear();
			} catch (error) {
				console.error('Failed to save settings:', error);
				throw error;
			}
		},

		// Load settings from localStorage
		load: async () => {
			try {
				const stored = localStorage.getItem('userSettings');
				if (stored) {
					const parsed = JSON.parse(stored);
					// Merge with defaults to ensure all properties exist
					const merged = {
						...defaultSettings,
						...parsed,
						display: { ...defaultSettings.display, ...parsed.display },
						sound: { ...defaultSettings.sound, ...parsed.sound },
						practice: { ...defaultSettings.practice, ...parsed.practice },
						keyboard: {
							...defaultSettings.keyboard,
							...parsed.keyboard,
							shortcuts: {
								...defaultSettings.keyboard.shortcuts,
								...parsed.keyboard?.shortcuts
							}
						},
						accessibility: { ...defaultSettings.accessibility, ...parsed.accessibility }
					};
					store.setState(merged, true);
				}
			} catch (error) {
				console.error('Failed to load settings:', error);
				// Keep default settings on error
			}
		},

		// Reset all settings to default
		reset: () => {
			store.setState(defaultSettings, true);
			changedPaths.clear();
		},

		// Reset specific section
		resetSection: (
			section: keyof UserSettings | 'display' | 'sound' | 'practice' | 'keyboard' | 'accessibility'
		) => {
			const settings = store.getState();
			const newSettings = { ...settings };

			if (section in defaultSettings) {
				// For top-level properties
				(newSettings as unknown as Record<string, unknown>)[section] = (
					defaultSettings as unknown as Record<string, unknown>
				)[section];
			} else {
				// For nested sections
				switch (section) {
					case 'display':
						newSettings.display = { ...defaultSettings.display };
						break;
					case 'sound':
						newSettings.sound = { ...defaultSettings.sound };
						break;
					case 'practice':
						newSettings.practice = { ...defaultSettings.practice };
						break;
					case 'keyboard':
						newSettings.keyboard = { ...defaultSettings.keyboard };
						break;
					case 'accessibility':
						newSettings.accessibility = { ...defaultSettings.accessibility };
						break;
				}
			}

			// Remove changed paths for this section
			changedPaths = new Set(Array.from(changedPaths).filter((path) => !path.startsWith(section)));

			store.setState(newSettings, true);
		},

		// Export settings as JSON
		export: () => {
			const settings = store.getState();
			return JSON.stringify(
				{
					version: '1.0.0',
					exportDate: new Date().toISOString(),
					settings
				},
				null,
				2
			);
		},

		// Import settings from JSON
		import: async (jsonString: string) => {
			try {
				const parsed = JSON.parse(jsonString);

				if (!parsed.settings) {
					throw new Error('Invalid settings format');
				}

				// Merge with defaults and validate
				const merged = {
					...defaultSettings,
					...parsed.settings,
					display: { ...defaultSettings.display, ...parsed.settings.display },
					sound: { ...defaultSettings.sound, ...parsed.settings.sound },
					practice: { ...defaultSettings.practice, ...parsed.settings.practice },
					keyboard: {
						...defaultSettings.keyboard,
						...parsed.settings.keyboard,
						shortcuts: {
							...defaultSettings.keyboard.shortcuts,
							...parsed.settings.keyboard?.shortcuts
						}
					},
					accessibility: { ...defaultSettings.accessibility, ...parsed.settings.accessibility }
				};

				store.setState(merged, true);
				changedPaths.clear();
			} catch (error) {
				console.error('Failed to import settings:', error);
				throw error;
			}
		},

		// Check if there are unsaved changes
		hasChanges: () => changedPaths.size > 0,

		// Get list of changed settings
		getChangedSettings: () => Array.from(changedPaths)
	};
}

export const settingsStore = createSettingsStore();

/**
 * React コンポーネント用フック。
 * セレクタ省略時は UserSettings 全体を返す。
 */
export function useSettingsStore<T = UserSettings>(
	selector: (state: UserSettings) => T = (state) => state as unknown as T
): T {
	return useStore(store, selector);
}
