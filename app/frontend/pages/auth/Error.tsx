import { useEffect, useState } from 'react';
import { Head, router } from '@inertiajs/react';

interface AuthErrorProps {
	message?: string | null;
}

// 旧 src/routes/auth/error/+page.svelte の移植。
export default function AuthError({ message }: AuthErrorProps) {
	const [countdown, setCountdown] = useState(5);

	useEffect(() => {
		const timer = setInterval(() => {
			setCountdown((prev) => {
				if (prev <= 1) {
					clearInterval(timer);
					router.visit('/auth/login');
					return 0;
				}
				return prev - 1;
			});
		}, 1000);

		return () => clearInterval(timer);
	}, []);

	return (
		<>
			<Head>
				<title>認証エラー - 上毛かるたタイピング</title>
			</Head>

			<div className="flex min-h-screen items-center justify-center bg-linear-to-br from-green-50 to-blue-50 px-4">
				<div className="w-full max-w-md rounded-lg bg-white p-8 text-center shadow-lg">
					<svg
						className="mx-auto mb-4 h-16 w-16 text-red-500"
						fill="none"
						stroke="currentColor"
						viewBox="0 0 24 24"
					>
						<path
							strokeLinecap="round"
							strokeLinejoin="round"
							strokeWidth="2"
							d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
						/>
					</svg>

					<h1 className="mb-4 text-2xl font-bold text-gray-800">認証エラー</h1>

					<p className="mb-6 text-gray-600">
						認証処理中にエラーが発生しました。
						<br />
						お手数ですが、もう一度ログインしてください。
					</p>

					{message && <p className="mb-6 text-xs text-gray-400">エラーコード: {message}</p>}

					<p className="mb-6 text-sm text-gray-500">
						{countdown}秒後にログイン画面にリダイレクトします...
					</p>

					<a
						href="/auth/login"
						onClick={(e) => {
							e.preventDefault();
							router.visit('/auth/login');
						}}
						className="inline-flex items-center rounded-md bg-blue-600 px-6 py-3 font-medium text-white transition-colors hover:bg-blue-700"
					>
						ログイン画面に戻る
					</a>
				</div>
			</div>
		</>
	);
}
