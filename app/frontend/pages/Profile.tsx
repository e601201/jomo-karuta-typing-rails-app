import { Head, Link, router, usePage } from '@inertiajs/react';
import { Calendar, House, LogOut, Mail, User as UserIcon } from 'lucide-react';
import type { SharedProps } from '@/types';
import backgroundImage from '@/assets/images/background.webp';

const SERIF = { fontFamily: "'Noto Serif JP', serif" } as const;
const MONO = { fontFamily: "'JetBrains Mono', monospace" } as const;

// 旧 src/routes/profile/+page.svelte の移植。
// ユーザー情報は inertia_share の auth props から取得する（サーバ側 require_login 保護済み）。
// デザインは design.pen（ランキング画面 vjTBm）準拠のダークデザインに刷新。
export default function Profile() {
	const { auth } = usePage().props as unknown as SharedProps;
	const user = auth.user;

	const nickname = user?.nickname || user?.email?.split('@')[0] || 'ゲスト';
	const initial = nickname.charAt(0).toUpperCase();
	const joined = user?.created_at ? new Date(user.created_at).toLocaleDateString('ja-JP') : '-';

	const infoRows = [
		{ icon: Mail, label: 'メールアドレス', value: user?.email ?? '-', mono: false },
		{ icon: UserIcon, label: 'ニックネーム', value: nickname, mono: false },
		{ icon: Calendar, label: '登録日', value: joined, mono: true }
	];

	return (
		<div
			className="min-h-screen bg-cover bg-fixed bg-center p-8"
			style={{ backgroundImage: `url(${backgroundImage})`, ...SERIF }}
		>
			<Head title="プロフィール - 上毛かるたタイピング" />

			<div className="mx-auto flex w-full max-w-[880px] flex-col gap-5">
				{/* ヘッダー */}
				<header className="flex flex-wrap items-center justify-between gap-4 rounded-[10px] border border-[#C9A961] bg-[#0A1A35CC] px-8 py-4">
					<div className="flex items-center gap-3">
						<span className="flex h-11 w-11 items-center justify-center rounded-full bg-[#C9A961]">
							<UserIcon className="h-[22px] w-[22px] text-[#0F2952]" />
						</span>
						<h1
							className="text-[32px] font-black text-white"
							style={{ textShadow: '0 2px 4px rgba(0,0,0,0.67)' }}
						>
							プロフィール
						</h1>
					</div>
					<Link
						href="/auth/logout"
						method="delete"
						as="button"
						className="flex items-center gap-2 rounded-lg border border-[#C8302A] bg-[#0A1A3599] px-6 py-2.5 text-[15px] font-bold text-[#F5E9C8] transition-colors hover:bg-[#0A1A35]"
					>
						<LogOut className="h-4 w-4 text-[#C8302A]" />
						ログアウト
					</Link>
				</header>

				{/* メインパネル */}
				<main className="flex flex-col gap-7 rounded-[10px] border-2 border-[#C9A961] bg-[#0A1A35DD] px-9 py-8">
					{/* アバター + 名前 */}
					<div className="flex items-center gap-5">
						{user?.avatar_url ? (
							<img
								src={user.avatar_url}
								alt={nickname}
								className="h-20 w-20 rounded-full border-2 border-[#E5C875] object-cover"
							/>
						) : (
							<span
								className="flex h-20 w-20 items-center justify-center rounded-full border-2 border-[#E5C875] text-3xl font-black text-white"
								style={{ background: 'linear-gradient(180deg, #3A6BC8 0%, #1E3A6B 100%)' }}
							>
								{initial}
							</span>
						)}
						<div className="flex min-w-0 flex-col gap-1">
							<span className="truncate text-2xl font-extrabold text-[#F5E9C8]">{nickname}</span>
							<span className="truncate text-sm font-medium text-[#B8A874]">{user?.email}</span>
						</div>
					</div>

					{/* 見出し（赤いアクセントバー + 金色タイトル） */}
					<div className="flex items-center gap-2.5">
						<span className="h-6 w-1 rounded-sm bg-[#C8302A]" />
						<h2 className="text-[22px] font-extrabold text-[#E5C875]">ユーザー情報</h2>
					</div>

					{/* 情報行 */}
					<div className="flex flex-col gap-3.5">
						{infoRows.map((row) => {
							const Icon = row.icon;
							return (
								<div
									key={row.label}
									className="flex items-center gap-4 rounded-[10px] border border-[#C9A961] bg-[#132D57] px-5 py-4"
								>
									<span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] border border-[#C9A961] bg-[#0F2952]">
										<Icon className="h-[18px] w-[18px] text-[#E5C875]" />
									</span>
									<div className="flex min-w-0 flex-1 flex-col gap-0.5">
										<span className="text-[13px] font-semibold text-[#C9A961]">{row.label}</span>
										<span
											className="truncate text-base font-bold text-[#F5E9C8]"
											style={row.mono ? MONO : undefined}
										>
											{row.value}
										</span>
									</div>
								</div>
							);
						})}
					</div>
				</main>

				{/* TOPに戻る */}
				<div className="flex justify-center">
					<button
						onClick={() => router.visit('/')}
						type="button"
						className="flex items-center gap-2 rounded-lg border border-[#C9A961] bg-[#0A1A35CC] px-6 py-3 text-[15px] font-semibold text-[#F5E9C8] transition-colors hover:bg-[#0A1A35]"
					>
						<House className="h-4 w-4 text-[#E5C875]" />
						TOPに戻る
					</button>
				</div>
			</div>
		</div>
	);
}
