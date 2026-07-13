import { useState } from 'react';
import type { KarutaCard, RandomModeDifficulty } from '@/types';

interface Props {
	card: KarutaCard | null;
	showImages?: boolean;
	shake?: boolean;
	difficulty?: RandomModeDifficulty;
}

// 元実装の inline style（filter/opacity/mix-blend-mode/background-color の強制指定）。
// React の style オブジェクトは !important を表現できないため通常の inline style として適用する。
const forceVisibleImageStyle = {
	filter: 'none',
	opacity: 1,
	mixBlendMode: 'normal',
	backgroundColor: 'white'
} as const;

export default function CardDisplay({
	card,
	showImages = true,
	shake = false,
	difficulty = 'standard'
}: Props) {
	const [imageLoadError, setImageLoadError] = useState({
		torifuda: false,
		yomifuda: false,
		kaisetsu: false
	});

	function handleImageError(type: 'torifuda' | 'yomifuda' | 'kaisetsu') {
		setImageLoadError((prev) => ({ ...prev, [type]: true }));
	}

	if (!card) {
		return null;
	}

	return (
		<>
			<style>{`
				@keyframes card-display-shake {
					0%,
					100% {
						transform: translateX(0);
					}
					30%,
					90% {
						transform: translateX(-10px);
					}
					60% {
						transform: translateX(10px);
					}
				}

				.shake-animation {
					animation: card-display-shake 0.1s ease-in-out;
				}
			`}</style>
			<div className={`mb-6 rounded-lg bg-white p-8 shadow-lg ${shake ? 'shake-animation' : ''}`}>
				{difficulty === 'advanced' ? (
					/* 上級者モード：取り札と解説画像を並べて表示 */
					<div className="flex flex-col items-center justify-center gap-6 md:flex-row">
						{/* 取り札画像 */}
						{card.images?.torifuda && !imageLoadError.torifuda ? (
							<div className="flex flex-col items-center rounded-lg bg-white p-4">
								<img
									src={card.images.torifuda.replace('.jpg', '.webp')}
									alt={`${card.meaning}の取り札`}
									className="h-auto w-full max-w-[140px] rounded object-contain shadow-xl md:max-w-[180px]"
									style={forceVisibleImageStyle}
									onError={() => handleImageError('torifuda')}
									loading="eager"
								/>
							</div>
						) : (
							/* フォールバック：画像が読み込めない場合 */
							<div className="flex h-[200px] w-[140px] items-center justify-center rounded-lg bg-gray-100">
								<p className="text-gray-500">取り札を読み込み中...</p>
							</div>
						)}

						{/* 解説画像 */}
						{card.images?.kaisetsu && !imageLoadError.kaisetsu ? (
							<div className="flex flex-col items-center rounded-lg bg-white p-4">
								<img
									src={card.images.kaisetsu.replace('.jpg', '.webp')}
									alt={`${card.meaning}の解説`}
									className="h-auto w-full max-w-[140px] rounded object-contain shadow-xl md:max-w-[180px]"
									style={forceVisibleImageStyle}
									onError={() => handleImageError('kaisetsu')}
									loading="eager"
								/>
							</div>
						) : card.id ? (
							/* 解説画像をIDから構築 */
							<div className="flex flex-col items-center rounded-lg bg-white p-4">
								<img
									src={`/images/karuta/kaisetsu/${card.id}.webp`}
									alt={`${card.meaning}の解説`}
									className="h-auto w-full max-w-[140px] rounded object-contain shadow-xl md:max-w-[180px]"
									style={forceVisibleImageStyle}
									onError={() => handleImageError('kaisetsu')}
									loading="eager"
								/>
							</div>
						) : null}
					</div>
				) : showImages && card.images ? (
					/* 通常モード：取り札と読み札を表示 */
					<div className="mb-6 flex flex-col items-center justify-center gap-4 sm:flex-row sm:gap-6">
						{card.images.torifuda && !imageLoadError.torifuda && (
							<div className="flex w-full flex-col items-center rounded-lg bg-white p-2 sm:w-auto">
								<img
									src={card.images.torifuda}
									alt={`${card.meaning}の取り札`}
									className="h-auto w-full max-w-[150px] rounded object-contain shadow sm:max-w-[180px] md:max-w-[200px]"
									style={forceVisibleImageStyle}
									onError={() => handleImageError('torifuda')}
									loading="lazy"
								/>
							</div>
						)}
						{card.images.yomifuda && !imageLoadError.yomifuda && (
							<div className="flex w-full flex-col items-center rounded-lg bg-white p-2 sm:w-auto">
								<img
									src={card.images.yomifuda}
									alt={`${card.meaning}の読み札`}
									className="h-auto w-full max-w-[150px] rounded object-contain shadow sm:max-w-[180px] md:max-w-[200px]"
									style={forceVisibleImageStyle}
									onError={() => handleImageError('yomifuda')}
									loading="lazy"
								/>
							</div>
						)}
					</div>
				) : null}
			</div>
		</>
	);
}
