import { Head, Link } from '@inertiajs/react';

// TODO(Phase 5): 旧 /settings の 7 セクション設定画面を移植する
export default function Settings() {
	return (
		<main className="min-h-screen bg-gray-50">
			<Head title="設定 - 上毛かるたタイピング" />
			<div className="container mx-auto max-w-4xl px-4 py-8">
				<h1 className="mb-6 text-2xl font-bold text-gray-800">設定</h1>
				<p className="mb-6 text-gray-600">設定画面は準備中です。</p>
				<Link href="/" className="text-blue-600 hover:underline">
					メインメニューに戻る
				</Link>
			</div>
		</main>
	);
}
