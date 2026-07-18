import { useEffect, useId, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import type { LucideIcon } from 'lucide-react';

const JP_FONT = { fontFamily: "'Noto Serif JP', serif" } as const;

interface Props {
	/** 見出しとボタンの両方に使うアイコン */
	icon: LucideIcon;
	title: string;
	/** 実行ボタンのラベル（「ログアウト」「破棄する」など） */
	confirmLabel: string;
	onConfirm: () => void;
	onCancel: () => void;
	/** 補足文。取り消せない操作など、見出しだけで足りないときに添える */
	description?: ReactNode;
	cancelLabel?: string;
}

/**
 * 破壊的な操作の確認モーダル。
 * 呼び出し側で表示・非表示を出し分ける（このコンポーネントは常に描画される前提）。
 */
export default function ConfirmModal({
	icon: Icon,
	title,
	confirmLabel,
	onConfirm,
	onCancel,
	description,
	cancelLabel = 'キャンセル'
}: Props) {
	const titleId = useId();

	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			if (e.key === 'Escape') onCancel();
		};
		document.addEventListener('keydown', onKey);
		return () => document.removeEventListener('keydown', onKey);
	}, [onCancel]);

	if (typeof document === 'undefined') return null;

	return createPortal(
		<div
			className="fixed inset-0 z-1000 flex items-center justify-center bg-black/60 p-4"
			role="dialog"
			aria-modal="true"
			aria-labelledby={titleId}
			onClick={(e) => {
				if (e.target === e.currentTarget) onCancel();
			}}
		>
			<div
				className="flex w-full max-w-[400px] flex-col gap-5 rounded-[14px] border-2 border-[#C9A961] bg-[#0F2145] px-8 py-7 shadow-[0_8px_32px_rgba(0,0,0,0.5)]"
				style={JP_FONT}
			>
				<div className="flex flex-col items-center gap-3 text-center">
					<span className="flex h-12 w-12 items-center justify-center rounded-full border border-[#E5453D] bg-[#7A1E1B]/30">
						<Icon size={22} className="text-[#E5453D]" aria-hidden="true" />
					</span>
					<h2 id={titleId} className="text-xl font-black text-[#E5C875]">
						{title}
					</h2>
					{description && <p className="text-sm leading-relaxed text-[#F5E9C8]">{description}</p>}
				</div>
				<div className="flex gap-3">
					<button
						type="button"
						onClick={onCancel}
						className="flex-1 rounded-lg border border-[#C9A961] px-4 py-3 text-sm font-bold text-[#F5E9C8] transition-colors hover:bg-[#132D57]"
					>
						{cancelLabel}
					</button>
					<button
						type="button"
						onClick={onConfirm}
						className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-[#E5453D] bg-linear-to-b from-[#C8302A] to-[#7A1E1B] px-4 py-3 text-sm font-extrabold text-white shadow-[0_2px_8px_#7A1E1B66] transition-opacity hover:opacity-90"
					>
						<Icon size={16} aria-hidden="true" />
						{confirmLabel}
					</button>
				</div>
			</div>
		</div>,
		document.body
	);
}
