import { useEffect, useState } from 'react';
import { Head, router } from '@inertiajs/react';
import CardSelector from '@/components/specific/CardSelector';
import FavoritesManager from '@/components/specific/FavoritesManager';
import {
	specificCardsStore,
	canStartPractice,
	useSpecificCardsStore
} from '@/stores/specific-cards-store';
import { getKarutaCards } from '@/lib/data/karuta-cards';
import type { KarutaCard } from '@/types';

export default function PracticeSpecific() {
	const [cards, setCards] = useState<KarutaCard[]>([]);
	const [repeatCount, setRepeatCount] = useState(1);
	const [shuffleOrder, setShuffleOrder] = useState(false);
	const [isLoading, setIsLoading] = useState(true);
	const startable = useSpecificCardsStore(canStartPractice);

	// 旧 onMount の忠実な移植（マウント時に札データを読み込む）
	/* eslint-disable react-hooks/set-state-in-effect */
	useEffect(() => {
		try {
			setCards(getKarutaCards());
			setIsLoading(false);
		} catch (error) {
			setIsLoading(false);
			alert(`札の読み込みに失敗しました${error}`);
		}
	}, []);
	/* eslint-enable react-hooks/set-state-in-effect */

	function handleRepeatChange(e: React.ChangeEvent<HTMLSelectElement>) {
		const value = e.target.value;
		const count = parseInt(value);
		setRepeatCount(count);
		specificCardsStore.setRepeatCount(count);
	}

	function handleShuffleChange(e: React.ChangeEvent<HTMLInputElement>) {
		const shuffle = e.target.checked;
		setShuffleOrder(shuffle);
		specificCardsStore.setShuffleOrder(shuffle);
	}

	function startPractice() {
		if (!startable) {
			alert('最低1枚の札を選択してください');
			return;
		}

		// 選択された札で練習用リストを生成（繰り返し回数・シャッフル順を含む）
		const practiceCards = specificCardsStore.generatePracticeCards(cards);

		// 札の並び（重複・順序）を保持したままURLで特定札モードへ遷移
		const cardIds = practiceCards.map((card) => card.id).join(',');
		router.visit(`/game?mode=specific&cards=${encodeURIComponent(cardIds)}`);
	}

	function goBack() {
		router.visit('/');
	}

	return (
		<div className="container mx-auto max-w-6xl p-4">
			<Head title="特定札練習 - 上毛かるたタイピング" />
			<div className="mb-6">
				<button
					type="button"
					onClick={goBack}
					className="mb-4 px-4 py-2 text-gray-600 hover:text-gray-800"
				>
					← 戻る
				</button>

				<h1 className="mb-2 text-2xl font-bold">特定札練習モード</h1>
				<p className="text-gray-600">練習したい札を選択してください</p>
			</div>

			{isLoading ? (
				<div className="flex h-64 items-center justify-center">
					<div className="text-gray-500">読み込み中...</div>
				</div>
			) : (
				<div className="grid gap-6 lg:grid-cols-3">
					<div className="lg:col-span-2">
						<CardSelector cards={cards} />
					</div>

					<div className="space-y-4">
						<FavoritesManager />

						<div className="practice-settings">
							<h3 className="mb-3 text-lg font-semibold">練習設定</h3>

							<div className="setting-item">
								<label htmlFor="repeat-count" className="mb-1 block text-sm font-medium">
									繰り返し回数
								</label>
								<select
									id="repeat-count"
									value={String(repeatCount)}
									onChange={handleRepeatChange}
									className="w-full rounded border px-3 py-2"
								>
									<option value="1">1回</option>
									<option value="3">3回</option>
									<option value="5">5回</option>
								</select>
							</div>

							<div className="setting-item">
								<label className="flex items-center gap-2">
									<input
										type="checkbox"
										checked={shuffleOrder}
										onChange={handleShuffleChange}
										className="h-4 w-4"
									/>
									<span className="text-sm">ランダム順序で出題</span>
								</label>
							</div>

							<button
								type="button"
								onClick={startPractice}
								disabled={!startable}
								className="w-full rounded-lg bg-blue-500 py-3 font-semibold text-white transition-colors hover:bg-blue-600 disabled:cursor-not-allowed disabled:bg-gray-300"
							>
								練習開始
							</button>
						</div>
					</div>
				</div>
			)}
			<style>{`
				.practice-settings {
					padding: 1rem;
					border: 1px solid #e5e7eb;
					border-radius: 0.5rem;
					background-color: white;
				}

				.setting-item {
					margin-bottom: 1rem;
				}
			`}</style>
		</div>
	);
}
