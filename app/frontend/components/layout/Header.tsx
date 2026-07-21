import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, router, usePage } from '@inertiajs/react';
import {
	BookOpen,
	ChevronDown,
	History,
	House,
	Info,
	LogIn,
	LogOut,
	Medal,
	Menu,
	MessageCircle,
	Settings,
	Timer,
	Trophy,
	User,
	X,
	Zap
} from 'lucide-react';
import { formatTime } from '@/lib/format-time';
import ConfirmModal from '@/components/common/ConfirmModal';
import type { AuthUser, BestScores, RandomModeDifficulty, SharedProps } from '@/types';

const JP_FONT = { fontFamily: "'Noto Serif JP', serif" } as const;
const MONO_FONT = { fontFamily: "'JetBrains Mono', monospace" } as const;

// ランキング画面の難易度タブと同じ表記
const DIFFICULTY_LABELS: Record<RandomModeDifficulty, string> = {
	beginner: '初心者',
	standard: '標準',
	advanced: '上級者'
};

interface Props {
	user: AuthUser | null;
	onHowToPlay?: () => void;
	onFeedback?: () => void;
}

const DROPDOWN_SHELL =
	'absolute right-0 top-[calc(100%+12px)] w-[300px] overflow-hidden rounded-xl border-2 border-[#C9A961] bg-[#0F2145] shadow-[0_12px_36px_#000000aa]';

function Divider() {
	return <div className="h-px bg-[#C9A961] opacity-30" />;
}

function MenuItem({
	icon,
	label,
	href,
	method,
	onClick
}: {
	icon: ReactNode;
	label: string;
	href?: string;
	method?: 'delete';
	onClick?: () => void;
}) {
	const className =
		'flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-[#132D57]';
	const content = (
		<>
			<span className="text-[#E5C875]">{icon}</span>
			<span className="text-sm font-semibold text-[#F5E9C8]" style={JP_FONT}>
				{label}
			</span>
		</>
	);
	if (href) {
		return (
			<Link
				href={href}
				method={method}
				as={method ? 'button' : undefined}
				role="menuitem"
				className={className}
				onClick={onClick}
			>
				{content}
			</Link>
		);
	}
	return (
		<button type="button" role="menuitem" className={className} onClick={onClick}>
			{content}
		</button>
	);
}

function MenuPointer() {
	return (
		<span
			aria-hidden="true"
			className="absolute top-[calc(100%+6px)] right-3 h-3 w-3 rotate-45 border-t-2 border-l-2 border-[#C9A961] bg-[#0F2145]"
		/>
	);
}

function GuestDropdown({
	onHowToPlay,
	onFeedback,
	close
}: {
	onHowToPlay?: () => void;
	onFeedback?: () => void;
	close: () => void;
}) {
	return (
		<div role="menu" aria-label="メニュー" className={DROPDOWN_SHELL}>
			<div className="flex items-center gap-3 bg-[#132D57] p-4">
				<span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[#C9A961] bg-[#1E3560]">
					<User size={22} className="text-[#B8A874]" aria-hidden="true" />
				</span>
				<div className="flex flex-col gap-0.5">
					<span className="text-sm font-extrabold text-[#F5E9C8]" style={JP_FONT}>
						ゲスト
					</span>
					<span className="text-[11px] font-medium text-[#B8A874]" style={JP_FONT}>
						ログインしていません
					</span>
				</div>
			</div>

			<div className="flex flex-col px-4 pt-3 pb-1">
				<Link
					href="/auth/login"
					onClick={close}
					className="flex items-center justify-center gap-2.5 rounded-lg border border-[#E5C875] bg-linear-to-b from-[#E5C875] to-[#C9A961] px-4 py-3 text-sm font-extrabold text-[#0F2952] transition-opacity hover:opacity-90"
					style={JP_FONT}
				>
					<LogIn size={16} aria-hidden="true" />
					ログイン
				</Link>
			</div>

			<div className="flex items-start gap-1.5 px-4 pt-2 pb-3">
				<Info size={12} className="mt-0.5 shrink-0 text-[#E5C875]" aria-hidden="true" />
				<span className="text-[11px] leading-[1.4] font-medium text-[#B8A874]" style={JP_FONT}>
					ログインするとスコアの記録・実績の解除ができます
				</span>
			</div>

			<Divider />

			<div className="flex flex-col py-2">
				<MenuItem icon={<House size={16} />} label="TOPページ" href="/" onClick={close} />
				<MenuItem
					icon={<Settings size={16} />}
					label="ユーザー設定"
					href="/settings"
					onClick={close}
				/>
				<Divider />
				<MenuItem
					icon={<BookOpen size={16} />}
					label="遊び方"
					onClick={() => {
						close();
						onHowToPlay?.();
					}}
				/>
				<MenuItem icon={<Trophy size={16} />} label="ランキング" href="/ranking" onClick={close} />
			</div>

			<Divider />

			<div className="flex flex-col py-2">
				<MenuItem
					icon={<MessageCircle size={16} />}
					label="フィードバック"
					onClick={() => {
						close();
						onFeedback?.();
					}}
				/>
			</div>
		</div>
	);
}

function ScoreCard({
	icon,
	label,
	value,
	unit,
	badge,
	accent
}: {
	icon: ReactNode;
	label: string;
	value: string;
	unit: string;
	badge?: string;
	accent: string;
}) {
	return (
		<div
			className="flex flex-1 flex-col gap-1 rounded-md border bg-[#0A1A35]/60 px-2.5 py-2"
			style={{ borderColor: accent }}
		>
			<div className="flex items-center gap-1.5">
				<span style={{ color: accent }}>{icon}</span>
				<span className="text-[10px] font-bold whitespace-nowrap text-[#B8A874]" style={JP_FONT}>
					{label}
				</span>
			</div>
			<div className="flex items-end gap-[3px]">
				<span className="text-base font-extrabold" style={{ ...MONO_FONT, color: accent }}>
					{value}
				</span>
				<span className="text-[10px] font-semibold text-[#F5E9C8]" style={JP_FONT}>
					{unit}
				</span>
				{badge && (
					<span
						className="mb-px ml-auto rounded-sm border px-1 py-px text-[9px] font-semibold whitespace-nowrap"
						style={{ ...JP_FONT, borderColor: accent, color: accent }}
					>
						{badge}
					</span>
				)}
			</div>
		</div>
	);
}

function UserDropdown({
	user,
	bestScores,
	onHowToPlay,
	onFeedback,
	onLogout,
	close
}: {
	user: AuthUser;
	bestScores: BestScores | null;
	onHowToPlay?: () => void;
	onFeedback?: () => void;
	onLogout: () => void;
	close: () => void;
}) {
	const nickname = user.nickname || user.email.split('@')[0];
	const randomBest = bestScores?.random ?? null;
	const timeattackBest = bestScores?.timeattack ?? null;

	return (
		<div role="menu" aria-label="メニュー" className={DROPDOWN_SHELL}>
			<div className="flex items-center gap-3 bg-[#132D57] p-4">
				<span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#C9A961]">
					{user.avatar_url ? (
						<img src={user.avatar_url} alt={nickname} className="h-full w-full object-cover" />
					) : (
						<User size={22} className="text-[#0F2952]" aria-hidden="true" />
					)}
				</span>
				<div className="flex min-w-0 flex-1 flex-col gap-0.5">
					<span className="truncate text-[15px] font-extrabold text-[#F5E9C8]" style={JP_FONT}>
						{nickname}
					</span>
					<span className="truncate text-[11px] font-medium text-[#B8A874]" style={JP_FONT}>
						{user.email}
					</span>
				</div>
				<ChevronDown size={16} className="shrink-0 text-[#E5C875]" aria-hidden="true" />
			</div>

			<div className="px-4 pt-3 pb-4">
				<button
					type="button"
					onClick={onLogout}
					className="flex w-full items-center justify-center gap-2.5 rounded-lg border border-[#E5453D] bg-linear-to-b from-[#C8302A] to-[#7A1E1B] px-5 py-3 text-sm font-extrabold text-white shadow-[0_2px_8px_#7A1E1B66] transition-opacity hover:opacity-90"
					style={JP_FONT}
				>
					<LogOut size={16} aria-hidden="true" />
					ログアウト
				</button>
			</div>

			<div className="flex flex-col gap-2 border-y border-[#C9A961] bg-[#132D57] px-4 py-2.5">
				<span className="text-[10px] font-bold tracking-[1px] text-[#C9A961]" style={JP_FONT}>
					ベストスコア
				</span>
				<div className="flex gap-2">
					<ScoreCard
						icon={<Zap size={11} />}
						label="ランダム"
						value={randomBest ? randomBest.score.toLocaleString() : '—'}
						unit="pt"
						badge={randomBest ? DIFFICULTY_LABELS[randomBest.difficulty] : undefined}
						accent="#E5C875"
					/>
					<ScoreCard
						icon={<Timer size={11} />}
						label="タイムアタック"
						value={timeattackBest ? formatTime(timeattackBest.time_ms) : '—'}
						unit="秒"
						badge={timeattackBest ? DIFFICULTY_LABELS[timeattackBest.difficulty] : undefined}
						accent="#C8302A"
					/>
				</div>
			</div>

			<Divider />

			<div className="flex flex-col py-2">
				<MenuItem icon={<House size={16} />} label="TOPページ" href="/" onClick={close} />
				<MenuItem icon={<User size={16} />} label="プロフィール" href="/profile" onClick={close} />
				<MenuItem icon={<History size={16} />} label="プレイ履歴" href="/history" onClick={close} />
				<MenuItem
					icon={<Medal size={16} />}
					label="実績・バッジ"
					onClick={() => {
						close();
					}}
				/>
				<MenuItem
					icon={<Settings size={16} />}
					label="ユーザー設定"
					href="/settings"
					onClick={close}
				/>
			</div>

			<Divider />

			<div className="flex flex-col py-2">
				<MenuItem
					icon={<BookOpen size={16} />}
					label="遊び方"
					onClick={() => {
						close();
						onHowToPlay?.();
					}}
				/>
				<MenuItem icon={<Trophy size={16} />} label="ランキング" href="/ranking" onClick={close} />
			</div>

			<Divider />

			<div className="flex flex-col py-2">
				<MenuItem
					icon={<MessageCircle size={16} />}
					label="フィードバック"
					onClick={() => {
						close();
						onFeedback?.();
					}}
				/>
			</div>
		</div>
	);
}

export default function Header({ user, onHowToPlay, onFeedback }: Props) {
	const [menuOpen, setMenuOpen] = useState(false);
	const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
	const { best_scores: bestScores } = usePage().props as unknown as SharedProps;
	const menuRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		if (!menuOpen) return;
		const onKey = (e: KeyboardEvent) => {
			if (e.key === 'Escape') setMenuOpen(false);
		};
		const onPointerDown = (e: MouseEvent) => {
			if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
				setMenuOpen(false);
			}
		};
		document.addEventListener('keydown', onKey);
		document.addEventListener('mousedown', onPointerDown);
		return () => {
			document.removeEventListener('keydown', onKey);
			document.removeEventListener('mousedown', onPointerDown);
		};
	}, [menuOpen]);

	const close = () => setMenuOpen(false);

	const requestLogout = () => {
		setMenuOpen(false);
		setShowLogoutConfirm(true);
	};

	const confirmLogout = () => {
		setShowLogoutConfirm(false);
		router.delete('/auth/logout');
	};

	return (
		<nav aria-label="Global" className="relative z-50 backdrop-blur-md">
			<div className="mx-auto max-w-7xl px-6 sm:px-12">
				<div className="flex h-20 items-center justify-between">
					<Link href="/" className="-m-1.5 flex items-center p-1.5">
						<span className="sr-only">上毛かるたタイピング</span>
						<span className="text-lg font-semibold tracking-wide text-[#F5E9C8]" style={JP_FONT}>
							上毛かるたタイピング
						</span>
					</Link>
					<div className="flex justify-end">
						<div className="relative" ref={menuRef}>
							{user ? (
								<button
									type="button"
									aria-label={menuOpen ? 'メニューを閉じる' : 'メニューを開く'}
									aria-expanded={menuOpen}
									aria-haspopup="menu"
									onClick={() => setMenuOpen((open) => !open)}
									className={`flex h-11 w-11 items-center justify-center overflow-hidden rounded-full transition ${
										user.avatar_url
											? 'ring-2 ring-[#E5C875]'
											: 'border-2 border-[#E5C875] bg-[#0F2952] text-[#E5C875]'
									} ${menuOpen ? 'shadow-[0_0_12px_#E5C87599]' : ''}`}
								>
									{user.avatar_url ? (
										<img
											src={user.avatar_url}
											alt="アカウントメニュー"
											className="h-full w-full object-cover"
										/>
									) : (
										<User size={22} aria-hidden="true" />
									)}
								</button>
							) : (
								<button
									type="button"
									aria-label={menuOpen ? 'メニューを閉じる' : 'メニューを開く'}
									aria-expanded={menuOpen}
									aria-haspopup="menu"
									onClick={() => setMenuOpen((open) => !open)}
									className={`flex h-11 w-11 items-center justify-center rounded-full bg-[#0F2952] transition-colors ${
										menuOpen
											? 'border-2 border-[#E5C875] text-[#E5C875] shadow-[0_0_12px_#E5C87599]'
											: 'border border-[#C9A961] text-[#E5C875] hover:border-[#E5C875] hover:bg-[#132D57]'
									}`}
								>
									{menuOpen ? (
										<X size={22} aria-hidden="true" />
									) : (
										<Menu size={22} aria-hidden="true" />
									)}
								</button>
							)}

							{menuOpen && (
								<>
									<MenuPointer />
									{user ? (
										<UserDropdown
											user={user}
											bestScores={bestScores}
											onHowToPlay={onHowToPlay}
											onFeedback={onFeedback}
											onLogout={requestLogout}
											close={close}
										/>
									) : (
										<GuestDropdown
											onHowToPlay={onHowToPlay}
											onFeedback={onFeedback}
											close={close}
										/>
									)}
								</>
							)}
						</div>
					</div>
				</div>
			</div>

			{showLogoutConfirm && (
				<ConfirmModal
					icon={LogOut}
					title="ログアウトしますか？"
					confirmLabel="ログアウト"
					onConfirm={confirmLogout}
					onCancel={() => setShowLogoutConfirm(false)}
				/>
			)}
		</nav>
	);
}
