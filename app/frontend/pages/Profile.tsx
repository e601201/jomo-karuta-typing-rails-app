import { Head, Link, router, usePage } from '@inertiajs/react';
import type { SharedProps } from '@/types';

// 旧 src/routes/profile/+page.svelte の移植。
// ユーザー情報は inertia_share の auth props から取得する（サーバ側 require_login 保護済み）。
export default function Profile() {
	const { auth } = usePage().props as unknown as SharedProps;
	const user = auth.user;

	return (
		<>
			<Head>
				<title>プロフィール - 上毛かるたタイピング</title>
			</Head>

			<div className="min-h-screen bg-linear-to-br from-green-50 to-blue-50 px-4 py-8">
				<div className="mx-auto max-w-4xl">
					<div className="mb-8 rounded-lg bg-white p-8 shadow-lg">
						<div className="mb-6 flex items-center justify-between">
							<h1 className="text-3xl font-bold text-gray-800">プロフィール</h1>
							<div className="flex gap-4">
								<Link
									href="/auth/logout"
									method="delete"
									as="button"
									className="font-medium text-red-600 hover:text-red-700"
								>
									ログアウト
								</Link>
							</div>
						</div>

						<div className="grid gap-8 md:grid-cols-2">
							<div>
								<h2 className="mb-4 text-xl font-semibold text-gray-700">ユーザー情報</h2>
								<div className="space-y-3">
									<div>
										<p className="text-sm text-gray-500">メールアドレス</p>
										<p className="text-gray-800">{user?.email}</p>
									</div>
									<div>
										<p className="text-sm text-gray-500">ニックネーム</p>
										<p className="text-gray-800">{user?.nickname || user?.email?.split('@')[0]}</p>
									</div>
									<div>
										<p className="text-sm text-gray-500">登録日</p>
										<p className="text-gray-800">
											{user?.created_at
												? new Date(user.created_at).toLocaleDateString('ja-JP')
												: '-'}
										</p>
									</div>
								</div>
							</div>
						</div>
					</div>

					<div className="mt-8 text-center">
						<a
							href="/"
							onClick={(e) => {
								e.preventDefault();
								router.visit('/');
							}}
							className="inline-flex items-center rounded-md bg-blue-600 px-6 py-3 font-medium text-white transition-colors hover:bg-blue-700"
						>
							ホームに戻る
						</a>
					</div>
				</div>
			</div>
		</>
	);
}
