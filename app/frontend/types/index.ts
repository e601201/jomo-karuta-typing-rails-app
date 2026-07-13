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
