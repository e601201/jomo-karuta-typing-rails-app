import type { ComponentType } from 'react';
import { Head, Link, useForm, usePage } from '@inertiajs/react';
import {
	BookOpen,
	Bug,
	CheckCircle2,
	CircleQuestionMark,
	Info,
	Lightbulb,
	MessageCircle,
	MessageSquareHeart,
	RotateCcw,
	Send,
	Sparkles
} from 'lucide-react';
import type { SharedProps } from '@/types';
import Header from '@/components/layout/Header';
import backgroundImage from '@/assets/images/background.webp';

// 見出し・ラベルは明朝、本文・入力値・補足はゴシック（デザイン wNwWp 準拠）
const SERIF = { fontFamily: "'Noto Serif JP', serif" } as const;
const SANS = { fontFamily: "'Noto Sans JP', sans-serif" } as const;

const BODY_MAX_LENGTH = 1000;
const SUBJECT_MAX_LENGTH = 100;

// カテゴリは Feedback モデルの enum と一致させる（CONTEXT.md「フィードバック」参照）。
const CATEGORIES: { value: string; label: string; icon: ComponentType<{ size?: number }> }[] = [
	{ value: 'bug_report', label: 'バグ報告', icon: Bug },
	{ value: 'feature_request', label: '機能リクエスト', icon: Sparkles },
	{ value: 'usage_question', label: '使い方の質問', icon: CircleQuestionMark },
	{ value: 'other', label: 'その他', icon: MessageCircle }
];

// 左情報パネルのカテゴリー説明（デザイン wNwWp 準拠。フォームの種類選択とは別の説明用）。
const CATEGORY_INFO: {
	label: string;
	desc: string;
	icon: ComponentType<{ size?: number; color?: string }>;
	color: string;
}[] = [
	{ label: 'バグ報告', desc: '動作の不具合やエラー', icon: Bug, color: '#C8302A' },
	{ label: '機能リクエスト', desc: '新機能のご提案', icon: Lightbulb, color: '#E5C875' },
	{
		label: '使い方の質問',
		desc: '操作方法や使い方について',
		icon: CircleQuestionMark,
		color: '#E5C875'
	},
	// デザインは #0F2952 だが背景 #0A1A35 とほぼ同色で埋もれるため、視認できる控えめな金にする
	{ label: 'その他', desc: '感想・お問い合わせ', icon: MessageCircle, color: '#B8A874' }
];

const FIELD_LABEL = 'text-sm font-semibold text-[#C9A961]';
const TEXT_INPUT =
	'w-full rounded-lg border border-[#C9A961] bg-[#132D57] px-4 py-3 text-[15px] text-[#F5E9C8] outline-none placeholder:text-[#B8A874]/60 focus:border-[#E5C875]';

function FieldError({ messages }: { messages?: string[] }) {
	if (!messages || messages.length === 0) return null;
	return (
		<p className="text-[13px] font-semibold text-[#F1A5A0]" style={SANS} role="alert">
			{messages.join(' ')}
		</p>
	);
}

// 左情報パネル。お問い合わせの案内とカテゴリー説明のみ（デザイン wNwWp 準拠）。
function LeftInfoPanel() {
	return (
		<aside className="flex w-full flex-col gap-5 rounded-[10px] border border-[#C9A961] bg-[#0A1A35CC] p-6 lg:w-[340px] lg:shrink-0">
			<div className="flex items-center gap-2.5">
				<span className="h-[22px] w-1 rounded-sm bg-[#C8302A]" />
				<h2 className="text-xl font-bold tracking-[1px] text-[#E5C875]">お問い合わせ</h2>
			</div>
			<p className="text-xs leading-[1.7] text-[#B8A874]" style={SANS}>
				ご意見・ご要望をお聞かせください。より良いアプリづくりのため、皆様の声を大切にしています。
			</p>

			<div className="flex items-center gap-2">
				<span className="text-[11px] font-semibold tracking-[2px] text-[#C9A961]">カテゴリー</span>
				<span className="h-px flex-1 bg-[#C9A961]/25" />
			</div>

			<div className="flex flex-col gap-2.5">
				{CATEGORY_INFO.map(({ label, desc, icon: Icon, color }) => (
					<div
						key={label}
						className="flex items-center gap-3 rounded-md border border-[#C9A961]/25 bg-[#0D2145] p-3"
					>
						<span
							className="flex h-9 w-9 shrink-0 items-center justify-center rounded border bg-[#0A1A35]"
							style={{ borderColor: color }}
						>
							<Icon size={18} color={color} />
						</span>
						<div className="flex flex-col gap-0.5">
							<span className="text-[13px] font-semibold text-[#F5E9C8]">{label}</span>
							<span className="text-[10px] leading-[1.5] text-[#B8A874]" style={SANS}>
								{desc}
							</span>
						</div>
					</div>
				))}
			</div>
		</aside>
	);
}

export default function Feedback() {
	const { auth, flash } = usePage().props as unknown as SharedProps;

	const form = useForm({
		category: '',
		subject: '',
		body: '',
		// ログイン時はアカウントのメールを既定表示（返信先。任意）
		email: auth?.user?.email ?? '',
		// ハニーポット（人間には見えない。bot が埋めたら破棄）
		website: ''
	});
	const { data, setData, errors, processing } = form;

	const selectCategory = (value: string) => {
		setData('category', value);
		if (errors.category) form.clearErrors('category');
	};

	const submit = (e: React.FormEvent) => {
		e.preventDefault();

		// クライアント側の必須チェック（種類・メッセージ）。サーバ側 presence が最終権威。
		const nextErrors: Partial<Record<'category' | 'body', string[]>> = {};
		if (!data.category) nextErrors.category = ['種類を選択してください'];
		if (!data.body.trim()) nextErrors.body = ['メッセージを入力してください'];

		form.clearErrors();
		if (Object.keys(nextErrors).length > 0) {
			form.setError(nextErrors);
			return;
		}

		form.post('/feedback', { preserveScroll: true });
	};

	return (
		<div
			className="min-h-screen bg-cover bg-fixed bg-center"
			style={{ backgroundImage: `url(${backgroundImage})`, ...SERIF }}
		>
			<Head title="フィードバック - 上毛かるたタイピング" />

			<Header user={auth?.user ?? null} />

			<div className="p-8">
				<div className="mx-auto flex w-full max-w-[1160px] flex-col gap-5">
					{/* ヒーロー */}
					<header className="flex flex-wrap items-center gap-3 rounded-[10px] border border-[#C9A961] bg-[#0A1A35CC] px-8 py-4">
						<span className="flex h-11 w-11 items-center justify-center rounded-full bg-[#C9A961]">
							<MessageSquareHeart className="h-[22px] w-[22px] text-[#0A1A35]" />
						</span>
						<h1
							className="text-[32px] font-black text-white"
							style={{ textShadow: '0 2px 4px rgba(0,0,0,0.67)' }}
						>
							フィードバック
						</h1>
						<span className="text-sm font-medium text-[#B8A874]" style={SANS}>
							ご意見・ご要望をお聞かせください
						</span>
					</header>

					{flash?.notice ? (
						<section className="flex flex-col items-center gap-4 rounded-[10px] border-2 border-[#C9A961] bg-[#0A1A35DD] px-9 py-12 text-center">
							<CheckCircle2 className="h-14 w-14 text-[#8FD19E]" />
							<p className="text-lg font-bold text-[#F5E9C8]">{flash.notice}</p>
							<div className="mt-2 flex flex-wrap items-center justify-center gap-3">
								<Link
									href="/"
									className="rounded-lg border border-[#E5C875] bg-linear-to-b from-[#E5C875] to-[#C9A961] px-6 py-2.5 text-[15px] font-extrabold text-[#0F2952] transition-opacity hover:opacity-90"
								>
									TOPへ戻る
								</Link>
								<Link
									href="/feedback"
									className="rounded-lg border border-[#C9A961] bg-[#0A1A3599] px-6 py-2.5 text-[15px] font-semibold text-[#F5E9C8] transition-colors hover:bg-[#0A1A35]"
								>
									続けて送信する
								</Link>
							</div>
						</section>
					) : (
						<div className="flex flex-col gap-5 lg:flex-row lg:items-start">
							<LeftInfoPanel />
							<main className="flex min-w-0 flex-1 flex-col gap-6 rounded-[10px] border-2 border-[#C9A961] bg-[#0A1A35DD] px-9 py-7">
								{/* セクション見出し */}
								<div className="flex items-center gap-2.5">
									<span className="h-6 w-1 rounded-sm bg-[#C8302A]" />
									<h2 className="text-[22px] font-extrabold text-[#E5C875]">
										フィードバックを送信
									</h2>
								</div>
								<p className="text-[13px] leading-[1.7] text-[#B8A874]" style={SANS}>
									上毛かるたタイピングをより良くするため、皆様の声をお聞かせください。すべての項目を入力後、送信ボタンを押してください。
								</p>

								{flash?.alert && (
									<p
										className="rounded-lg border border-[#C8302A] bg-[#2A0E0C] px-4 py-3 text-sm font-semibold text-[#F1A5A0]"
										style={SANS}
										role="alert"
									>
										{flash.alert}
									</p>
								)}

								<form onSubmit={submit} className="flex flex-col gap-6" noValidate>
									{/* 種類 */}
									<div className="flex flex-col gap-2.5">
										<span className={FIELD_LABEL}>種類</span>
										<div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
											{CATEGORIES.map(({ value, label, icon: Icon }) => {
												const selected = data.category === value;
												return (
													<button
														key={value}
														type="button"
														aria-pressed={selected}
														onClick={() => selectCategory(value)}
														className={`flex flex-col items-center justify-center gap-2 rounded-lg px-2.5 py-3.5 text-center transition-colors ${
															selected
																? 'border-2 border-[#E5C875] bg-[#C8302A] text-white'
																: 'border border-[#C9A961] bg-[#132D57]/60 text-[#F5E9C8] hover:bg-[#132D57]'
														}`}
													>
														<Icon size={22} />
														<span className="text-[13px] font-bold">{label}</span>
													</button>
												);
											})}
										</div>
										<FieldError messages={errors.category} />
										{data.category === 'usage_question' && (
											<p
												className="flex items-start gap-2 rounded-lg border border-[#C9A961]/60 bg-[#132D57]/60 px-4 py-3 text-[13px] leading-[1.7] text-[#F5E9C8]"
												style={SANS}
											>
												<BookOpen className="mt-0.5 h-4 w-4 shrink-0 text-[#E5C875]" />
												<span>
													操作やルールのご質問は{' '}
													<Link href="/how-to-play" className="font-bold text-[#E5C875] underline">
														遊び方
													</Link>{' '}
													ページで解決するかもしれません。
												</span>
											</p>
										)}
									</div>

									{/* 件名（任意） */}
									<div className="flex flex-col gap-2.5">
										<label htmlFor="feedback-subject" className={FIELD_LABEL}>
											件名
										</label>
										<input
											id="feedback-subject"
											type="text"
											value={data.subject}
											onChange={(e) => setData('subject', e.target.value)}
											maxLength={SUBJECT_MAX_LENGTH}
											placeholder="例: タイピング判定について"
											className={TEXT_INPUT}
											style={SANS}
										/>
										<FieldError messages={errors.subject} />
									</div>

									{/* メッセージ（必須） */}
									<div className="flex flex-col gap-2.5">
										<div className="flex items-center justify-between">
											<div className="flex items-center gap-2">
												<label htmlFor="feedback-body" className={FIELD_LABEL}>
													メッセージ
												</label>
												<span
													className="rounded-[4px] bg-[#C8302A] px-2 py-0.5 text-[10px] font-bold text-white"
													style={SANS}
												>
													必須
												</span>
											</div>
											<span className="text-xs font-medium text-[#B8A874]" style={SANS}>
												{data.body.length} / {BODY_MAX_LENGTH}
											</span>
										</div>
										<textarea
											id="feedback-body"
											value={data.body}
											onChange={(e) => {
												setData('body', e.target.value);
												if (errors.body) form.clearErrors('body');
											}}
											required
											maxLength={BODY_MAX_LENGTH}
											rows={8}
											placeholder="お気づきの点、ご要望などをご記入ください。"
											className={`${TEXT_INPUT} resize-y py-3.5 leading-[1.8]`}
											style={SANS}
										/>
										<FieldError messages={errors.body} />
									</div>

									{/* 返信用メールアドレス（任意） */}
									<div className="flex flex-col gap-2.5">
										<label htmlFor="feedback-email" className={FIELD_LABEL}>
											返信用メールアドレス（任意）
										</label>
										<input
											id="feedback-email"
											type="email"
											value={data.email}
											onChange={(e) => setData('email', e.target.value)}
											placeholder="返信が必要な場合のみ"
											className={TEXT_INPUT}
											style={SANS}
										/>
										<FieldError messages={errors.email} />
									</div>

									{/* ハニーポット（人間には非表示。bot 検出用） */}
									<div aria-hidden="true" style={{ position: 'absolute', left: '-9999px' }}>
										<label htmlFor="feedback-website">Website</label>
										<input
											id="feedback-website"
											type="text"
											tabIndex={-1}
											autoComplete="off"
											value={data.website}
											onChange={(e) => setData('website', e.target.value)}
										/>
									</div>

									{/* 注意文 + アクション */}
									<div className="flex flex-wrap items-center gap-x-4 gap-y-3">
										<p
											className="flex flex-1 items-center gap-1.5 text-xs font-medium text-[#B8A874]"
											style={SANS}
										>
											<Info className="h-3.5 w-3.5 shrink-0 text-[#C9A961]" />
											送信された内容はサービス改善のためにのみ利用されます
										</p>
										<div className="flex items-center gap-3">
											<button
												type="button"
												onClick={() => form.reset()}
												className="flex items-center gap-2 rounded-lg border border-[#C9A961] bg-[#0A1A35]/60 px-6 py-3 text-sm font-bold text-[#F5E9C8] transition-colors hover:bg-[#0A1A35]"
											>
												<RotateCcw className="h-4 w-4 text-[#E5C875]" />
												クリア
											</button>
											<button
												type="submit"
												disabled={processing}
												className="flex items-center gap-2.5 rounded-lg border border-[#E5C875] bg-linear-to-b from-[#E04A43] to-[#C8302A] px-7 py-3 text-[15px] font-extrabold text-white shadow-[0_2px_6px_#00000066] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
											>
												<Send className="h-4 w-4" />
												送信する
											</button>
										</div>
									</div>
								</form>
							</main>
						</div>
					)}
				</div>
			</div>
		</div>
	);
}
