interface Props {
	isOpen: boolean;
	onclose: () => void;
}

export default function HowToPlayModal({ isOpen, onclose }: Props) {
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
				aria-labelledby="howtoplay-modal-title"
				tabIndex={-1}
			>
				<div className="modal-content">
					<h2 id="howtoplay-modal-title" className="modal-title">
						遊び方
					</h2>

					<div className="modal-body">
						<section className="section">
							<h3 className="section-title">上毛かるたタイピングとは</h3>
							<p className="section-content">
								群馬名物「上毛かるた」を使ったタイピングゲームです。
								<br />
								楽しく遊びながら、かるたを覚えてタイピングも上達！
							</p>
						</section>

						<section className="section">
							<h3 className="section-title">ゲームの進め方</h3>
							<ul className="rule-list">
								<li>ゲームモードを選択してください。3秒後にゲームが開始します。</li>
								<li>画面中央に表示されるひらがなを入力してください。</li>
								<li>画面左上に現在の枚数が表示されます。</li>
								<li>「、」や「ゃ」「ゅ」「ょ」などの小文字も正確に入力しましょう。</li>
								<li>
									間違えた文字は赤く表示されます。間違えた文字から再スタートしましょう。削除は必要ありません。
								</li>
								<li>取れた札の枚数や正確率、コンボ数などからスコアが計算されます。</li>
							</ul>
						</section>

						<section className="section">
							<h3 className="section-title">タイピングルール</h3>
							<ul className="rule-list">
								<li>画面に表示されるローマ字以外でも入力できます。</li>
								<li>「くさつ」は「KUSATSU」「KUSATU」でもOK。</li>
								<li>「まえばし」は「MAEBASHI」「MAEBASI」でもOK。</li>
								{/* TODO: <li>「ん」の入力について：子音の前では「N」ひとつでもOK。母音の前と単語の最後では「NN」、「XN」で打ちます。</li> */}
								<li>
									「ん」の入力について：子音の前では「N」ひとつでもOK。母音の前と単語の最後では「NN」で打ちます。
								</li>
								<ul>
									<li>「ぐんま」は「GUNMA」でも「GUNNMA」でもOK。</li>
									<li>
										「たんい」は「TANNI」で打ちます。（※「TANI」では「たに」になってしまいます）
									</li>
									<li>
										「みかん」は「MIKANN」で打ちます。（※「MIKAN」では「みかN」になってしまいます）
									</li>
								</ul>
								<li>小文字「っ」の入力について：「っ」の次の文字の最初のキーを2重に打ちます。</li>
								<ul>
									<li>「かっこう」は「KAKKOU」で打ちます。</li>
								</ul>
								{/* TODO: <li>小文字「ぁぃぅぇぉゃゅょっ」の単体入力について：大文字（A, I, U, E, O, YA, YU, YO, TU）の前に「L」か「X」をつけます。</li> */}
								{/* TODO: <li>「からっかぜ」は「KARAKKAZE」「KARALTUKAZE」「KARAXTUKAZE」でもOK。</li> */}
							</ul>
						</section>

						<section className="section">
							<h3 className="section-title">ゲームモード</h3>

							<div className="sections-row">
								<div className="feature-card">
									<h3 className="mode-title">🎮 プレイ開始 (本番モード)</h3>
									<p className="mode-desc">
										全44札がランダムな順序で出題されます。
										<br />
										制限時間は1分間です。画面右上に残り時間が表示されます。
										<br />
										正確さとスピードで高スコアを目指しましょう！
									</p>
									<br />
									<div className="mode-list">
										<div className="mode-item">
											<span className="mode-name">初心者モード</span>
											<span className="mode-desc">5~10文字程度の短いワードで練習ができます。</span>
										</div>
										<div className="mode-item">
											<span className="mode-name">標準モード</span>
											<span className="mode-desc">すべての読み札がそのまま出題されます。</span>
										</div>
									</div>
								</div>
							</div>
						</section>

						<section className="section">
							<h3 className="section-title">ランキング</h3>
							<p className="section-content">
								ランダムモードのプレイ終了後に表示される「ランキングに登録する」ボタンからランキングに登録できます。
								<br />
								全国のプレイヤーと競い合いましょう！
							</p>
						</section>
					</div>

					<div className="modal-footer">
						<button onClick={onclose} className="close-button" type="button">
							閉じる
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
					max-width: 1000px;
					width: 90%;
					max-height: 85vh;
					overflow-y: auto;
					box-shadow:
						0 20px 25px -5px rgba(0, 0, 0, 0.1),
						0 10px 10px -5px rgba(0, 0, 0, 0.04);
					animation: slideUp 0.3s ease-out;
				}

				.modal-title {
					font-size: 1.75rem;
					font-weight: bold;
					color: #166534; /* green-800 */
					margin-top: 1.5rem;
					margin-bottom: 1.5rem;
					text-align: center;
				}

				.modal-body {
					margin-bottom: 1.5rem;
				}

				.section {
					margin-bottom: 1.5rem;
				}

				.section:last-child {
					margin-bottom: 0;
				}
				.sections-row {
					display: flex;
					gap: 1rem;
					align-items: stretch;
				}

				.feature-card {
					flex: 1;
					padding: 1rem;
					border-radius: 10px;
					box-shadow: 0 4px 16px rgba(0, 0, 0, 0.06);
					border: 1px solid rgba(0, 0, 0, 0.06);
					display: flex;
					flex-direction: column;
					min-width: 0;
					background: #f0fdf4; /* green-50 */
					border-left: 4px solid #22c55e; /* green-500 */
				}
				.section-title {
					font-size: 1.25rem;
					font-weight: 600;
					color: #059669; /* green-600 */
					margin-bottom: 0.75rem;
				}

				.section-content {
					color: #4b5563; /* gray-600 */
					line-height: 1.6;
					padding-left: 1rem;
				}

				.mode-title {
					font-weight: 600;
					color: #166534; /* green-800 */
					margin-bottom: 0.25rem;
				}
				.mode-list {
					display: flex;
					flex-direction: column;
					gap: 0.75rem;
				}

				.mode-item {
					display: flex;
					flex-direction: column;
					padding-left: 1rem;
				}

				.mode-name {
					font-size: 0.875rem;
					color: #166534; /* green-800 */
					margin-bottom: 0.25rem;
				}

				.mode-desc {
					font-size: 0.875rem;
					color: #6b7280; /* gray-500 */
					padding-left: 1rem;
				}

				.rule-list {
					list-style: none;
					padding: 0;
					margin: 0.5rem 0 0 0;
					padding-left: 1rem;
				}

				.rule-list li {
					position: relative;
					padding-left: 1.5rem;
					margin-bottom: 0.5rem;
					color: #4b5563; /* gray-600 */
					line-height: 1.6;
				}

				.rule-list li::before {
					content: '•';
					position: absolute;
					left: 0.5rem;
					color: #22c55e; /* green-500 */
					font-weight: bold;
				}

				.modal-footer {
					display: flex;
					justify-content: center;
					padding-top: 1rem;
					border-top: 1px solid #e5e7eb; /* gray-200 */
				}

				.close-button {
					padding: 0.625rem 2rem;
					border: none;
					border-radius: 6px;
					background: #22c55e; /* green-500 */
					color: white;
					font-weight: 600;
					cursor: pointer;
					transition: all 0.2s ease;
				}

				.close-button:hover {
					background: #16a34a; /* green-600 */
					transform: translateY(-1px);
				}

				/* 元は Svelte のスコープ付き ul / ul ul セレクタ。
				   グローバル汚染を避けつつ詳細度を変えないよう :where() でモーダル内に限定する */
				:where(.modal-content) ul {
					margin: 0px 0px 0px 0px;
					padding: 0px 0px 0px 64px;
				}
				:where(.modal-content) ul ul {
					margin: 0px 0px 0px 0px;
					padding: 0px 0px 0px 24px;
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
						max-height: 90vh;
					}

					.modal-title {
						font-size: 1.5rem;
					}

					.section-title {
						font-size: 1rem;
					}

					.section-content,
					.rule-list li {
						font-size: 0.875rem;
					}

					.mode-desc {
						font-size: 0.75rem;
					}
				}
			`}</style>
		</>
	);
}
