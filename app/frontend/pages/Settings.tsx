import { useEffect, useState } from 'react';
import { Head, router } from '@inertiajs/react';
import { settingsStore, useSettingsStore } from '@/stores/settings-store';
import SettingItem from '@/components/settings/SettingItem';

// Section navigation
const sections = [
	{ id: 'game', label: 'ゲームプレイ', icon: '🎮' },
	{ id: 'display', label: '表示', icon: '🖥️' },
	{ id: 'sound', label: 'サウンド', icon: '🔊' },
	{ id: 'practice', label: '練習', icon: '📚' },
	{ id: 'keyboard', label: 'キーボード', icon: '⌨️' },
	{ id: 'accessibility', label: 'アクセシビリティ', icon: '♿' },
	{ id: 'data', label: 'データ管理', icon: '💾' }
];

// Options for select/radio inputs
const fontSizeOptions = [
	{ value: 'small', label: '小 (14px)' },
	{ value: 'medium', label: '中 (18px)' },
	{ value: 'large', label: '大 (22px)' },
	{ value: 'extra-large', label: '特大 (26px)' }
];

const themeOptions = [
	{ value: 'light', label: 'ライト' },
	{ value: 'dark', label: 'ダーク' },
	{ value: 'auto', label: '自動' }
];

const animationSpeedOptions = [
	{ value: 'slow', label: '遅い' },
	{ value: 'normal', label: '標準' },
	{ value: 'fast', label: '速い' }
];

const orderOptions = [
	{ value: 'sequential', label: '順番' },
	{ value: 'random', label: 'ランダム' },
	{ value: 'weak-first', label: '苦手札優先' }
];

const difficultyOptions = [
	{ value: 'beginner', label: '初級' },
	{ value: 'intermediate', label: '中級' },
	{ value: 'advanced', label: '上級' },
	{ value: 'custom', label: 'カスタム' }
];

const layoutOptions = [
	{ value: 'JIS', label: 'JIS配列' },
	{ value: 'US', label: 'US配列' }
];

const inputMethodOptions = [
	{ value: 'romaji', label: 'ローマ字入力' },
	{ value: 'kana', label: 'かな入力' }
];

export default function Settings() {
	const settings = useSettingsStore();
	const [activeSection, setActiveSection] = useState('game');
	const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
	const [showResetConfirm, setShowResetConfirm] = useState(false);
	const [resetSection, setResetSection] = useState<string | null>(null);

	// 旧 $effect（ストア更新のたびに未保存フラグを再計算する）の忠実な移植
	/* eslint-disable react-hooks/set-state-in-effect */
	useEffect(() => {
		setHasUnsavedChanges(settingsStore.hasChanges());
	}, [settings]);
	/* eslint-enable react-hooks/set-state-in-effect */

	// 旧 onMount の忠実な移植（マウント時に localStorage から設定を読み込む）
	useEffect(() => {
		void settingsStore.load();
	}, []);

	// Event handlers
	async function handleSave() {
		await settingsStore.save();
		setHasUnsavedChanges(false);
		// Show success message
		alert('設定を保存しました');
	}

	function handleCancel() {
		if (hasUnsavedChanges) {
			if (confirm('変更を破棄してもよろしいですか？')) {
				void settingsStore.load();
				setHasUnsavedChanges(false);
			}
		} else {
			router.visit('/');
		}
	}

	function handleReset(section?: string) {
		setResetSection(section || null);
		setShowResetConfirm(true);
	}

	function confirmReset() {
		if (resetSection) {
			settingsStore.resetSection(resetSection as Parameters<typeof settingsStore.resetSection>[0]);
		} else {
			settingsStore.reset();
		}
		setShowResetConfirm(false);
		setResetSection(null);
		setHasUnsavedChanges(settingsStore.hasChanges());
	}

	function cancelReset() {
		setShowResetConfirm(false);
		setResetSection(null);
	}

	function handleExport() {
		const data = settingsStore.export();
		const blob = new Blob([data], { type: 'application/json' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = `settings_${new Date().toISOString().split('T')[0]}.json`;
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
		URL.revokeObjectURL(url);
	}

	function handleImport(event: React.ChangeEvent<HTMLInputElement>) {
		const input = event.target;
		const file = input.files?.[0];

		if (file) {
			const reader = new FileReader();
			reader.onload = async (e) => {
				try {
					await settingsStore.import(e.target?.result as string);
					setHasUnsavedChanges(false);
					alert('設定をインポートしました');
				} catch (error) {
					alert(`設定のインポートに失敗しました${error}`);
				}
			};
			reader.readAsText(file);
		}
	}

	function handleDifficultyChange(value: string) {
		settingsStore.updateSetting('practice.difficulty', value);
		if (value !== 'custom') {
			settingsStore.applyPreset(value as 'beginner' | 'intermediate' | 'advanced');
		}
	}

	// Prevent navigation with unsaved changes（旧 $effect の忠実な移植）
	useEffect(() => {
		function handleBeforeUnload(event: BeforeUnloadEvent) {
			if (hasUnsavedChanges) {
				event.preventDefault();
				event.returnValue = '';
			}
		}

		window.addEventListener('beforeunload', handleBeforeUnload);
		return () => {
			window.removeEventListener('beforeunload', handleBeforeUnload);
		};
	}, [hasUnsavedChanges]);

	return (
		<div className="settings-page">
			<Head title="設定 - 上毛かるたタイピング" />
			{/* Header */}
			<header className="settings-header">
				<h1>設定</h1>
				<div className="header-actions">
					{hasUnsavedChanges && <span className="unsaved-indicator">変更あり</span>}
					<button onClick={() => void handleSave()} className="btn btn-primary">
						保存
					</button>
					<button onClick={handleCancel} className="btn btn-secondary">
						キャンセル
					</button>
				</div>
			</header>

			<div className="settings-content">
				{/* Sidebar */}
				<nav className="settings-sidebar">
					{sections.map((section) => (
						<button
							key={section.id}
							onClick={() => setActiveSection(section.id)}
							className={`sidebar-item ${activeSection === section.id ? 'active' : ''}`}
						>
							<span className="section-icon">{section.icon}</span>
							<span className="section-label">{section.label}</span>
						</button>
					))}
				</nav>

				{/* Main Content */}
				<main className="settings-main">
					{activeSection === 'game' ? (
						<section className="settings-section">
							<h2>ゲームプレイ設定</h2>

							<SettingItem
								label="部分入力モード"
								description="札の一部だけを入力する練習モード"
								type="toggle"
								value={settings.inputMode === 'partial'}
								onChange={(value) =>
									settingsStore.updateSetting('inputMode', value ? 'partial' : 'complete')
								}
							/>

							{settings.inputMode === 'partial' && (
								<SettingItem
									label="入力文字数"
									description="部分入力で入力する文字数"
									type="slider"
									value={settings.partialLength || 5}
									min={3}
									max={10}
									step={1}
									unit="文字"
									onChange={(value) => settingsStore.updateSetting('partialLength', value)}
								/>
							)}

							<SettingItem
								label="ローマ字表示"
								type="toggle"
								value={settings.showRomaji}
								onChange={(value) => settingsStore.updateSetting('showRomaji', value)}
							/>

							<SettingItem
								label="ヒント表示"
								type="toggle"
								value={settings.showHints}
								onChange={(value) => settingsStore.updateSetting('showHints', value)}
							/>
						</section>
					) : activeSection === 'display' ? (
						<section className="settings-section">
							<h2>表示設定</h2>

							<SettingItem
								label="フォントサイズ"
								type="select"
								value={settings.display.fontSize}
								options={fontSizeOptions}
								onChange={(value) => settingsStore.updateSetting('display.fontSize', value)}
							/>

							<SettingItem
								label="テーマ"
								type="radio"
								value={settings.display.theme}
								options={themeOptions}
								onChange={(value) => settingsStore.updateSetting('display.theme', value)}
							/>

							<SettingItem
								label="アニメーション"
								type="toggle"
								value={settings.display.animations}
								onChange={(value) => settingsStore.updateSetting('display.animations', value)}
							/>

							{settings.display.animations && (
								<SettingItem
									label="アニメーション速度"
									type="select"
									value={settings.display.animationSpeed}
									options={animationSpeedOptions}
									onChange={(value) => settingsStore.updateSetting('display.animationSpeed', value)}
								/>
							)}

							<SettingItem
								label="ふりがな表示"
								type="toggle"
								value={settings.display.showFurigana}
								onChange={(value) => settingsStore.updateSetting('display.showFurigana', value)}
							/>

							<SettingItem
								label="意味説明表示"
								type="toggle"
								value={settings.display.showMeaning}
								onChange={(value) => settingsStore.updateSetting('display.showMeaning', value)}
							/>

							<button onClick={() => handleReset('display')} className="btn btn-outline">
								表示設定をリセット
							</button>
						</section>
					) : activeSection === 'sound' ? (
						<section className="settings-section">
							<h2>サウンド設定</h2>

							<SettingItem
								label="BGM"
								type="toggle"
								value={settings.sound.bgmEnabled}
								onChange={(value) => settingsStore.updateSetting('sound.bgmEnabled', value)}
							/>

							{settings.sound.bgmEnabled && (
								<SettingItem
									label="BGM音量"
									type="slider"
									value={settings.sound.bgmVolume}
									min={0}
									max={100}
									step={5}
									unit="%"
									onChange={(value) => settingsStore.updateSetting('sound.bgmVolume', value)}
								/>
							)}

							<SettingItem
								label="効果音"
								type="toggle"
								value={settings.sound.effectsEnabled}
								onChange={(value) => settingsStore.updateSetting('sound.effectsEnabled', value)}
							/>

							{settings.sound.effectsEnabled && (
								<SettingItem
									label="効果音音量"
									type="slider"
									value={settings.sound.effectsVolume}
									min={0}
									max={100}
									step={5}
									unit="%"
									onChange={(value) => settingsStore.updateSetting('sound.effectsVolume', value)}
								/>
							)}

							<SettingItem
								label="タイプ音"
								type="toggle"
								value={settings.sound.typingSoundEnabled}
								onChange={(value) => settingsStore.updateSetting('sound.typingSoundEnabled', value)}
							/>

							{settings.sound.typingSoundEnabled && (
								<SettingItem
									label="タイプ音音量"
									type="slider"
									value={settings.sound.typingSoundVolume}
									min={0}
									max={100}
									step={5}
									unit="%"
									onChange={(value) =>
										settingsStore.updateSetting('sound.typingSoundVolume', value)
									}
								/>
							)}

							<SettingItem
								label="読み上げ音声"
								type="toggle"
								value={settings.sound.voiceEnabled}
								onChange={(value) => settingsStore.updateSetting('sound.voiceEnabled', value)}
							/>

							{settings.sound.voiceEnabled && (
								<SettingItem
									label="読み上げ速度"
									type="slider"
									value={settings.sound.voiceSpeed}
									min={0.5}
									max={2.0}
									step={0.1}
									unit="x"
									onChange={(value) => settingsStore.updateSetting('sound.voiceSpeed', value)}
								/>
							)}

							<button onClick={() => handleReset('sound')} className="btn btn-outline">
								サウンド設定をリセット
							</button>
						</section>
					) : activeSection === 'practice' ? (
						<section className="settings-section">
							<h2>練習設定</h2>

							<SettingItem
								label="難易度"
								type="radio"
								value={settings.practice.difficulty}
								options={difficultyOptions}
								onChange={(v) => handleDifficultyChange(String(v))}
							/>

							<SettingItem
								label="出題順序"
								type="select"
								value={settings.practice.order}
								options={orderOptions}
								onChange={(value) => settingsStore.updateSetting('practice.order', value)}
								disabled={settings.practice.difficulty !== 'custom'}
							/>

							<SettingItem
								label="繰り返し回数"
								type="slider"
								value={settings.practice.repetitions}
								min={1}
								max={5}
								step={1}
								unit="回"
								onChange={(value) => settingsStore.updateSetting('practice.repetitions', value)}
								disabled={settings.practice.difficulty !== 'custom'}
							/>

							<SettingItem
								label="制限時間"
								type="select"
								value={settings.practice.timeLimit?.toString() || 'none'}
								options={[
									{ value: 'none', label: 'なし' },
									{ value: '30', label: '30秒' },
									{ value: '60', label: '60秒' },
									{ value: '120', label: '120秒' }
								]}
								onChange={(v) =>
									settingsStore.updateSetting(
										'practice.timeLimit',
										v === 'none' ? null : parseInt(String(v))
									)
								}
								disabled={settings.practice.difficulty !== 'custom'}
							/>

							<button onClick={() => handleReset('practice')} className="btn btn-outline">
								練習設定をリセット
							</button>
						</section>
					) : activeSection === 'keyboard' ? (
						<section className="settings-section">
							<h2>キーボード設定</h2>

							<SettingItem
								label="キーボードレイアウト"
								type="radio"
								value={settings.keyboard.layout}
								options={layoutOptions}
								onChange={(value) => settingsStore.updateSetting('keyboard.layout', value)}
							/>

							<SettingItem
								label="入力方式"
								type="radio"
								value={settings.keyboard.inputMethod}
								options={inputMethodOptions}
								onChange={(value) => settingsStore.updateSetting('keyboard.inputMethod', value)}
							/>

							<h3>ショートカットキー</h3>

							<div className="shortcut-settings">
								<div className="shortcut-item">
									<span>一時停止:</span>
									<kbd>{settings.keyboard.shortcuts.pause}</kbd>
								</div>
								<div className="shortcut-item">
									<span>スキップ:</span>
									<kbd>{settings.keyboard.shortcuts.skip}</kbd>
								</div>
								<div className="shortcut-item">
									<span>リトライ:</span>
									<kbd>{settings.keyboard.shortcuts.retry}</kbd>
								</div>
							</div>

							<button onClick={() => handleReset('keyboard')} className="btn btn-outline">
								キーボード設定をリセット
							</button>
						</section>
					) : activeSection === 'accessibility' ? (
						<section className="settings-section">
							<h2>アクセシビリティ設定</h2>

							<SettingItem
								label="高コントラストモード"
								description="視認性を高めるための高コントラスト表示"
								type="toggle"
								value={settings.accessibility.highContrast}
								onChange={(value) =>
									settingsStore.updateSetting('accessibility.highContrast', value)
								}
							/>

							<SettingItem
								label="モーション軽減"
								description="アニメーションや動きを最小限に抑える"
								type="toggle"
								value={settings.accessibility.reduceMotion}
								onChange={(value) =>
									settingsStore.updateSetting('accessibility.reduceMotion', value)
								}
							/>

							<SettingItem
								label="スクリーンリーダーモード"
								description="スクリーンリーダー用の最適化"
								type="toggle"
								value={settings.accessibility.screenReaderMode}
								onChange={(value) =>
									settingsStore.updateSetting('accessibility.screenReaderMode', value)
								}
							/>

							<SettingItem
								label="キーボードのみ操作"
								description="マウスを使わずキーボードのみで操作"
								type="toggle"
								value={settings.accessibility.keyboardOnly}
								onChange={(value) =>
									settingsStore.updateSetting('accessibility.keyboardOnly', value)
								}
							/>

							<button onClick={() => handleReset('accessibility')} className="btn btn-outline">
								アクセシビリティ設定をリセット
							</button>
						</section>
					) : activeSection === 'data' ? (
						<section className="settings-section">
							<h2>データ管理</h2>

							<div className="data-section">
								<h3>設定のエクスポート/インポート</h3>
								<p className="text-sm text-gray-600 dark:text-gray-400">
									現在の設定をファイルとして保存したり、保存した設定を読み込むことができます。
								</p>
								<div className="data-actions">
									<button onClick={handleExport} className="btn btn-primary">
										設定をエクスポート
									</button>
									<label className="btn btn-secondary">
										設定をインポート
										<input type="file" accept=".json" onChange={handleImport} className="hidden" />
									</label>
								</div>
							</div>

							<div className="data-section">
								<h3>設定のリセット</h3>
								<p className="text-sm text-gray-600 dark:text-gray-400">
									すべての設定をデフォルト値に戻します。この操作は取り消せません。
								</p>
								<button onClick={() => handleReset()} className="btn btn-danger">
									すべての設定をリセット
								</button>
							</div>
						</section>
					) : null}
				</main>
			</div>

			{/* Reset Confirmation Dialog */}
			{showResetConfirm && (
				<div
					className="modal-overlay"
					onClick={(e) => {
						if (e.currentTarget === e.target) cancelReset();
					}}
					onKeyDown={(e) => e.key === 'Escape' && cancelReset()}
					role="dialog"
					aria-modal="true"
					aria-labelledby="reset-dialog-title"
					tabIndex={-1}
				>
					<div className="modal-content">
						<h3 id="reset-dialog-title">設定のリセット</h3>
						<p>
							{resetSection
								? `${sections.find((s) => s.id === resetSection)?.label}の設定`
								: 'すべての設定'}
							をデフォルト値に戻します。この操作は取り消せません。
						</p>
						<div className="modal-actions">
							<button onClick={confirmReset} className="btn btn-danger">
								リセット
							</button>
							<button onClick={cancelReset} className="btn btn-secondary">
								キャンセル
							</button>
						</div>
					</div>
				</div>
			)}
			<style>{`
				.settings-page {
					min-height: 100vh;
					background: white;
				}

				.settings-header {
					display: flex;
					justify-content: space-between;
					align-items: center;
					padding: 1rem 2rem;
					border-bottom: 1px solid #e5e7eb;
					background: white;
				}

				.settings-header h1 {
					font-size: 1.5rem;
					font-weight: bold;
				}

				.header-actions {
					display: flex;
					gap: 1rem;
					align-items: center;
				}

				.unsaved-indicator {
					padding: 0.25rem 0.75rem;
					background: #fef3c7;
					color: #92400e;
					border-radius: 0.375rem;
					font-size: 0.875rem;
					font-weight: 500;
				}

				.settings-content {
					display: flex;
					height: calc(100vh - 73px);
				}

				.settings-sidebar {
					width: 250px;
					background: #f9fafb;
					border-right: 1px solid #e5e7eb;
					padding: 1rem;
					overflow-y: auto;
				}

				.sidebar-item {
					display: flex;
					align-items: center;
					gap: 0.75rem;
					width: 100%;
					padding: 0.75rem 1rem;
					margin-bottom: 0.25rem;
					background: transparent;
					border: none;
					border-radius: 0.5rem;
					text-align: left;
					cursor: pointer;
					transition: background-color 0.2s;
				}

				.sidebar-item:hover {
					background: #e5e7eb;
				}

				.sidebar-item.active {
					background: #3b82f6;
					color: white;
				}

				.section-icon {
					font-size: 1.25rem;
				}

				.section-label {
					font-weight: 500;
				}

				.settings-main {
					flex: 1;
					padding: 2rem;
					overflow-y: auto;
				}

				.settings-section {
					max-width: 800px;
				}

				.settings-section h2 {
					font-size: 1.25rem;
					font-weight: bold;
					margin-bottom: 1.5rem;
				}

				.settings-section h3 {
					font-size: 1rem;
					font-weight: 600;
					margin-top: 1.5rem;
					margin-bottom: 1rem;
				}

				.shortcut-settings {
					display: flex;
					flex-direction: column;
					gap: 0.75rem;
					margin: 1rem 0;
				}

				.shortcut-item {
					display: flex;
					align-items: center;
					gap: 1rem;
				}

				.shortcut-item span {
					min-width: 100px;
				}

				.shortcut-item kbd {
					padding: 0.25rem 0.5rem;
					background: #f3f4f6;
					border: 1px solid #d1d5db;
					border-radius: 0.25rem;
					font-family: monospace;
					font-size: 0.875rem;
				}

				.data-section {
					margin-bottom: 2rem;
					padding-bottom: 2rem;
					border-bottom: 1px solid #e5e7eb;
				}

				.data-section:last-child {
					border-bottom: none;
				}

				.data-actions {
					display: flex;
					gap: 1rem;
					margin-top: 1rem;
				}

				/* Button Styles */
				.btn {
					padding: 0.5rem 1rem;
					border-radius: 0.375rem;
					font-weight: 500;
					cursor: pointer;
					transition: all 0.2s;
					border: none;
				}

				.btn-primary {
					background: #3b82f6;
					color: white;
				}

				.btn-primary:hover {
					background: #2563eb;
				}

				.btn-secondary {
					background: #6b7280;
					color: white;
				}

				.btn-secondary:hover {
					background: #4b5563;
				}

				.btn-outline {
					background: transparent;
					color: #6b7280;
					border: 1px solid #d1d5db;
				}

				.btn-outline:hover {
					background: #f3f4f6;
				}

				.btn-danger {
					background: #ef4444;
					color: white;
				}

				.btn-danger:hover {
					background: #dc2626;
				}

				/* Modal Styles */
				.modal-overlay {
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
				}

				.modal-content {
					background: white;
					padding: 2rem;
					border-radius: 0.5rem;
					max-width: 500px;
					width: 90%;
				}

				.modal-content h3 {
					font-size: 1.25rem;
					font-weight: bold;
					margin-bottom: 1rem;
				}

				.modal-content p {
					margin-bottom: 1.5rem;
					color: #6b7280;
				}

				.modal-actions {
					display: flex;
					gap: 1rem;
					justify-content: flex-end;
				}

				.hidden {
					display: none;
				}

				/* Responsive Design */
				@media (max-width: 768px) {
					.settings-content {
						flex-direction: column;
					}

					.settings-sidebar {
						width: 100%;
						border-right: none;
						border-bottom: 1px solid #e5e7eb;
						display: flex;
						overflow-x: auto;
						padding: 0.5rem;
					}

					.sidebar-item {
						flex-shrink: 0;
					}

					.settings-main {
						padding: 1rem;
					}
				}

				/* Dark Mode */
				.dark .settings-page {
					background: #1f2937;
					color: white;
				}

				.dark .settings-header {
					background: #1f2937;
					border-bottom-color: #374151;
				}

				.dark .settings-sidebar {
					background: #111827;
					border-right-color: #374151;
				}

				.dark .sidebar-item:hover {
					background: #374151;
				}

				.dark .modal-content {
					background: #1f2937;
					color: white;
				}

				.dark .shortcut-item kbd {
					background: #374151;
					border-color: #4b5563;
					color: white;
				}

				.dark .data-section {
					border-bottom-color: #374151;
				}
			`}</style>
		</div>
	);
}
