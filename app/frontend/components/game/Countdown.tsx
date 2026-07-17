import { useEffect, useRef, useState } from 'react';

interface Props {
	onComplete: () => void;
	duration?: number;
}

export default function Countdown({ onComplete, duration = 3 }: Props) {
	const [countdown, setCountdown] = useState(3);
	const [isVisible, setIsVisible] = useState(true);

	// 最新の onComplete を参照する（マウント時に一度だけタイマーを張るため）
	const onCompleteRef = useRef(onComplete);
	useEffect(() => {
		onCompleteRef.current = onComplete;
	}, [onComplete]);

	// duration はマウント時の値のみ使用する（旧実装の onMount と同じ）
	const durationRef = useRef(duration);

	useEffect(() => {
		// durationプロップから初期値を設定
		let current = durationRef.current;
		setCountdown(current);

		const timer = setInterval(() => {
			current--;
			setCountdown(current);

			if (current <= 0) {
				clearInterval(timer);
				setTimeout(() => {
					setIsVisible(false);
					onCompleteRef.current();
				}, 800);
			}
		}, 1000);

		return () => clearInterval(timer);
	}, []);

	if (!isVisible) {
		return null;
	}

	return (
		<>
			<style>{`
				.countdown-overlay {
					position: fixed;
					top: 0;
					left: 0;
					right: 0;
					bottom: 0;
					background: rgba(10, 26, 53, 0.85);
					backdrop-filter: blur(4px);
					display: flex;
					align-items: center;
					justify-content: center;
					z-index: 9999;
					animation: countdown-fade-in 0.3s ease-out;
				}

				.countdown-container {
					text-align: center;
					animation: countdown-scale-in 0.3s ease-out;
				}

				.countdown-number {
					font-size: 8rem;
					font-weight: 900;
					color: #e5c875;
					text-shadow:
						0 4px 24px rgba(201, 169, 97, 0.55),
						0 0 60px rgba(229, 200, 117, 0.25);
					animation: countdown-pulse 1s ease-in-out;
					margin-bottom: 1rem;
					font-family: 'Noto Serif JP', serif;
					line-height: 1;
				}

				.countdown-start {
					font-size: 4rem;
					font-weight: 900;
					color: #3fb56b;
					text-shadow: 0 4px 24px rgba(63, 181, 107, 0.5);
					font-family: 'Noto Serif JP', serif;
					animation: countdown-start-pulse 0.5s ease-out;
				}

				@keyframes countdown-fade-in {
					from {
						opacity: 0;
					}
					to {
						opacity: 1;
					}
				}

				@keyframes countdown-scale-in {
					from {
						transform: scale(0.5);
						opacity: 0;
					}
					to {
						transform: scale(1);
						opacity: 1;
					}
				}

				@keyframes countdown-pulse {
					0% {
						transform: scale(1);
					}
					50% {
						transform: scale(1.1);
					}
					100% {
						transform: scale(1);
					}
				}

				@keyframes countdown-start-pulse {
					0% {
						transform: scale(0.8);
						opacity: 0;
					}
					50% {
						transform: scale(1.2);
					}
					100% {
						transform: scale(1);
						opacity: 1;
					}
				}

				/* モバイル対応 */
				@media (max-width: 640px) {
					.countdown-number {
						font-size: 6rem;
					}

					.countdown-start {
						font-size: 3rem;
					}
				}
			`}</style>
			<div className="countdown-overlay">
				<div className="countdown-container">
					{countdown > 0 ? (
						<div className="countdown-number" data-testid="countdown-number">
							{countdown}
						</div>
					) : (
						<div className="countdown-start" data-testid="countdown-start">
							スタート！
						</div>
					)}
				</div>
			</div>
		</>
	);
}
