/**
 * お気に入り管理サービス
 * TASK-302: 特定札練習モードのお気に入り機能
 */

import type { UpdateSpec } from 'dexie';
import { db, type FavoriteData } from './indexed-db';
import type { Favorite } from '@/stores/specific-cards-store';

export class FavoritesService {
	/**
	 * お気に入りを保存
	 */
	async saveFavorite(favorite: Favorite): Promise<void> {
		try {
			await db.favorites.put({
				...favorite,
				createdAt: favorite.createdAt.toISOString(),
				updatedAt: new Date().toISOString()
			});
		} catch (error) {
			console.error('Failed to save favorite:', error);
			throw error;
		}
	}

	/**
	 * すべてのお気に入りを取得
	 */
	async getFavorites(): Promise<Favorite[]> {
		try {
			const favorites = await db.favorites.toArray();
			return favorites.map((f) => ({
				...f,
				createdAt: new Date(f.createdAt)
			}));
		} catch (error) {
			console.error('Failed to get favorites:', error);
			return [];
		}
	}

	/**
	 * お気に入りを削除
	 */
	async deleteFavorite(favoriteId: string): Promise<void> {
		try {
			await db.favorites.delete(favoriteId);
		} catch (error) {
			console.error('Failed to delete favorite:', error);
			throw error;
		}
	}

	/**
	 * お気に入りを更新
	 */
	async updateFavorite(favoriteId: string, updates: Partial<Favorite>): Promise<void> {
		try {
			const updateData: UpdateSpec<FavoriteData> = {
				updatedAt: new Date().toISOString()
			};

			if (updates.name !== undefined) updateData.name = updates.name;
			if (updates.cardIds !== undefined) updateData.cardIds = updates.cardIds;

			await db.favorites.update(favoriteId, updateData);
		} catch (error) {
			console.error('Failed to update favorite:', error);
			throw error;
		}
	}

	/**
	 * お気に入り名の重複チェック
	 */
	async isNameDuplicate(name: string, excludeId?: string): Promise<boolean> {
		try {
			const favorites = await db.favorites.where('name').equals(name).toArray();
			if (excludeId) {
				return favorites.some((f) => f.id !== excludeId);
			}
			return favorites.length > 0;
		} catch (error) {
			console.error('Failed to check name duplicate:', error);
			return false;
		}
	}

	/**
	 * お気に入りをインポート（ローカルストレージから移行用）
	 */
	async importFavorites(favorites: Favorite[]): Promise<void> {
		try {
			await db.transaction('rw', db.favorites, async () => {
				for (const favorite of favorites) {
					await db.favorites.put({
						...favorite,
						createdAt:
							favorite.createdAt instanceof Date
								? favorite.createdAt.toISOString()
								: favorite.createdAt,
						updatedAt: new Date().toISOString()
					});
				}
			});
		} catch (error) {
			console.error('Failed to import favorites:', error);
			throw error;
		}
	}

	/**
	 * すべてのお気に入りを削除
	 */
	async clearFavorites(): Promise<void> {
		try {
			await db.favorites.clear();
		} catch (error) {
			console.error('Failed to clear favorites:', error);
			throw error;
		}
	}
}

export const favoritesService = new FavoritesService();
