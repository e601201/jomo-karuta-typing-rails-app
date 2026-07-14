import { useEffect, useRef, useState } from 'react';
import { karutaCards } from '@/lib/data/karuta-cards';

// アニメーション設定
const SCROLL_SPEED = 0.5; // ピクセル/フレーム
const YOMIFUDA_CARD_WIDTH = 130; // 読み札の幅 + 間隔
const TORIFUDA_CARD_WIDTH = 120; // 取り札の幅 + 間隔

export default function KarutaSlideshow() {
	// 初期状態では順序を固定（SSRとクライアントで同じ順序を保証）
	const [displayYomifuda, setDisplayYomifuda] = useState(() => [...karutaCards, ...karutaCards]);
	const [displayTorifuda, setDisplayTorifuda] = useState(() => [...karutaCards, ...karutaCards]);

	const yomifudaRef = useRef<HTMLDivElement | null>(null);
	const torifudaRef = useRef<HTMLDivElement | null>(null);
	const isPausedRef = useRef(false);

	useEffect(() => {
		// クライアント側でのみランダム化を実行
		// （SSR/ハイドレーション時の順序一致を保つため、マウント後に一度だけシャッフルする）
		const shuffledYomifuda = [...karutaCards].sort(() => Math.random() - 0.5);
		const shuffledTorifuda = [...karutaCards].sort(() => Math.random() - 0.5);
		// eslint-disable-next-line react-hooks/set-state-in-effect -- マウント後のシャッフル反映（外部の乱数との同期）
		setDisplayYomifuda([...shuffledYomifuda, ...shuffledYomifuda]);
		setDisplayTorifuda([...shuffledTorifuda, ...shuffledTorifuda]);
		const YOMIFUDA_TOTAL_WIDTH = shuffledYomifuda.length * YOMIFUDA_CARD_WIDTH;
		const TORIFUDA_TOTAL_WIDTH = shuffledTorifuda.length * TORIFUDA_CARD_WIDTH;

		let yomifudaScrollPosition = 0;
		// 取り札の初期位置を右端に設定（負の値で右側から開始）
		let torifudaScrollPosition = -TORIFUDA_TOTAL_WIDTH;
		let animationId: number;

		function animate() {
			if (!isPausedRef.current) {
				// 読み札は右から左へ（既存のまま）
				yomifudaScrollPosition += SCROLL_SPEED;

				// 取り札は左から右へ（値を増やして右へ移動）
				torifudaScrollPosition += SCROLL_SPEED;

				// 読み札: 1セット分スクロールしたらリセット
				if (yomifudaScrollPosition >= YOMIFUDA_TOTAL_WIDTH) {
					yomifudaScrollPosition = 0;
				}

				// 取り札: 右端に達したらリセット（左端から再開）
				if (torifudaScrollPosition >= 0) {
					torifudaScrollPosition = -TORIFUDA_TOTAL_WIDTH;
				}

				if (yomifudaRef.current) {
					yomifudaRef.current.style.transform = `translateX(-${yomifudaScrollPosition}px)`;
				}

				if (torifudaRef.current) {
					torifudaRef.current.style.transform = `translateX(${torifudaScrollPosition}px)`;
				}
			}

			animationId = requestAnimationFrame(animate);
		}

		animate();

		return () => {
			if (animationId) {
				cancelAnimationFrame(animationId);
			}
		};
	}, []);

	function handleMouseEnter() {
		isPausedRef.current = true;
	}

	function handleMouseLeave() {
		isPausedRef.current = false;
	}

	return (
		<div className="karuta-slideshow-container">
			{/* 取り札（上段、左から右へ） */}
			<div className="karuta-slideshow-wrapper torifuda-wrapper">
				<div
					className="karuta-slideshow"
					ref={torifudaRef}
					onMouseEnter={handleMouseEnter}
					onMouseLeave={handleMouseLeave}
					role="region"
					aria-label="取り札のスライドショー"
				>
					{displayTorifuda.map((card, index) => (
						<div
							className="karuta-card torifuda-card"
							data-nosnippet=""
							key={card.id + '-torifuda-' + index}
						>
							<img
								src={card.images?.torifuda || `/images/karuta/torifuda/${card.id}.webp`}
								alt={`取り札: ${card.id}`}
								loading="lazy"
								className="karuta-image torifuda-image"
							/>
						</div>
					))}
				</div>
			</div>

			{/* 読み札（下段、右から左へ） */}
			<div className="karuta-slideshow-wrapper yomifuda-wrapper">
				<div
					className="karuta-slideshow"
					ref={yomifudaRef}
					onMouseEnter={handleMouseEnter}
					onMouseLeave={handleMouseLeave}
					role="region"
					aria-label="読み札のスライドショー"
				>
					{displayYomifuda.map((card, index) => (
						<div
							className="karuta-card yomifuda-card"
							data-nosnippet=""
							key={card.id + '-yomifuda-' + index}
						>
							<img
								src={card.images?.yomifuda || `/images/karuta/yomifuda/${card.id}.webp`}
								alt={card.hiragana}
								loading="lazy"
								className="karuta-image yomifuda-image"
							/>
						</div>
					))}
				</div>
			</div>

			<style>{`
				.karuta-slideshow-container {
					position: relative;
					width: 100%;
					height: 280px; /* 2段分の高さ */
					overflow: hidden;
					margin: 1.5rem 0;
					/* 左右のフェード効果（背景を問わず透明化するマスク方式） */
					-webkit-mask-image: linear-gradient(
						to right,
						transparent 0%,
						black 100px,
						black calc(100% - 100px),
						transparent 100%
					);
					mask-image: linear-gradient(
						to right,
						transparent 0%,
						black 100px,
						black calc(100% - 100px),
						transparent 100%
					);
				}

				.karuta-slideshow-wrapper {
					position: absolute;
					width: 100%;
					height: 130px; /* 各段の高さ */
					display: flex;
					align-items: center;
					overflow: hidden;
				}

				.torifuda-wrapper {
					top: 0;
				}

				.yomifuda-wrapper {
					bottom: 0;
				}

				.karuta-slideshow {
					display: flex;
					gap: 1rem;
					transition: transform 0.1s linear;
					will-change: transform;
				}

				.karuta-card {
					flex-shrink: 0;
					width: 100px; /* カードの幅 */
					height: 120px; /* カードの高さ */
					position: relative;
					border-radius: 8px;
					overflow: hidden;
					box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
					transition:
						transform 0.3s ease,
						box-shadow 0.3s ease;
					cursor: pointer;
				}

				.karuta-card:hover {
					transform: translateY(-5px) scale(1.05);
					box-shadow: 0 8px 12px rgba(0, 0, 0, 0.2);
					z-index: 10;
				}

				.karuta-image {
					width: 100%;
					height: 100%;
					object-fit: cover;
				}

				/* 取り札のスタイル調整 */
				.torifuda-card {
					width: 90px; /* 幅 */
					height: 108px; /* 縦横比を維持 */
				}

				.torifuda-image {
					object-fit: contain; /* coverからcontainに戻して見切れを防ぐ */
				}

				/* レスポンシブ対応 */
				@media (max-width: 640px) {
					.karuta-slideshow-container {
						height: 220px; /* 2段分に調整 */
						-webkit-mask-image: linear-gradient(
							to right,
							transparent 0%,
							black 60px,
							black calc(100% - 60px),
							transparent 100%
						);
						mask-image: linear-gradient(
							to right,
							transparent 0%,
							black 60px,
							black calc(100% - 60px),
							transparent 100%
						);
					}

					.karuta-slideshow-wrapper {
						height: 100px;
					}

					.karuta-card {
						width: 75px;
						height: 90px;
					}

					.torifuda-card {
						width: 70px;
						height: 84px;
					}
				}

				/* アニメーションの滑らかさを向上 */
				@media (prefers-reduced-motion: reduce) {
					.karuta-slideshow {
						animation: none !important;
					}

					.karuta-card:hover {
						transform: none;
					}
				}
			`}</style>
		</div>
	);
}
