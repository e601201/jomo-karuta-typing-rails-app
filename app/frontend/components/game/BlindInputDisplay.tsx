interface Props {
	totalChars: number;
	currentPosition: number;
	isCorrect: boolean;
	completedText?: string; // 正解した文字列
	currentChar?: string; // 現在入力中の文字
	completedRomaji?: string; // 入力したローマ字
	currentRomaji?: string; // 現在入力中のローマ字
	showHint?: boolean; // ヒント表示フラグ
	hintText?: string; // 表示する読み札全文
}

/**
 * 上級者モードのブラインド入力表示。未入力部分を伏せ字（_）で隠し、
 * Enter キーでヒント（読み札全文）を表示できる。
 */
export default function BlindInputDisplay({
	totalChars,
	currentPosition,
	isCorrect,
	completedText = '',
	currentChar = '',
	completedRomaji = '',
	currentRomaji = '',
	showHint = false,
	hintText = ''
}: Props) {
	return (
		<>
			<style>{`
				.blind-input-wrapper {
					position: relative;
					width: 100%;
				}

				.blind-input-container {
					display: flex;
					flex-direction: column;
					align-items: center;
					justify-content: center;
					gap: 1rem;
					padding: 2rem;
				}

				.completed-text-container {
					font-size: 1.75rem;
					font-family: 'Noto Serif JP', serif;
					letter-spacing: 0.15em;
					margin-bottom: 1rem;
				}

				.completed-text {
					color: #f5e9c8;
					font-weight: bold;
				}

				.current-char {
					color: #e5c875;
					font-weight: bold;
					animation: blind-input-pulse 1s ease-in-out infinite;
				}

				.current-char.error {
					color: #ff5c5c;
					animation: blind-input-shake 0.3s ease-in-out;
				}

				.remaining-placeholder {
					color: #5b6a88;
					letter-spacing: 0.2em;
				}

				@keyframes blind-input-pulse {
					0%,
					100% {
						opacity: 1;
					}
					50% {
						opacity: 0.5;
					}
				}

				@keyframes blind-input-shake {
					0%,
					100% {
						transform: translateX(0);
					}
					25% {
						transform: translateX(-4px);
					}
					75% {
						transform: translateX(4px);
					}
				}

				.romaji-container {
					font-size: 1.3rem;
					font-family: 'JetBrains Mono', monospace;
					letter-spacing: 0.05em;
					margin-bottom: 1rem;
					text-transform: uppercase;
				}

				.completed-romaji {
					color: #9c8850;
					font-weight: normal;
				}

				.current-romaji {
					color: #fff3d6;
					font-weight: bold;
					animation: blind-input-pulse 1s ease-in-out infinite;
				}

				.current-romaji.error {
					color: #ff5c5c;
					animation: blind-input-shake 0.3s ease-in-out;
				}

				.romaji-placeholder {
					color: #6b7a99;
					font-style: italic;
				}

				.hint-overlay {
					position: absolute;
					top: -120px;
					left: 50%;
					transform: translateX(-50%);
					background: rgba(10, 26, 53, 0.96);
					color: #f5e9c8;
					font-family: 'Noto Serif JP', serif;
					padding: 1rem 2rem;
					border-radius: 8px;
					font-size: 1.8rem;
					font-weight: bold;
					z-index: 100;
					animation: blind-input-fade-in 0.3s ease-in-out;
					box-shadow: 0 4px 24px rgba(0, 0, 0, 0.5);
					border: 2px solid rgba(201, 169, 97, 0.6);
					width: max-content;
					max-width: 90vw;
					text-align: center;
					white-space: nowrap;
				}

				.hint-text {
					letter-spacing: 0.1em;
					line-height: 1.5;
				}

				@keyframes blind-input-fade-in {
					from {
						opacity: 0;
						transform: translateX(-50%) translateY(-10px);
					}
					to {
						opacity: 1;
						transform: translateX(-50%) translateY(0);
					}
				}

				.hint-help {
					position: absolute;
					top: 1rem;
					right: 1rem;
					display: flex;
					align-items: center;
					gap: 0.3rem;
					padding: 0.3rem 0.6rem;
					background: rgba(201, 169, 97, 0.12);
					border: 1px solid rgba(201, 169, 97, 0.35);
					border-radius: 4px;
					animation: blind-input-pulse-glow 3s ease-in-out infinite;
					z-index: 10;
				}

				.hint-help-icon {
					font-size: 0.9rem;
					animation: blind-input-bounce 2s ease-in-out infinite;
				}

				.hint-help-text {
					font-size: 0.75rem;
					color: #e5c875;
					font-weight: 500;
					letter-spacing: 0.03em;
				}

				@keyframes blind-input-pulse-glow {
					0%,
					100% {
						background: rgba(201, 169, 97, 0.1);
						box-shadow: 0 0 0 0 rgba(201, 169, 97, 0);
					}
					50% {
						background: rgba(201, 169, 97, 0.18);
						box-shadow: 0 0 20px 5px rgba(201, 169, 97, 0.2);
					}
				}

				@keyframes blind-input-bounce {
					0%,
					100% {
						transform: translateY(0);
					}
					50% {
						transform: translateY(-3px);
					}
				}
			`}</style>
			<div className="blind-input-wrapper">
				{/* ヒント表示（Enterキーで表示） */}
				{showHint && hintText && (
					<div className="hint-overlay">
						<div className="hint-text">{hintText}</div>
					</div>
				)}

				{/* ヒント機能の説明（右端に配置） */}
				<div className="hint-help">
					<span className="hint-help-icon">💡</span>
					<span className="hint-help-text">Enterキーでヒント表示</span>
				</div>

				<div className="blind-input-container">
					{/* 正解した文字列の表示（ひらがな） */}
					{completedText ? (
						<div className="completed-text-container">
							<span className="completed-text">{completedText}</span>
							<span className={!isCorrect ? 'current-char error' : 'current-char'}>
								{currentChar}
							</span>
							<span className="remaining-placeholder">
								{'_'.repeat(Math.max(0, totalChars - currentPosition))}
							</span>
						</div>
					) : (
						/* 初期状態：全てアンダースコア */
						<div className="completed-text-container">
							<span className="remaining-placeholder">{'_'.repeat(totalChars)}</span>
						</div>
					)}

					{/* 入力したローマ字の表示 */}
					{completedRomaji ? (
						<div className="romaji-container">
							<span className="completed-romaji">{completedRomaji}</span>
							{currentRomaji && (
								<span className={!isCorrect ? 'current-romaji error' : 'current-romaji'}>
									{currentRomaji}
								</span>
							)}
						</div>
					) : (
						/* ローマ字の初期状態 */
						<div className="romaji-container">
							<span className="romaji-placeholder"> </span>
						</div>
					)}
				</div>
			</div>
		</>
	);
}
