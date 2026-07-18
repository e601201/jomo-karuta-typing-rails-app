/**
 * 同一オリジン向けの JSON fetch ヘルパー。
 * Rails の cookie ベース CSRF 対策（XSRF-TOKEN クッキー）に対応し、
 * 'X-XSRF-TOKEN' ヘッダーを自動付与する。
 */

/** XSRF-TOKEN クッキーから CSRF トークンを取り出す */
function readXsrfToken(): string | null {
	if (typeof document === 'undefined') return null;
	const cookies = document.cookie ? document.cookie.split('; ') : [];
	for (const cookie of cookies) {
		const separatorIndex = cookie.indexOf('=');
		if (separatorIndex === -1) continue;
		const name = cookie.slice(0, separatorIndex);
		if (name === 'XSRF-TOKEN') {
			return decodeURIComponent(cookie.slice(separatorIndex + 1));
		}
	}
	return null;
}

/** レスポンスが !ok のときに投げるエラー（JSON エラーボディがあれば保持する） */
export class HttpError extends Error {
	status: number;
	body: unknown;

	constructor(status: number, message: string, body: unknown) {
		super(message);
		this.name = 'HttpError';
		this.status = status;
		this.body = body;
	}
}

async function parseResponse<T>(response: Response): Promise<T> {
	const text = await response.text();
	if (!response.ok) {
		let body: unknown = text;
		let message = `HTTP ${response.status}`;
		try {
			body = JSON.parse(text);
			if (
				body &&
				typeof body === 'object' &&
				'error' in body &&
				typeof (body as { error: unknown }).error === 'string'
			) {
				message = (body as { error: string }).error;
			}
		} catch {
			// JSON でないボディはそのまま保持する
		}
		throw new HttpError(response.status, message, body);
	}
	if (!text) {
		return undefined as T;
	}
	return JSON.parse(text) as T;
}

function buildHeaders(withContentType: boolean): HeadersInit {
	const headers: Record<string, string> = {
		Accept: 'application/json'
	};
	if (withContentType) {
		headers['Content-Type'] = 'application/json';
	}
	const token = readXsrfToken();
	if (token) {
		headers['X-XSRF-TOKEN'] = token;
	}
	return headers;
}

/** 同一オリジンへの JSON POST。!ok なら HttpError を投げる */
export async function postJson<T>(url: string, body: unknown): Promise<T> {
	const response = await fetch(url, {
		method: 'POST',
		headers: buildHeaders(true),
		credentials: 'same-origin',
		body: JSON.stringify(body)
	});
	return parseResponse<T>(response);
}

/** 同一オリジンへの JSON PUT。!ok なら HttpError を投げる */
export async function putJson<T>(url: string, body: unknown): Promise<T> {
	const response = await fetch(url, {
		method: 'PUT',
		headers: buildHeaders(true),
		credentials: 'same-origin',
		body: JSON.stringify(body)
	});
	return parseResponse<T>(response);
}

/** 同一オリジンへの JSON GET。!ok なら HttpError を投げる */
export async function getJson<T>(url: string): Promise<T> {
	const response = await fetch(url, {
		method: 'GET',
		headers: buildHeaders(false),
		credentials: 'same-origin'
	});
	return parseResponse<T>(response);
}
