import { useEffect, useState } from 'react';
import { Head, router } from '@inertiajs/react';
import {
	Bell,
	ChevronDown,
	Info,
	Keyboard,
	Languages,
	Mic,
	Monitor,
	MonitorSmartphone,
	Moon,
	Music,
	RotateCcw,
	Save,
	Settings as SettingsIcon,
	Sun,
	Type,
	Volume2,
	X
} from 'lucide-react';
import { settingsStore, useSettingsStore } from '@/stores/settings-store';
import backgroundImage from '@/assets/images/background.webp';

const SERIF = { fontFamily: "'Noto Serif JP', serif" } as const;
const MONO = { fontFamily: "'JetBrains Mono', monospace" } as const;

// Section navigation
const sections = [
	{ id: 'display', label: '表示', icon: Monitor },
	{ id: 'sound', label: 'サウンド', icon: Volume2 },
	{ id: 'keyboard', label: 'キーボード', icon: Keyboard }
] as const;

// Options for select/radio inputs
const fontSizeOptions = [
	{ value: 'small', label: '小 (14px)' },
	{ value: 'medium', label: '中 (18px)' },
	{ value: 'large', label: '大 (22px)' },
	{ value: 'extra-large', label: '特大 (26px)' }
];

const themeOptions = [
	{ value: 'light', label: 'ライト', icon: Sun },
	{ value: 'dark', label: 'ダーク', icon: Moon },
	{ value: 'auto', label: '自動', icon: MonitorSmartphone }
];

const inputMethodOptions = [
	{ value: 'romaji', label: 'ローマ字入力', desc: 'A・B・C…キーで入力', icon: Type },
	{ value: 'kana', label: 'かな入力', desc: 'あ・い・う…キーで入力', icon: Languages }
];

// 見出し（赤いアクセントバー + 金色タイトル）
function SectionHead({ title }: { title: string }) {
	return (
		<div className="flex items-center gap-2.5">
			<span className="h-6 w-1 rounded-sm bg-[#C8302A]" />
			<h2 className="text-[22px] font-extrabold text-[#E5C875]">{title}</h2>
		</div>
	);
}

// トグルスイッチ
function Toggle({
	checked,
	onChange,
	ariaLabel,
	showState = false
}: {
	checked: boolean;
	onChange: (v: boolean) => void;
	ariaLabel: string;
	showState?: boolean;
}) {
	return (
		<div className="flex items-center gap-4">
			<button
				type="button"
				role="switch"
				aria-checked={checked}
				aria-label={ariaLabel}
				onClick={() => onChange(!checked)}
				className={`flex h-[30px] w-14 items-center rounded-full border p-[3px] transition-all ${
					checked
						? 'justify-end border-[#E5C875] bg-[#3FB56B]'
						: 'justify-start border-[#C9A961] bg-[#3A4552]'
				}`}
			>
				<span className="h-6 w-6 rounded-full bg-white" />
			</button>
			{showState && (
				<span className={`text-sm font-bold ${checked ? 'text-[#3FB56B]' : 'text-[#B8A874]'}`}>
					{checked ? '有効' : '無効'}
				</span>
			)}
		</div>
	);
}

// スライダー（金色フィルバー + モノスペースの数値）
function Slider({
	value,
	min,
	max,
	step,
	onChange,
	format,
	ariaLabel
}: {
	value: number;
	min: number;
	max: number;
	step: number;
	onChange: (v: number) => void;
	format: (v: number) => string;
	ariaLabel: string;
}) {
	const pct = ((value - min) / (max - min)) * 100;
	return (
		<div className="flex items-center gap-4">
			<input
				type="range"
				min={min}
				max={max}
				step={step}
				value={value}
				aria-label={ariaLabel}
				onChange={(e) => onChange(parseFloat(e.target.value))}
				className="karuta-slider h-2 flex-1 cursor-pointer rounded-full border border-[#C9A961]"
				style={{
					background: `linear-gradient(to right, #E5C875 0%, #E5C875 ${pct}%, #132D57 ${pct}%, #132D57 100%)`
				}}
			/>
			<span
				className="min-w-[52px] text-right text-base font-extrabold text-[#E5C875]"
				style={MONO}
			>
				{format(value)}
			</span>
		</div>
	);
}

// サウンド設定のカード（ヘッダー行のトグル + 有効時に音量スライダー）
function SoundCard({
	icon: Icon,
	label,
	enabled,
	onToggle,
	volumeLabel,
	value,
	min,
	max,
	step,
	onValueChange,
	format
}: {
	icon: typeof Music;
	label: string;
	enabled: boolean;
	onToggle: (v: boolean) => void;
	volumeLabel: string;
	value: number;
	min: number;
	max: number;
	step: number;
	onValueChange: (v: number) => void;
	format: (v: number) => string;
}) {
	return (
		<div className="flex flex-col gap-3.5 rounded-[10px] border border-[#C9A961] bg-[#132D57] px-5 py-4">
			<div className="flex items-center justify-between gap-4">
				<div className="flex items-center gap-2.5">
					<Icon className="h-[18px] w-[18px] text-[#E5C875]" />
					<span className="text-base font-bold text-[#F5E9C8]">{label}</span>
				</div>
				<Toggle checked={enabled} onChange={onToggle} ariaLabel={label} />
			</div>
			{enabled && (
				<div className="flex flex-col gap-2">
					<span className="text-[13px] font-semibold text-[#C9A961]">{volumeLabel}</span>
					<Slider
						value={value}
						min={min}
						max={max}
						step={step}
						onChange={onValueChange}
						format={format}
						ariaLabel={volumeLabel}
					/>
				</div>
			)}
		</div>
	);
}

// リセットボタン
function ResetButton({ label, onClick }: { label: string; onClick: () => void }) {
	return (
		<button
			onClick={onClick}
			className="flex w-fit items-center gap-2.5 rounded-lg border border-[#C8302A] bg-[#0A1A3599] px-5 py-3 text-sm font-bold text-[#F5E9C8] transition-colors hover:bg-[#0A1A35]"
		>
			<RotateCcw className="h-4 w-4 text-[#C8302A]" />
			{label}
		</button>
	);
}

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

	const update = (path: string, value: unknown) => settingsStore.updateSetting(path, value);

	return (
		<div
			className="min-h-screen bg-cover bg-fixed bg-center p-8"
			style={{ backgroundImage: `url(${backgroundImage})`, ...SERIF }}
		>
			<Head title="設定 - 上毛かるたタイピング" />

			<div className="mx-auto flex w-full max-w-[1280px] flex-col gap-5">
				{/* Header */}
				<header className="flex flex-wrap items-center justify-between gap-4 rounded-[10px] border border-[#C9A961] bg-[#0A1A35CC] px-8 py-4">
					<div className="flex items-center gap-3">
						<span className="flex h-11 w-11 items-center justify-center rounded-full bg-[#C9A961]">
							<SettingsIcon className="h-[22px] w-[22px] text-[#0F2952]" />
						</span>
						<h1
							className="text-[32px] font-black text-white"
							style={{ textShadow: '0 2px 4px rgba(0,0,0,0.67)' }}
						>
							ユーザー設定
						</h1>
					</div>
					<div className="flex items-center gap-3">
						{hasUnsavedChanges && (
							<span className="rounded-md border border-[#C9A961]/60 bg-[#0A1A3599] px-3 py-1 text-xs font-semibold text-[#E5C875]">
								変更あり
							</span>
						)}
						<button
							onClick={() => void handleSave()}
							className="flex items-center gap-2 rounded-lg border border-[#E5C875] px-6 py-2.5 text-[15px] font-bold text-white transition-opacity hover:opacity-90"
							style={{ background: 'linear-gradient(180deg, #3A6BC8 0%, #1E3A6B 100%)' }}
						>
							<Save className="h-4 w-4" />
							保存
						</button>
						<button
							onClick={handleCancel}
							className="flex items-center gap-2 rounded-lg border border-[#C9A961] bg-[#0A1A3599] px-6 py-2.5 text-[15px] font-semibold text-[#F5E9C8] transition-colors hover:bg-[#0A1A35]"
						>
							<X className="h-4 w-4 text-[#B8A874]" />
							キャンセル
						</button>
					</div>
				</header>

				<div className="flex flex-col gap-5 lg:flex-row">
					{/* Sidebar */}
					<nav className="flex w-full shrink-0 flex-col gap-2 rounded-[10px] border border-[#C9A961] bg-[#0A1A35CC] p-5 lg:w-[260px]">
						{sections.map((section) => {
							const active = activeSection === section.id;
							const Icon = section.icon;
							return (
								<button
									key={section.id}
									onClick={() => setActiveSection(section.id)}
									className={`flex items-center gap-3 rounded-lg border px-4 py-3 transition-colors ${
										active
											? 'border-[#E5C875] bg-[#C8302A]'
											: 'border-transparent bg-transparent hover:bg-[#132D57]'
									}`}
								>
									<Icon
										className={`h-[18px] w-[18px] ${active ? 'text-white' : 'text-[#E5C875]'}`}
									/>
									<span
										className={`text-[15px] text-[#F5E9C8] ${active ? 'font-bold' : 'font-semibold'}`}
									>
										{section.label}
									</span>
								</button>
							);
						})}
					</nav>

					{/* Main Content */}
					<main className="flex min-h-[560px] flex-1 flex-col rounded-[10px] border-2 border-[#C9A961] bg-[#0A1A35DD] px-9 py-7">
						{activeSection === 'display' ? (
							<div className="flex flex-1 flex-col gap-7">
								<SectionHead title="表示設定" />

								{/* フォントサイズ */}
								<div className="flex flex-col gap-2.5">
									<span className="text-sm font-semibold text-[#C9A961]">フォントサイズ</span>
									<div className="relative w-full max-w-[280px]">
										<select
											value={settings.display.fontSize}
											onChange={(e) => update('display.fontSize', e.target.value)}
											aria-label="フォントサイズ"
											className="w-full cursor-pointer appearance-none rounded-lg border border-[#C9A961] bg-[#132D57] px-4 py-3 text-[15px] font-bold text-[#F5E9C8] outline-none"
											style={SERIF}
										>
											{fontSizeOptions.map((o) => (
												<option
													key={o.value}
													value={o.value}
													className="bg-[#132D57] text-[#F5E9C8]"
												>
													{o.label}
												</option>
											))}
										</select>
										<ChevronDown className="pointer-events-none absolute top-1/2 right-4 h-[18px] w-[18px] -translate-y-1/2 text-[#E5C875]" />
									</div>
								</div>

								{/* テーマ */}
								<div className="flex flex-col gap-3">
									<span className="text-sm font-semibold text-[#C9A961]">テーマ</span>
									<div className="flex flex-wrap gap-4">
										{themeOptions.map((opt) => {
											const selected = settings.display.theme === opt.value;
											const Icon = opt.icon;
											return (
												<button
													key={opt.value}
													onClick={() => update('display.theme', opt.value)}
													className={`flex items-center gap-2.5 rounded-lg border px-5 py-3 transition-colors ${
														selected
															? 'border-[#E5C875] bg-[#C8302A]'
															: 'border-[#C9A961] bg-[#132D57] hover:bg-[#1A3868]'
													}`}
												>
													<span
														className={`flex h-4 w-4 items-center justify-center rounded-full border-2 ${
															selected ? 'border-white' : 'border-[#C9A961]'
														}`}
													>
														{selected && <span className="h-2 w-2 rounded-full bg-white" />}
													</span>
													<Icon
														className={`h-4 w-4 ${selected ? 'text-white' : 'text-[#E5C875]'}`}
													/>
													<span
														className={`text-sm text-[#F5E9C8] ${selected ? 'font-bold' : 'font-semibold'}`}
													>
														{opt.label}
													</span>
												</button>
											);
										})}
									</div>
								</div>

								{/* アニメーション */}
								<div className="flex flex-col gap-3">
									<span className="text-sm font-semibold text-[#C9A961]">アニメーション</span>
									<Toggle
										checked={settings.display.animations}
										onChange={(v) => update('display.animations', v)}
										ariaLabel="アニメーション"
										showState
									/>
								</div>

								<ResetButton label="表示設定をリセット" onClick={() => handleReset('display')} />
							</div>
						) : activeSection === 'sound' ? (
							<div className="flex flex-1 flex-col gap-5">
								<SectionHead title="サウンド設定" />

								<SoundCard
									icon={Music}
									label="BGM"
									enabled={settings.sound.bgmEnabled}
									onToggle={(v) => update('sound.bgmEnabled', v)}
									volumeLabel="BGM音量"
									value={settings.sound.bgmVolume}
									min={0}
									max={100}
									step={5}
									onValueChange={(v) => update('sound.bgmVolume', v)}
									format={(v) => `${v}%`}
								/>

								<SoundCard
									icon={Bell}
									label="効果音"
									enabled={settings.sound.effectsEnabled}
									onToggle={(v) => update('sound.effectsEnabled', v)}
									volumeLabel="効果音音量"
									value={settings.sound.effectsVolume}
									min={0}
									max={100}
									step={5}
									onValueChange={(v) => update('sound.effectsVolume', v)}
									format={(v) => `${v}%`}
								/>

								<SoundCard
									icon={Keyboard}
									label="タイプ音"
									enabled={settings.sound.typingSoundEnabled}
									onToggle={(v) => update('sound.typingSoundEnabled', v)}
									volumeLabel="タイプ音音量"
									value={settings.sound.typingSoundVolume}
									min={0}
									max={100}
									step={5}
									onValueChange={(v) => update('sound.typingSoundVolume', v)}
									format={(v) => `${v}%`}
								/>

								<SoundCard
									icon={Mic}
									label="読み上げ音声"
									enabled={settings.sound.voiceEnabled}
									onToggle={(v) => update('sound.voiceEnabled', v)}
									volumeLabel="読み上げ速度"
									value={settings.sound.voiceSpeed}
									min={0.5}
									max={2.0}
									step={0.1}
									onValueChange={(v) => update('sound.voiceSpeed', v)}
									format={(v) => `${v.toFixed(1)}x`}
								/>

								<ResetButton label="サウンド設定をリセット" onClick={() => handleReset('sound')} />
							</div>
						) : activeSection === 'keyboard' ? (
							<div className="flex flex-1 flex-col gap-7">
								<SectionHead title="キーボード設定" />

								{/* 入力方式 */}
								<div className="flex flex-col gap-3.5">
									<span className="text-sm font-semibold text-[#C9A961]">入力方式</span>
									<div className="flex flex-col gap-4 sm:flex-row">
										{inputMethodOptions.map((opt) => {
											const selected = settings.keyboard.inputMethod === opt.value;
											const Icon = opt.icon;
											return (
												<button
													key={opt.value}
													onClick={() => update('keyboard.inputMethod', opt.value)}
													className={`flex flex-1 items-center gap-4 rounded-[10px] border px-6 py-[18px] text-left transition-colors ${
														selected
															? 'border-[#E5C875] bg-[#C8302A]'
															: 'border-[#C9A961] bg-[#132D57] hover:bg-[#1A3868]'
													}`}
												>
													<span
														className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${
															selected ? 'border-white' : 'border-[#C9A961]'
														}`}
													>
														{selected && <span className="h-2.5 w-2.5 rounded-full bg-white" />}
													</span>
													<span
														className={`flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-[10px] border border-[#C9A961] ${
															selected ? 'bg-[#0A1A35AA]' : 'bg-[#0F2952]'
														}`}
													>
														<Icon className="h-[22px] w-[22px] text-[#E5C875]" />
													</span>
													<span className="flex min-w-0 flex-1 flex-col gap-1">
														<span className="text-[17px] font-extrabold text-[#F5E9C8]">
															{opt.label}
														</span>
														<span className="text-xs font-medium text-[#B8A874]">{opt.desc}</span>
													</span>
												</button>
											);
										})}
									</div>
								</div>

								{/* ヒント */}
								<div className="flex items-start gap-3.5 rounded-[10px] border border-[#C9A961] bg-[#132D57] px-5 py-4">
									<span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#C9A961]">
										<Info className="h-[18px] w-[18px] text-[#0F2952]" />
									</span>
									<div className="flex flex-col gap-1">
										<span className="text-sm font-bold text-[#E5C875]">ヒント</span>
										<span className="text-[13px] text-[#F5E9C8]">
											変更した入力方式は次回のプレイから適用されます。
										</span>
									</div>
								</div>

								<ResetButton
									label="キーボード設定をリセット"
									onClick={() => handleReset('keyboard')}
								/>
							</div>
						) : null}
					</main>
				</div>
			</div>

			{/* Reset Confirmation Dialog */}
			{showResetConfirm && (
				<div
					className="fixed inset-0 z-50 flex items-center justify-center p-4"
					style={{ background: 'rgba(0,0,0,0.6)' }}
					onClick={(e) => {
						if (e.currentTarget === e.target) cancelReset();
					}}
					onKeyDown={(e) => e.key === 'Escape' && cancelReset()}
					role="dialog"
					aria-modal="true"
					aria-labelledby="reset-dialog-title"
					tabIndex={-1}
				>
					<div
						className="flex w-full max-w-md flex-col gap-5 rounded-[14px] border-2 border-[#C9A961] bg-[#0F2145] px-8 py-7 shadow-[0_8px_32px_rgba(0,0,0,0.4)]"
						style={SERIF}
					>
						<h3 id="reset-dialog-title" className="text-xl font-black text-[#E5C875]">
							設定のリセット
						</h3>
						<p className="text-sm leading-relaxed text-[#F5E9C8]">
							{resetSection
								? `${sections.find((s) => s.id === resetSection)?.label}の設定`
								: 'すべての設定'}
							をデフォルト値に戻します。この操作は取り消せません。
						</p>
						<div className="flex justify-end gap-3">
							<button
								onClick={confirmReset}
								className="rounded-lg border border-[#C8302A] bg-[#C8302A] px-5 py-2.5 text-sm font-bold text-white transition-opacity hover:opacity-90"
							>
								リセット
							</button>
							<button
								onClick={cancelReset}
								className="rounded-lg border border-[#C9A961] bg-[#0A1A3599] px-5 py-2.5 text-sm font-semibold text-[#F5E9C8] transition-colors hover:bg-[#0A1A35]"
							>
								キャンセル
							</button>
						</div>
					</div>
				</div>
			)}

			<style>{`
				.karuta-slider {
					-webkit-appearance: none;
					appearance: none;
				}
				.karuta-slider::-webkit-slider-thumb {
					-webkit-appearance: none;
					appearance: none;
					width: 16px;
					height: 16px;
					border-radius: 9999px;
					background: #E5C875;
					border: 2px solid #0A1A35;
					cursor: pointer;
				}
				.karuta-slider::-moz-range-thumb {
					width: 16px;
					height: 16px;
					border-radius: 9999px;
					background: #E5C875;
					border: 2px solid #0A1A35;
					cursor: pointer;
				}
			`}</style>
		</div>
	);
}
