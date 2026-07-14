import { useEffect, useState } from 'react';
import { Head, router } from '@inertiajs/react';
import { settingsStore, useSettingsStore } from '@/stores/settings-store';
import SettingItem from '@/components/settings/SettingItem';

// Section navigation
const sections = [
	{ id: 'display', label: '表示', icon: '🖥️' },
	{ id: 'sound', label: 'サウンド', icon: '🔊' },
	{ id: 'keyboard', label: 'キーボード', icon: '⌨️' }
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

const inputMethodOptions = [
	{ value: 'romaji', label: 'ローマ字入力' },
	{ value: 'kana', label: 'かな入力' }
];

export default function Settings() {
	const settings = useSettingsStore();
	const [activeSection, setActiveSection] = useState('display');
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
		router.visit('/');
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

	function handleReset(section: string) {
		setResetSection(section);
		setShowResetConfirm(true);
	}

	function confirmReset() {
		if (resetSection) {
			settingsStore.resetSection(resetSection as Parameters<typeof settingsStore.resetSection>[0]);
		}
		setShowResetConfirm(false);
		setResetSection(null);
		setHasUnsavedChanges(settingsStore.hasChanges());
	}

	function cancelReset() {
		setShowResetConfirm(false);
		setResetSection(null);
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
					{activeSection === 'display' ? (
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
					) : activeSection === 'keyboard' ? (
						<section className="settings-section">
							<h2>キーボード設定</h2>

							<SettingItem
								label="入力方式"
								type="radio"
								value={settings.keyboard.inputMethod}
								options={inputMethodOptions}
								onChange={(value) => settingsStore.updateSetting('keyboard.inputMethod', value)}
							/>

							<button onClick={() => handleReset('keyboard')} className="btn btn-outline">
								キーボード設定をリセット
							</button>
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
			`}</style>
		</div>
	);
}
