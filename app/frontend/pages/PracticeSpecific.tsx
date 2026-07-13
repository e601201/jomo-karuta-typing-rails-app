import { Head, Link } from '@inertiajs/react';

// TODO(Phase 5): 旧 /practice/specific の札選択 UI（CardSelector / FavoritesManager /
// 繰り返し回数 / シャッフル）を移植する
export default function PracticeSpecific() {
	return (
		<main className="min-h-screen bg-gray-50">
			<Head title="特定札練習 - 上毛かるたタイピング" />
			<div className="container mx-auto max-w-4xl px-4 py-8">
				<h1 className="mb-6 text-2xl font-bold text-gray-800">特定札練習</h1>
				<p className="mb-6 text-gray-600">特定札選択画面は準備中です。</p>
				<Link href="/" className="text-blue-600 hover:underline">
					メインメニューに戻る
				</Link>
			</div>
		</main>
	);
}
