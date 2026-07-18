/**
 * ユーザー設定ストア
 * 旧リポジトリ src/lib/stores/settings.ts の zustand 移植。
 * localStorage キー 'userSettings'・デフォルト値・deep-merge・save/load/reset/
 * export/import の挙動を維持する（zustand persist は使わない）。
 *
 * アカウント単位の DB 保存（ADR-0004）:
 * - ゲストは従来どおり localStorage のみ
 * - ログイン中はサーバーの設定が常に勝ち、保存は PUT /api/settings +
 *   成功後の localStorage ミラー書き（localStorage は常に「最後に適用された設定」のミラー）
 * - サーバー設定が null（DB 未保存）のときは一度だけローカル設定を DB へ引き継ぐ
 */

import { createStore } from 'zustand/vanilla';
import { useStore } from 'zustand';
import type { UserSettings } from '@/types/game';
import { updateSettings as putSettingsToServer } from '@/lib/api/settings';

// Default settings
const defaultSettings: UserSettings = {
	display: {
		fontSize: 'medium',
		theme: 'auto',
		animations: true
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
	keyboard: {
		inputMethod: 'romaji'
	}
};

// zustand vanilla ストア（状態は UserSettings そのもの）
const store = createStore<UserSettings>(() => defaultSettings);

function createSettingsStore() {
	let changedPaths = new Set<string>();

	// サーバー同期の内部状態
	let loggedIn = false;
	// 初回引き継ぎ（ローカル設定の DB 取り込み）を一度だけ発火させるガード
	let initialSyncDone = false;
	// 最後に適用したサーバースナップショット（同一スナップショットの再適用で
	// 未保存の編集を上書きしないための比較用 JSON）
	let lastServerSnapshotJson: string | null = null;

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

	// セクションをデフォルトと deep-merge する。デフォルトに存在するキーだけを採用し、
	// スリム化後の型にない未知キー（旧フル形状の残骸など）は捨てる
	function mergeSection<T extends object>(defaults: T, source: unknown): T {
		const merged = { ...defaults };
		if (source && typeof source === 'object') {
			for (const key of Object.keys(defaults) as (keyof T)[]) {
				const value = (source as Record<string, unknown>)[key as string];
				if (value !== undefined) {
					merged[key] = value as T[keyof T];
				}
			}
		}
		return merged;
	}

	// パース済みの保存値をデフォルトと deep-merge して UserSettings に正規化する
	function mergeWithDefaults(parsed: unknown): UserSettings {
		const source = (parsed ?? {}) as Record<string, unknown>;
		return {
			display: mergeSection(defaultSettings.display, source.display),
			sound: mergeSection(defaultSettings.sound, source.sound),
			keyboard: mergeSection(defaultSettings.keyboard, source.keyboard)
		};
	}

	// localStorage の保存値をデフォルトと deep-merge して返す（なければデフォルト）
	function loadLocalSettings(): UserSettings {
		try {
			const stored = localStorage.getItem('userSettings');
			if (stored) {
				return mergeWithDefaults(JSON.parse(stored));
			}
		} catch (error) {
			console.error('Failed to load settings:', error);
		}
		return defaultSettings;
	}

	// 「最後に適用された設定」を localStorage にミラー書きする
	// （DB 保存は成功済みなので、ここでの失敗はエラーにしない）
	function mirrorToLocalStorage(settings: UserSettings): void {
		try {
			localStorage.setItem('userSettings', JSON.stringify(settings));
		} catch (error) {
			console.error('Failed to mirror settings to localStorage:', error);
		}
	}

	// サーバー設定を状態に採用し、localStorage にミラー書きする
	function adoptServerSettings(settings: UserSettings): void {
		lastServerSnapshotJson = JSON.stringify(settings);
		store.setState(settings, true);
		changedPaths.clear();
		mirrorToLocalStorage(settings);
	}

	// Validation functions
	function validateRange(value: number, min: number, max: number): number {
		return Math.max(min, Math.min(max, value));
	}

	function validateValue(path: string, value: unknown): unknown {
		// Numeric range validations
		const rangeValidations: Record<string, { min: number; max: number }> = {
			'sound.effectsVolume': { min: 0, max: 100 },
			'sound.bgmVolume': { min: 0, max: 100 },
			'sound.typingSoundVolume': { min: 0, max: 100 },
			'sound.voiceSpeed': { min: 0.5, max: 2.0 }
		};

		if (rangeValidations[path]) {
			const { min, max } = rangeValidations[path];
			return validateRange(value as number, min, max);
		}

		// Enum validations
		const enumValidations: Record<string, string[]> = {
			'display.fontSize': ['small', 'medium', 'large', 'extra-large'],
			'display.theme': ['light', 'dark', 'auto'],
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

		// サーバースナップショットからの初期化（ADR-0004）。
		// ストアは React 非依存を保つため、Inertia shared props は呼び出し側から渡す。
		// - ログイン中かつ settings が non-null: サーバーの設定が常に勝ち、
		//   状態に採用したうえで localStorage にミラー書きする
		// - ログイン中かつ settings === null（DB 未保存のシグナル）: 一度だけ
		//   localStorage（なければデフォルト）を deep-merge した値を PUT で DB へ引き継ぐ
		// - ゲスト: 何もしない（localStorage のみの従来動作を維持）
		initializeFromServer: async (serverSettings: UserSettings | null, isLoggedIn: boolean) => {
			loggedIn = isLoggedIn;

			if (!isLoggedIn) {
				lastServerSnapshotJson = null;
				return;
			}

			if (serverSettings) {
				const merged = mergeWithDefaults(serverSettings);
				// 同一スナップショットの再適用はしない
				// （ページ遷移のたびに未保存の編集を上書きしないため）
				if (JSON.stringify(merged) === lastServerSnapshotJson) {
					return;
				}
				adoptServerSettings(merged);
				return;
			}

			// 初回引き継ぎは一度だけ発火する
			if (initialSyncDone) {
				return;
			}
			initialSyncDone = true;

			const local = loadLocalSettings();
			store.setState(local, true);
			try {
				const saved = mergeWithDefaults(await putSettingsToServer(local));
				adoptServerSettings(saved);
			} catch (error) {
				console.error('Failed to sync settings to server:', error);
			}
		},

		// Update a specific setting
		updateSetting: (path: string, value: unknown) => {
			const validatedValue = validateValue(path, value);

			const newSettings = { ...store.getState() };
			setNestedProperty(newSettings as unknown as Record<string, unknown>, path, validatedValue);
			changedPaths.add(path);
			store.setState(newSettings, true);
		},

		// Save settings（ログイン中は DB へ保存、ゲストは localStorage のみ）
		save: async () => {
			const settings = store.getState();

			if (loggedIn) {
				// PUT 成功後に localStorage にもミラー書きする（二重書き）。
				// 失敗時は changedPaths を維持したまま呼び出し側へエラーを伝える。
				try {
					const saved = mergeWithDefaults(await putSettingsToServer(settings));
					adoptServerSettings(saved);
				} catch (error) {
					console.error('Failed to save settings:', error);
					throw error;
				}
				return;
			}

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
					// Merge with defaults to ensure all properties exist
					const merged = mergeWithDefaults(JSON.parse(stored));
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
		resetSection: (section: keyof UserSettings) => {
			const settings = store.getState();
			const newSettings = { ...settings };

			switch (section) {
				case 'display':
					newSettings.display = { ...defaultSettings.display };
					break;
				case 'sound':
					newSettings.sound = { ...defaultSettings.sound };
					break;
				case 'keyboard':
					newSettings.keyboard = { ...defaultSettings.keyboard };
					break;
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
				const merged = mergeWithDefaults(parsed.settings);

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
		getChangedSettings: () => Array.from(changedPaths),

		// テスト用: サーバー同期の内部状態（ログインフラグ・初回引き継ぎガード）をリセットする
		resetServerSync: () => {
			loggedIn = false;
			initialSyncDone = false;
			lastServerSnapshotJson = null;
		}
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
