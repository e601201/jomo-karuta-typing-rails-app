/**
 * ゲーム関連の型定義
 */

/**
 * 上毛かるたの札データ
 */
export interface KarutaCard {
	id: string; // 一意識別子 (例: 'tsu', 'ne', 'chi')
	hiragana: string; // ひらがな読み
	hiraganaShort?: string; // 初心者用の短縮版ひらがな
	romaji: string; // ローマ字表記
	meaning: string; // 意味・解説
	category: CardCategory; // カテゴリー
	difficulty: DifficultyLevel; // 難易度
	imageUrl?: string; // 絵札画像URL (オプション)
	audioUrl?: string; // 音声URL (オプション)
	images?: {
		torifuda: string; // 取り札画像パス
		yomifuda: string; // 読み札画像パス
		kaisetsu: string; // 解説画像パス
	};
}

/**
 * かるたのカテゴリー
 */
export type CardCategory = 'history' | 'geography' | 'culture' | 'nature' | 'industry';

/**
 * 難易度レベル
 */
export type DifficultyLevel = 'easy' | 'medium' | 'hard';

/**
 * ゲームモード
 */
export type GameMode =
	| 'random' // ランダム出題
	| 'timeattack' // タイムアタックモード
	| 'challenge' // チャレンジモード (Phase 3)
	| 'competition' // 競技モード (Phase 4)
	| 'multiplayer'; // 対戦モード (Phase 4)

/**
 * 部分入力モード設定
 */
export interface PartialInputConfig {
	enabled: boolean; // 部分入力モードの有効/無効
	characterCount: number; // 入力対象文字数
	mode: PartialInputMode; // 範囲決定モード
	highlightRange: boolean; // 範囲ハイライトの有無
}

/**
 * 部分入力モードの種類
 */
export type PartialInputMode = 'start' | 'random' | 'important';

/**
 * 部分入力範囲
 */
export interface PartialInputRange {
	start: number; // 開始位置（0ベース）
	end: number; // 終了位置（含まない）
	text: string; // 対象テキスト
	fullText: string; // 全文
}

/**
 * 部分入力プリセット
 */
export type PartialInputPreset = 'beginner' | 'intermediate' | 'advanced' | 'custom';

/**
 * ランダムモード難易度
 */
export type RandomModeDifficulty = 'beginner' | 'standard' | 'advanced';

/**
 * ユーザー設定
 * アカウント単位で DB 保存されるワイヤ形状（API・Inertia shared props）と一致させる
 */
export interface UserSettings {
	display: DisplaySettings;
	sound: SoundSettings;
	keyboard: KeyboardSettings;
}

/**
 * 表示設定
 */
export interface DisplaySettings {
	fontSize: 'small' | 'medium' | 'large' | 'extra-large';
	theme: 'light' | 'dark' | 'auto';
	animations: boolean;
}

/**
 * サウンド設定
 */
export interface SoundSettings {
	effectsEnabled: boolean;
	effectsVolume: number; // 0-100
	bgmEnabled: boolean;
	bgmVolume: number; // 0-100
	typingSoundEnabled: boolean;
	typingSoundVolume: number; // 0-100
	voiceEnabled: boolean;
	voiceSpeed: number; // 0.5-2.0
}

/**
 * キーボード設定
 */
export interface KeyboardSettings {
	inputMethod: 'romaji' | 'kana';
}
