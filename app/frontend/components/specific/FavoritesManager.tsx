import { useCallback, useEffect, useState } from 'react';
import {
	specificCardsStore,
	type Favorite,
	type SpecificCardsState
} from '@/stores/specific-cards-store';
import { favoritesService } from '@/lib/storage/favorites-service';

export default function FavoritesManager() {
	const [favorites, setFavorites] = useState<Favorite[]>([]);
	const [showNewDialog, setShowNewDialog] = useState(false);
	const [newFavoriteName, setNewFavoriteName] = useState('');
	const [errorMessage, setErrorMessage] = useState('');
	const [isComposing, setIsComposing] = useState(false);

	const loadFavorites = useCallback(async () => {
		try {
			setFavorites(await favoritesService.getFavorites());
		} catch (error) {
			console.error('Failed to load favorites:', error);
		}
	}, []);

	// 旧 onMount の忠実な移植（マウント時にお気に入りを読み込む）
	/* eslint-disable react-hooks/set-state-in-effect */
	useEffect(() => {
		void loadFavorites();
	}, [loadFavorites]);
	/* eslint-enable react-hooks/set-state-in-effect */

	function openNewDialog() {
		setShowNewDialog(true);
		setNewFavoriteName('');
		setErrorMessage('');
	}

	function closeDialog() {
		setShowNewDialog(false);
		setNewFavoriteName('');
		setErrorMessage('');
	}

	async function saveFavorite() {
		if (!newFavoriteName.trim()) {
			setErrorMessage('名前を入力してください');
			return;
		}

		const isDuplicate = await favoritesService.isNameDuplicate(newFavoriteName);
		if (isDuplicate) {
			setErrorMessage('この名前は既に使用されています');
			return;
		}

		const success = specificCardsStore.saveFavorite(newFavoriteName);
		if (success) {
			// Get the current state properly
			const currentState: SpecificCardsState = specificCardsStore.getState();

			const latestFavorite = currentState.favorites[currentState.favorites.length - 1];

			await favoritesService.saveFavorite(latestFavorite);
			await loadFavorites();
			closeDialog();
		}
	}

	function loadFavorite(favoriteId: string) {
		specificCardsStore.loadFavorite(favoriteId);
	}

	async function deleteFavorite(favoriteId: string) {
		if (confirm('このお気に入りを削除しますか？')) {
			specificCardsStore.deleteFavorite(favoriteId);
			await favoritesService.deleteFavorite(favoriteId);
			await loadFavorites();
		}
	}

	function handleKeydown(e: React.KeyboardEvent<HTMLInputElement>) {
		// IMEで変換中の場合はEnterキーで保存しない
		if (e.key === 'Enter' && !isComposing) {
			void saveFavorite();
		}
	}

	function handleCompositionStart() {
		setIsComposing(true);
	}

	function handleCompositionEnd() {
		setIsComposing(false);
	}

	return (
		<div className="favorites-manager">
			<div className="manager-header">
				<h3 className="text-lg font-semibold">お気に入り</h3>
				<button
					type="button"
					onClick={openNewDialog}
					className="rounded bg-green-500 px-3 py-1 text-sm text-white hover:bg-green-600"
				>
					保存
				</button>
			</div>

			{favorites.length > 0 ? (
				<div className="favorites-list">
					{favorites.map((favorite) => (
						<div className="favorite-item" key={favorite.id}>
							<button
								type="button"
								onClick={() => loadFavorite(favorite.id)}
								className="favorite-name"
							>
								{favorite.name}
								<span className="card-count">({favorite.cardIds.length}枚)</span>
							</button>
							<button
								type="button"
								onClick={() => void deleteFavorite(favorite.id)}
								className="delete-btn"
								aria-label="削除"
							>
								×
							</button>
						</div>
					))}
				</div>
			) : (
				<p className="mt-2 text-sm text-gray-500">お気に入りがありません</p>
			)}

			{showNewDialog && (
				<div
					className="dialog-overlay"
					onClick={closeDialog}
					onKeyDown={(e) => e.key === 'Escape' && closeDialog()}
					role="dialog"
					aria-modal="true"
					tabIndex={-1}
				>
					<div
						className="dialog"
						onClick={(e) => e.stopPropagation()}
						onKeyDown={(e) => e.key === 'Enter' && e.stopPropagation()}
						role="presentation"
					>
						<h4 className="mb-3 text-lg font-semibold">お気に入りを保存</h4>
						<input
							type="text"
							value={newFavoriteName}
							onChange={(e) => setNewFavoriteName(e.target.value)}
							placeholder="名前を入力"
							className="mb-2 w-full rounded border px-3 py-2"
							onKeyDown={handleKeydown}
							onCompositionStart={handleCompositionStart}
							onCompositionEnd={handleCompositionEnd}
						/>
						{errorMessage && <p className="mb-2 text-sm text-red-500">{errorMessage}</p>}
						<div className="flex justify-end gap-2">
							<button
								type="button"
								onClick={closeDialog}
								className="rounded border px-4 py-2 text-gray-600 hover:bg-gray-50"
							>
								キャンセル
							</button>
							<button
								type="button"
								onClick={() => void saveFavorite()}
								className="rounded bg-blue-500 px-4 py-2 text-white hover:bg-blue-600"
							>
								保存
							</button>
						</div>
					</div>
				</div>
			)}
			<style>{`
				.favorites-manager {
					padding: 1rem;
					border: 1px solid #e5e7eb;
					border-radius: 0.5rem;
					background-color: #f9fafb;
				}

				.manager-header {
					display: flex;
					justify-content: space-between;
					align-items: center;
					margin-bottom: 0.75rem;
				}

				.favorites-list {
					display: flex;
					flex-direction: column;
					gap: 0.5rem;
				}

				.favorite-item {
					display: flex;
					justify-content: space-between;
					align-items: center;
					padding: 0.5rem;
					background-color: white;
					border: 1px solid #e5e7eb;
					border-radius: 0.25rem;
				}

				.favorite-name {
					flex: 1;
					text-align: left;
					transition: color 0.2s;
				}

				.favorite-name:hover {
					color: #2563eb;
				}

				.card-count {
					margin-left: 0.5rem;
					font-size: 0.875rem;
					color: #6b7280;
				}

				.delete-btn {
					width: 1.5rem;
					height: 1.5rem;
					border-radius: 0.25rem;
					color: #ef4444;
					transition: background-color 0.2s;
				}

				.delete-btn:hover {
					background-color: #fef2f2;
				}

				.dialog-overlay {
					position: fixed;
					inset: 0;
					z-index: 50;
					display: flex;
					align-items: center;
					justify-content: center;
					background-color: rgba(0, 0, 0, 0.5);
				}

				.dialog {
					width: 24rem;
					max-width: 100%;
					padding: 1.25rem;
					background-color: white;
					border-radius: 0.5rem;
				}
			`}</style>
		</div>
	);
}
