import { Head, Link, useForm, usePage } from '@inertiajs/react';
import { BookOpen, CheckCircle2, MessageCircle } from 'lucide-react';
import type { SharedProps } from '@/types';
import Header from '@/components/layout/Header';
import backgroundImage from '@/assets/images/background.webp';

const SERIF = { fontFamily: "'Noto Serif JP', serif" } as const;

const BODY_MAX_LENGTH = 2000;

// カテゴリは Feedback モデルの enum と一致させる（CONTEXT.md「フィードバック」参照）。
const CATEGORIES: { value: string; label: string }[] = [
	{ value: 'bug_report', label: 'バグ報告' },
	{ value: 'feature_request', label: '機能リクエスト' },
	{ value: 'usage_question', label: '使い方の質問' },
	{ value: 'other', label: 'その他' }
];

const FIELD_LABEL = 'text-sm font-bold text-[#E5C875]';
const FIELD_CONTROL =
	'w-full rounded-lg border border-[#C9A961] bg-[#132D57] px-4 py-3 text-[15px] text-[#F5E9C8] outline-none placeholder:text-[#B8A874]/60 focus:border-[#E5C875]';

function FieldError({ messages }: { messages?: string[] }) {
	if (!messages || messages.length === 0) return null;
	return (
		<p className="text-[13px] font-semibold text-[#F1A5A0]" role="alert">
			{messages.join(' ')}
		</p>
	);
}

export default function Feedback() {
	const { auth, flash } = usePage().props as unknown as SharedProps;

	const form = useForm({
		category: '',
		body: '',
		// ログイン時はアカウントのメールを既定表示（返信先。任意）
		email: auth?.user?.email ?? '',
		// ハニーポット（人間には見えない。bot が埋めたら破棄）
		website: ''
	});
	const { data, setData, errors, processing } = form;

	const submit = (e: React.FormEvent) => {
		e.preventDefault();
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
				<div className="mx-auto flex w-full max-w-[720px] flex-col gap-5">
					{/* ヒーロー */}
					<header className="flex flex-wrap items-center gap-4 rounded-[10px] border border-[#C9A961] bg-[#0A1A35CC] px-8 py-4">
						<div className="flex items-center gap-3">
							<span className="flex h-11 w-11 items-center justify-center rounded-full bg-[#C9A961]">
								<MessageCircle className="h-[22px] w-[22px] text-[#0F2952]" />
							</span>
							<h1
								className="text-[32px] font-black text-white"
								style={{ textShadow: '0 2px 4px rgba(0,0,0,0.67)' }}
							>
								フィードバック
							</h1>
						</div>
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
						<main className="flex flex-col gap-7 rounded-[10px] border-2 border-[#C9A961] bg-[#0A1A35DD] px-9 py-8">
							<p className="text-[15px] leading-[1.9] text-[#F5E9C8]">
								ゲーム改善のためのご意見・不具合報告をお寄せください。ログインは不要です。返信が必要な場合はメールアドレスをご記入ください。
							</p>

							{flash?.alert && (
								<p
									className="rounded-lg border border-[#C8302A] bg-[#2A0E0C] px-4 py-3 text-sm font-semibold text-[#F1A5A0]"
									role="alert"
								>
									{flash.alert}
								</p>
							)}

							<form onSubmit={submit} className="flex flex-col gap-6" noValidate>
								{/* カテゴリ */}
								<div className="flex flex-col gap-2">
									<label htmlFor="feedback-category" className={FIELD_LABEL}>
										種類
									</label>
									<select
										id="feedback-category"
										value={data.category}
										onChange={(e) => setData('category', e.target.value)}
										required
										className={`${FIELD_CONTROL} cursor-pointer appearance-none font-bold`}
									>
										<option value="" disabled className="bg-[#132D57] text-[#B8A874]">
											選択してください
										</option>
										{CATEGORIES.map((c) => (
											<option key={c.value} value={c.value} className="bg-[#132D57] text-[#F5E9C8]">
												{c.label}
											</option>
										))}
									</select>
									<FieldError messages={errors.category} />
									{data.category === 'usage_question' && (
										<p className="flex items-start gap-2 rounded-lg border border-[#C9A961]/60 bg-[#132D57]/60 px-4 py-3 text-[13px] leading-[1.7] text-[#F5E9C8]">
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

								{/* 本文 */}
								<div className="flex flex-col gap-2">
									<label htmlFor="feedback-body" className={FIELD_LABEL}>
										内容
									</label>
									<textarea
										id="feedback-body"
										value={data.body}
										onChange={(e) => setData('body', e.target.value)}
										required
										maxLength={BODY_MAX_LENGTH}
										rows={7}
										placeholder="お気づきの点、ご要望などをご記入ください。"
										className={`${FIELD_CONTROL} resize-y leading-[1.8]`}
									/>
									<div className="flex items-center justify-between">
										<FieldError messages={errors.body} />
										<span className="ml-auto text-xs text-[#B8A874]">
											{data.body.length} / {BODY_MAX_LENGTH}
										</span>
									</div>
								</div>

								{/* メール（任意） */}
								<div className="flex flex-col gap-2">
									<label htmlFor="feedback-email" className={FIELD_LABEL}>
										メールアドレス（任意）
									</label>
									<input
										id="feedback-email"
										type="email"
										value={data.email}
										onChange={(e) => setData('email', e.target.value)}
										placeholder="返信が必要な場合のみ"
										className={FIELD_CONTROL}
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

								<button
									type="submit"
									disabled={processing}
									className="flex items-center justify-center gap-2.5 self-start rounded-lg border border-[#E5C875] bg-linear-to-b from-[#E5C875] to-[#C9A961] px-8 py-3 text-[15px] font-extrabold text-[#0F2952] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
								>
									<MessageCircle className="h-[18px] w-[18px]" />
									送信する
								</button>
							</form>
						</main>
					)}
				</div>
			</div>
		</div>
	);
}
