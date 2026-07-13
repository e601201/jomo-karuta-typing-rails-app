interface Props {
	isOpen: boolean;
	onclose: () => void;
	onselect: (mode: 'practice' | 'specific') => void;
}

export default function PracticeModeModal({ isOpen, onclose, onselect }: Props) {
	function handlePracticeMode() {
		onselect('practice');
		onclose();
	}

	function handleSpecificMode() {
		onselect('specific');
		onclose();
	}

	function handleBackdropClick(event: React.MouseEvent) {
		if (event.target === event.currentTarget) {
			onclose();
		}
	}

	function handleKeydown(event: React.KeyboardEvent) {
		if (event.key === 'Escape') {
			onclose();
		}
	}

	if (!isOpen) return null;

	return (
		<>
			<div
				className="modal-backdrop"
				onClick={handleBackdropClick}
				onKeyDown={handleKeydown}
				role="dialog"
				aria-modal="true"
				aria-labelledby="practice-modal-title"
				tabIndex={-1}
			>
				<div className="modal-content">
					<h2 id="practice-modal-title" className="modal-title">
						練習モードを選択
					</h2>

					<div className="modal-body">
						<p className="modal-description">どちらの練習モードで始めますか？</p>

						<div className="button-container">
							<button
								onClick={handlePracticeMode}
								className="mode-button practice-button"
								type="button"
							>
								<span className="button-icon">📚</span>
								<span className="button-title">全44札を順番に練習</span>
							</button>

							<button
								onClick={handleSpecificMode}
								className="mode-button specific-button"
								type="button"
							>
								<span className="button-icon">🎯</span>
								<span className="button-title">特定札で練習</span>
								<span className="button-description"> 好みの札を選んで、集中的に練習します </span>
							</button>
						</div>
					</div>

					<div className="modal-footer">
						<button onClick={onclose} className="cancel-button" type="button">
							キャンセル
						</button>
					</div>
				</div>
			</div>
			<style>{`
				.modal-backdrop {
					position: fixed;
					top: 0;
					left: 0;
					right: 0;
					bottom: 0;
					background: rgba(0, 0, 0, 0.5);
					display: flex;
					align-items: center;
					justify-content: center;
					z-index: 1000;
					animation: fadeIn 0.2s ease-out;
				}

				.modal-content {
					background: white;
					border-radius: 12px;
					padding: 2rem;
					max-width: 500px;
					width: 90%;
					max-height: 90vh;
					overflow-y: auto;
					box-shadow:
						0 20px 25px -5px rgba(0, 0, 0, 0.1),
						0 10px 10px -5px rgba(0, 0, 0, 0.04);
					animation: slideUp 0.3s ease-out;
				}

				.modal-title {
					font-size: 1.5rem;
					font-weight: bold;
					color: #166534; /* green-800 */
					margin-bottom: 1rem;
					text-align: center;
				}

				.modal-body {
					margin-bottom: 1.5rem;
				}

				.modal-description {
					text-align: center;
					color: #4b5563; /* gray-600 */
					margin-bottom: 1.5rem;
				}

				.button-container {
					display: flex;
					flex-direction: column;
					gap: 1rem;
				}

				.mode-button {
					display: flex;
					flex-direction: column;
					align-items: center;
					padding: 1.5rem;
					border: 2px solid #e5e7eb; /* gray-200 */
					border-radius: 8px;
					background: white;
					cursor: pointer;
					transition: all 0.2s ease;
					text-align: center;
				}

				.mode-button:hover {
					border-color: #22c55e; /* green-500 */
					background: #f0fdf4; /* green-50 */
					transform: translateY(-2px);
					box-shadow:
						0 4px 6px -1px rgba(0, 0, 0, 0.1),
						0 2px 4px -1px rgba(0, 0, 0, 0.06);
				}

				.button-icon {
					font-size: 2.5rem;
					margin-bottom: 0.75rem;
				}

				.button-title {
					font-size: 1.125rem;
					font-weight: 600;
					color: #1f2937; /* gray-800 */
					margin-bottom: 0.5rem;
				}

				.button-description {
					font-size: 0.875rem;
					color: #6b7280; /* gray-500 */
				}

				.modal-footer {
					display: flex;
					justify-content: center;
					padding-top: 1rem;
					border-top: 1px solid #e5e7eb; /* gray-200 */
				}

				.cancel-button {
					padding: 0.5rem 1.5rem;
					border: 1px solid #d1d5db; /* gray-300 */
					border-radius: 6px;
					background: white;
					color: #4b5563; /* gray-600 */
					font-weight: 500;
					cursor: pointer;
					transition: all 0.2s ease;
				}

				.cancel-button:hover {
					background: #f9fafb; /* gray-50 */
					border-color: #9ca3af; /* gray-400 */
				}

				@keyframes fadeIn {
					from {
						opacity: 0;
					}
					to {
						opacity: 1;
					}
				}

				@keyframes slideUp {
					from {
						transform: translateY(20px);
						opacity: 0;
					}
					to {
						transform: translateY(0);
						opacity: 1;
					}
				}

				/* モバイル対応 */
				@media (max-width: 640px) {
					.modal-content {
						padding: 1.5rem;
						width: 95%;
					}

					.modal-title {
						font-size: 1.25rem;
					}

					.mode-button {
						padding: 1rem;
					}

					.button-icon {
						font-size: 2rem;
					}

					.button-title {
						font-size: 1rem;
					}

					.button-description {
						font-size: 0.75rem;
					}
				}
			`}</style>
		</>
	);
}
