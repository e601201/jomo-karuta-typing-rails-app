import { Head, Link, usePage } from '@inertiajs/react';
import { ChevronLeft, ChevronRight, Inbox, MessageCircle } from 'lucide-react';
import type { SharedProps } from '@/types';
import Header from '@/components/layout/Header';
import { formatDateTime } from '@/lib/format-datetime';
import {
	FEEDBACK_CATEGORY_LABELS,
	type FeedbackCategory
} from '@/lib/feedback-categories';
import backgroundImage from '@/assets/images/background.webp';

const SERIF = { fontFamily: "'Noto Serif JP', serif" } as const;
const SANS = { fontFamily: "'Noto Sans JP', sans-serif" } as const;

interface FeedbackRow {
	id: number;
	category: FeedbackCategory;
	subject: string | null;
	body: string;
	email: string | null;
	created_at: string;
	user: { id: number; nickname: string | null; email: string } | null;
}

interface AdminFeedbacksProps {
	feedbacks: FeedbackRow[];
	categories: FeedbackCategory[];
	category: FeedbackCategory | null;
	page: number;
	perPage: number;
	total: number;
}

function listHref(category: FeedbackCategory | null, page: number): string {
	const params = new URLSearchParams();
	if (category) params.set('category', category);
	if (page > 1) params.set('page', String(page));
	const query = params.toString();
	return query ? `/admin/feedbacks?${query}` : '/admin/feedbacks';
}

function CategoryChip({ category }: { category: FeedbackCategory }) {
	return (
		<span className="inline-block rounded-full border border-[#C9A961] bg-[#0A1A3599] px-2.5 py-0.5 text-xs font-semibold text-[#F5E9C8]">
			{FEEDBACK_CATEGORY_LABELS[category]}
		</span>
	);
}

function SenderCell({ user }: { user: FeedbackRow['user'] }) {
	if (!user) {
		return (
			<span className="inline-block rounded-full border border-[#B8A874] bg-[#0A1A3599] px-2.5 py-0.5 text-xs font-semibold text-[#B8A874]">
				ゲスト
			</span>
		);
	}

	return (
		<div className="flex min-w-0 flex-col gap-0.5">
			<span className="truncate font-semibold text-[#F5E9C8]">{user.nickname || '—'}</span>
			<span className="truncate text-[11px] text-[#B8A874]" style={SANS}>
				アカウント: {user.email}
			</span>
		</div>
	);
}

export default function AdminFeedbacks({
	feedbacks,
	categories,
	category,
	page,
	perPage,
	total
}: AdminFeedbacksProps) {
	const { auth } = usePage().props as unknown as SharedProps;
	const isEmpty = total === 0;
	const lastPage = Math.max(1, Math.ceil(total / perPage));
	const from = total === 0 ? 0 : (page - 1) * perPage + 1;
	const to = Math.min(page * perPage, total);
	const tabs: { value: FeedbackCategory | null; label: string }[] = [
		{ value: null, label: 'すべて' },
		...categories.map((value) => ({ value, label: FEEDBACK_CATEGORY_LABELS[value] }))
	];

	return (
		<div
			className="min-h-screen bg-cover bg-fixed bg-center"
			style={{ backgroundImage: `url(${backgroundImage})`, ...SERIF }}
		>
			<Head title="フィードバック一覧 - 上毛かるたタイピング" />

			<Header user={auth?.user ?? null} />

			<div className="flex flex-col items-center gap-6 px-4 pt-4 pb-12 sm:px-8">
				<div className="flex items-center gap-4 rounded-xl border border-[#C9A961] bg-[#0A1A35CC] px-10 py-4 shadow-[0_4px_16px_#00000066]">
					<span className="flex h-14 w-14 items-center justify-center rounded-full bg-[#C9A961]">
						<Inbox className="h-8 w-8 text-[#0F2952]" />
					</span>
					<h1
						className="text-4xl font-black text-white sm:text-5xl"
						style={{ textShadow: '0 2px 4px rgba(0,0,0,0.67)' }}
					>
						フィードバック一覧
					</h1>
				</div>

				<div className="flex flex-wrap justify-center gap-3 rounded-[10px] border border-[#C9A961] bg-[#0A1A3599] p-1.5">
					{tabs.map((tab) => {
						const active = tab.value === category;
						return (
							<Link
								key={tab.value ?? 'all'}
								href={listHref(tab.value, 1)}
								className={`rounded-lg px-5 py-2.5 text-sm transition-colors sm:px-7 ${
									active
										? 'bg-linear-to-b from-[#E5C875] to-[#C9A961] font-bold text-[#0F2952]'
										: 'font-semibold text-[#F5E9C8] hover:bg-[#132D57]'
								}`}
							>
								{tab.label}
							</Link>
						);
					})}
				</div>

				{isEmpty ? (
					<div className="mt-2 flex w-full max-w-[560px] flex-col items-center gap-5 rounded-xl border-2 border-[#C9A961] bg-[#0A1A35DD] px-8 py-14 text-center">
						<MessageCircle className="h-14 w-14 text-[#C9A961]" />
						<p className="text-xl font-bold text-[#F5E9C8]">
							{category
								? 'この種類のフィードバックはありません'
								: 'まだフィードバックはありません'}
						</p>
						<p className="text-[#B8A874]">
							{category
								? 'ほかの種類を選ぶか、すべてに戻してください。'
								: 'プレイヤーから届くと、ここに新しい順で並びます。'}
						</p>
					</div>
				) : (
					<div className="w-full max-w-[1100px]">
						<p className="mb-2 text-right text-xs text-[#B8A874]" style={SANS}>
							全{total.toLocaleString()}件中 {from.toLocaleString()}–
							{to.toLocaleString()}件
						</p>
						<div className="overflow-x-auto rounded-xl border-2 border-[#C9A961] bg-[#0A1A35DD]">
							<table className="w-full min-w-[880px] border-collapse text-left">
								<thead>
									<tr className="bg-[#132D57] text-sm font-bold text-[#C9A961]">
										<th className="px-4 py-4 sm:px-6">受信日時</th>
										<th className="px-4 py-4">カテゴリ</th>
										<th className="px-4 py-4">件名</th>
										<th className="px-4 py-4">本文</th>
										<th className="px-4 py-4">返信先</th>
										<th className="px-4 py-4 sm:px-6">送信者</th>
									</tr>
								</thead>
								<tbody>
									{feedbacks.map((row) => (
										<tr
											key={row.id}
											className="border-t border-[#1E3560] align-top transition-colors hover:bg-[#132D57]/40"
										>
											<td className="px-4 py-4 text-sm whitespace-nowrap text-[#F5E9C8] sm:px-6">
												{formatDateTime(row.created_at)}
											</td>
											<td className="px-4 py-4">
												<CategoryChip category={row.category} />
											</td>
											<td className="px-4 py-4 text-sm text-[#F5E9C8]">
												{row.subject?.trim() ? row.subject : '—'}
											</td>
											<td
												className="max-w-[360px] px-4 py-4 text-sm leading-[1.7] break-words whitespace-pre-wrap text-[#F5E9C8]"
												style={SANS}
											>
												{row.body}
											</td>
											<td className="px-4 py-4 text-sm" style={SANS}>
												{row.email ? (
													<a
														href={`mailto:${row.email}`}
														className="break-all text-[#E5C875] underline"
													>
														{row.email}
													</a>
												) : (
													<span className="text-[#B8A874]">—</span>
												)}
											</td>
											<td className="px-4 py-4 sm:px-6">
												<SenderCell user={row.user} />
											</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>

						{lastPage > 1 && (
							<nav
								aria-label="ページ送り"
								className="mt-4 flex items-center justify-center gap-4"
							>
								{page > 1 ? (
									<Link
										href={listHref(category, page - 1)}
										className="inline-flex items-center gap-1 rounded-lg border border-[#C9A961] bg-[#0A1A3599] px-4 py-2 text-sm font-semibold text-[#F5E9C8] hover:bg-[#132D57]"
									>
										<ChevronLeft className="h-4 w-4" />
										前へ
									</Link>
								) : (
									<span className="inline-flex items-center gap-1 rounded-lg border border-[#C9A961]/40 px-4 py-2 text-sm text-[#B8A874]/60">
										<ChevronLeft className="h-4 w-4" />
										前へ
									</span>
								)}
								<span className="text-sm text-[#B8A874]" style={SANS}>
									{page} / {lastPage}
								</span>
								{page < lastPage ? (
									<Link
										href={listHref(category, page + 1)}
										className="inline-flex items-center gap-1 rounded-lg border border-[#C9A961] bg-[#0A1A3599] px-4 py-2 text-sm font-semibold text-[#F5E9C8] hover:bg-[#132D57]"
									>
										次へ
										<ChevronRight className="h-4 w-4" />
									</Link>
								) : (
									<span className="inline-flex items-center gap-1 rounded-lg border border-[#C9A961]/40 px-4 py-2 text-sm text-[#B8A874]/60">
										次へ
										<ChevronRight className="h-4 w-4" />
									</span>
								)}
							</nav>
						)}
					</div>
				)}
			</div>
		</div>
	);
}
