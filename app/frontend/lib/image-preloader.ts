/**
 * 画像プリロードユーティリティ
 */

import type { KarutaCard } from '@/types';

export class ImagePreloader {
	private static loadedImages = new Map<string, HTMLImageElement>();
	private static loadPromises = new Map<string, Promise<HTMLImageElement>>();

	/**
	 * 単一の画像をプリロード
	 */
	private static async preloadImage(url: string): Promise<HTMLImageElement> {
		// すでに読み込み済みの場合はキャッシュを返す
		if (this.loadedImages.has(url)) {
			return this.loadedImages.get(url)!;
		}

		// 現在読み込み中の場合は既存のPromiseを返す
		if (this.loadPromises.has(url)) {
			return this.loadPromises.get(url)!;
		}

		// 新規読み込み
		const loadPromise = new Promise<HTMLImageElement>((resolve, reject) => {
			const img = new Image();

			img.onload = () => {
				this.loadedImages.set(url, img);
				this.loadPromises.delete(url);
				resolve(img);
			};

			img.onerror = () => {
				this.loadPromises.delete(url);
				reject(new Error(`Failed to load image: ${url}`));
			};

			// クロスオリジン対応
			img.crossOrigin = 'anonymous';
			img.src = url;
		});

		this.loadPromises.set(url, loadPromise);
		return loadPromise;
	}

	/**
	 * カード画像をプリロード
	 */
	static async preloadCardImages(card: KarutaCard): Promise<void> {
		const promises: Promise<unknown>[] = [];

		if (card.images?.torifuda) {
			promises.push(this.preloadImage(card.images.torifuda).catch(() => {}));
		}

		if (card.images?.yomifuda) {
			promises.push(this.preloadImage(card.images.yomifuda).catch(() => {}));
		}

		if (card.images?.kaisetsu) {
			promises.push(this.preloadImage(card.images.kaisetsu).catch(() => {}));
		}

		await Promise.all(promises);
	}

	/**
	 * 複数のカード画像を並列でプリロード
	 */
	static async preloadMultipleCards(
		cards: KarutaCard[],
		options?: {
			maxConcurrent?: number;
			onProgress?: (loaded: number, total: number) => void;
		}
	): Promise<void> {
		const maxConcurrent = options?.maxConcurrent || 6;
		const onProgress = options?.onProgress;

		let loadedCount = 0;
		const totalCards = cards.length;

		// バッチ処理で並列数を制限
		for (let i = 0; i < cards.length; i += maxConcurrent) {
			const batch = cards.slice(i, i + maxConcurrent);

			await Promise.all(
				batch.map(async (card) => {
					await this.preloadCardImages(card);
					loadedCount++;
					onProgress?.(loadedCount, totalCards);
				})
			);
		}
	}

	/**
	 * 優先度付きプリロード
	 * 最初の数枚を優先的に読み込み、残りは非同期で
	 */
	static async preloadWithPriority(cards: KarutaCard[], priorityCount = 3): Promise<void> {
		if (cards.length === 0) return;

		// 優先カードを同期的にプリロード
		const priorityCards = cards.slice(0, priorityCount);
		await this.preloadMultipleCards(priorityCards);

		// 残りのカードを非同期でプリロード
		if (cards.length > priorityCount) {
			const remainingCards = cards.slice(priorityCount);
			// 非同期で残りをプリロード（待たない）
			this.preloadMultipleCards(remainingCards).catch(() => {});
		}
	}

	/**
	 * キャッシュをクリア
	 */
	static clearCache(): void {
		this.loadedImages.clear();
		this.loadPromises.clear();
	}

	/**
	 * 特定のURLのキャッシュ状態を確認
	 */
	static isLoaded(url: string): boolean {
		return this.loadedImages.has(url);
	}

	/**
	 * プリロードされた画像要素を取得
	 */
	static getLoadedImage(url: string): HTMLImageElement | undefined {
		return this.loadedImages.get(url);
	}
}
