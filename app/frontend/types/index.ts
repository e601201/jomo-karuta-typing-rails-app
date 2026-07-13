// ゲーム関連（旧リポジトリ $lib/types の再エクスポートを踏襲）
export type {
	KarutaCard,
	GameMode,
	PartialInputConfig,
	PartialInputMode,
	PartialInputRange,
	PartialInputPreset,
	RandomModeDifficulty
} from './game';

// Inertia 共有 props
export type FlashData = {
	notice?: string;
	alert?: string;
};

export type AuthUser = {
	id: number;
	email: string;
	nickname: string | null;
	created_at: string;
};

export type SharedProps = {
	auth: { user: AuthUser | null };
	csrf_token: string;
	flash: FlashData;
};
