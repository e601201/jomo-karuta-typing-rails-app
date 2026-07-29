import { useState } from 'react';
import { Head, usePage } from '@inertiajs/react';
import { Award, CircleCheck, Flame, Gamepad2, Lock, Medal } from 'lucide-react';
import type { SharedProps } from '@/types';
import Header from '@/components/layout/Header';
import backgroundImage from '@/assets/images/background.webp';

const SERIF = { fontFamily: "'Noto Serif JP', serif" } as const;
const MONO = { fontFamily: "'JetBrains Mono', monospace" } as const;

// バッジはサーバー側（badge.rb）で評価済み・表示用整形済みのものを受け取る。
// このページは汎用レンダラーに徹し、バッジ個別の知識（書式分岐・判定）を持たない（#21 / ADR 0007）
interface BadgeItem {
	id: string;
	name: string;
	description: string;
	category: string;
	unlocked: boolean;
	unlocked_at: string | null;
	progress: { current: string; target: string } | null;
}

interface AchievementsProps {
	badges: BadgeItem[];
	categories: string[];
	stats: {
		totalPlays: number;
		currentStreak: number;
	};
}

function formatUnlockedDate(iso: string): string {
	return new Date(iso).toLocaleDateString('ja-JP', {
		year: 'numeric',
		month: '2-digit',
		day: '2-digit'
	});
}

function StatCard({ Icon, label, value }: { Icon: typeof Medal; label: string; value: string }) {
	return (
		<div className="flex flex-col items-center gap-2 rounded-xl border border-[#C9A961] bg-[#0A1A3599] px-4 py-4 text-center">
			<span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#C9A961]">
				<Icon className="h-5 w-5 text-[#0F2952]" />
			</span>
			<span className="text-sm font-medium text-[#C9A961]">{label}</span>
			<span className="text-xl font-extrabold text-[#F5E9C8]" style={MONO}>
				{value}
			</span>
		</div>
	);
}

function BadgeCard({ badge }: { badge: BadgeItem }) {
	if (badge.unlocked) {
		return (
			<div className="flex flex-col items-center gap-2 rounded-xl border-2 border-[#C9A961] bg-[#0A1A35DD] px-4 py-6 text-center shadow-[0_4px_16px_#00000066]">
				<span className="flex h-14 w-14 items-center justify-center rounded-full bg-linear-to-b from-[#E5C875] to-[#C9A961]">
					<Medal className="h-8 w-8 text-[#0F2952]" />
				</span>
				<span className="text-lg font-extrabold text-[#F5E9C8]">{badge.name}</span>
				<span className="text-xs text-[#B8A874]">{badge.description}</span>
				<span className="mt-auto inline-flex items-center gap-1.5 pt-2 text-xs font-semibold text-[#3FB56B]">
					<CircleCheck className="h-4 w-4" />
					{badge.unlocked_at ? formatUnlockedDate(badge.unlocked_at) : ''} 解除
				</span>
			</div>
		);
	}
	return (
		<div className="flex flex-col items-center gap-2 rounded-xl border-2 border-[#C9A961] bg-[#0A1A35DD] px-4 py-6 text-center opacity-[0.72]">
			<span className="flex h-14 w-14 items-center justify-center rounded-full border border-[#C9A961] bg-[#1E3560]">
				<Lock className="h-7 w-7 text-[#B8A874]" />
			</span>
			<span className="text-lg font-extrabold text-[#F5E9C8]">{badge.name}</span>
			<span className="text-xs text-[#B8A874]">{badge.description}</span>
			{badge.progress && (
				<span className="mt-auto pt-2 text-xs font-semibold text-[#C9A961]" style={MONO}>
					{badge.progress.current} / {badge.progress.target}
				</span>
			)}
		</div>
	);
}

export default function Achievements({ badges, categories, stats }: AchievementsProps) {
	const { auth } = usePage().props as unknown as SharedProps;
	const [categoryFilter, setCategoryFilter] = useState<string>('all');

	const unlockedCount = badges.filter((b) => b.unlocked).length;
	const unlockedRatio = badges.length > 0 ? (unlockedCount / badges.length) * 100 : 0;
	const visibleBadges =
		categoryFilter === 'all' ? badges : badges.filter((b) => b.category === categoryFilter);

	return (
		<div
			className="min-h-screen bg-cover bg-fixed bg-center"
			style={{ backgroundImage: `url(${backgroundImage})`, ...SERIF }}
		>
			<Head title="実績・バッジ - 上毛かるたタイピング" />

			<Header user={auth?.user ?? null} />

			<div className="flex flex-col items-center gap-6 px-4 pt-4 pb-12 sm:px-8">
				{/* ヒーロー */}
				<div className="flex items-center gap-4 rounded-xl border border-[#C9A961] bg-[#0A1A35CC] px-10 py-4 shadow-[0_4px_16px_#00000066]">
					<span className="flex h-14 w-14 items-center justify-center rounded-full bg-[#C9A961]">
						<Award className="h-8 w-8 text-[#0F2952]" />
					</span>
					<h1
						className="text-4xl font-black text-white sm:text-5xl"
						style={{ textShadow: '0 2px 4px rgba(0,0,0,0.67)' }}
					>
						実績・バッジ
					</h1>
				</div>

				{/* 進捗パネル（design 3枚構成からランク・ポイントを除いた縮小版。#33 で復帰予定） */}
				<div className="flex w-full max-w-[900px] flex-col gap-5 rounded-xl border-2 border-[#C9A961] bg-[#0A1A35DD] px-6 py-6 shadow-[0_4px_16px_#00000066] sm:px-8">
					<div className="flex items-end justify-between">
						<span className="text-lg font-bold text-[#F5E9C8]">達成バッジ</span>
						<span className="text-2xl font-extrabold text-[#E5C875]" style={MONO}>
							{unlockedCount} / {badges.length}
						</span>
					</div>
					<div className="h-3 w-full overflow-hidden rounded-full bg-[#1E3560]">
						<div
							className="h-full rounded-full bg-linear-to-r from-[#E5C875] to-[#C9A961]"
							style={{ width: `${unlockedRatio}%` }}
						/>
					</div>
					<div className="grid grid-cols-2 gap-4">
						<StatCard
							Icon={Gamepad2}
							label="総プレイ回数"
							value={`${stats.totalPlays.toLocaleString()}回`}
						/>
						<StatCard Icon={Flame} label="連続プレイ" value={`${stats.currentStreak}日`} />
					</div>
				</div>

				{/* カテゴリタブ（カタログ由来。フロントにはハードコードしない） */}
				<div className="flex max-w-full gap-2 overflow-x-auto rounded-[10px] border border-[#C9A961] bg-[#0A1A3599] p-1.5 sm:gap-3">
					{['all', ...categories].map((category) => {
						const active = categoryFilter === category;
						return (
							<button
								key={category}
								type="button"
								onClick={() => setCategoryFilter(category)}
								className={`rounded-lg px-4 py-2.5 text-sm whitespace-nowrap transition-colors sm:px-6 ${
									active
										? 'bg-linear-to-b from-[#E5C875] to-[#C9A961] font-bold text-[#0F2952]'
										: 'font-semibold text-[#F5E9C8] hover:bg-[#132D57]'
								}`}
							>
								{category === 'all' ? 'すべて' : category}
							</button>
						);
					})}
				</div>

				{/* バッジグリッド */}
				<div className="grid w-full max-w-[1100px] grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
					{visibleBadges.map((badge) => (
						<BadgeCard key={badge.id} badge={badge} />
					))}
				</div>
			</div>
		</div>
	);
}
