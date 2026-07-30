import { useState } from 'react';
import { KeyRound, Swords, X } from 'lucide-react';

interface Props {
	show: boolean;
	onClose: () => void;
	onSubmit: (passphrase: string) => void;
	/** マッチング開始に失敗したときのエラーメッセージ */
	error?: string | null;
}

export const PASSPHRASE_MAX_LENGTH = 20;

export default function PassphraseModal({ show, onClose, onSubmit, error }: Props) {
	const [passphrase, setPassphrase] = useState('');

	const trimmed = passphrase.trim();
	const canSubmit = trimmed.length > 0 && trimmed.length <= PASSPHRASE_MAX_LENGTH;

	function handleSubmit(e: React.FormEvent) {
		e.preventDefault();
		if (!canSubmit) return;
		onSubmit(trimmed);
	}

	function handleBackdropClick(e: React.MouseEvent) {
		if (e.target === e.currentTarget) {
			onClose();
		}
	}

	if (!show) return null;

	return (
		<div
			data-testid="passphrase-modal"
			className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
			onClick={handleBackdropClick}
		>
			<form
				onSubmit={handleSubmit}
				className="flex w-full max-w-140 flex-col gap-5.5 rounded-[14px] border-2 border-[#C9A961] bg-[#0F2145] px-10 py-9 shadow-[0_8px_32px_rgba(0,0,0,0.4)]"
				style={{ fontFamily: "'Noto Serif JP', serif" }}
			>
				<div className="flex flex-col items-center gap-1.5">
					<h2 className="text-[26px] font-black text-[#E5C875]">合言葉を入力</h2>
					<div className="flex items-center gap-2">
						<span className="h-px w-10 bg-[#C9A961]/50" />
						<span className="text-[10px] text-[#C9A961]">◆</span>
						<span className="h-px w-10 bg-[#C9A961]/50" />
					</div>
				</div>

				<label className="flex flex-col gap-2">
					<span className="text-sm font-semibold text-[#B8A874]">合言葉</span>
					<span className="flex items-center gap-3 rounded-[10px] border border-[#C9A961]/60 bg-[#132D57] px-4 py-3 focus-within:border-[#E5C875]">
						<KeyRound className="h-5 w-5 shrink-0 text-[#C9A961]" />
						<input
							type="text"
							value={passphrase}
							onChange={(e) => setPassphrase(e.target.value)}
							maxLength={PASSPHRASE_MAX_LENGTH}
							placeholder="ぐんまちゃん"
							autoFocus
							className="w-full bg-transparent text-lg text-[#F5E9C8] outline-none placeholder:text-[#B8A874]/40"
						/>
					</span>
				</label>

				<p className="text-[13px] leading-relaxed text-[#B8A874]">
					部屋を作るときは好きな合言葉を、参加するときは相手から聞いた合言葉を入力してください
				</p>

				{error && (
					<p role="alert" className="text-sm font-semibold text-[#E06A5A]">
						{error}
					</p>
				)}

				<button
					type="submit"
					disabled={!canSubmit}
					className="flex w-full items-center justify-center gap-2 rounded-lg border border-[#E5C875] bg-gradient-to-r from-[#C9A961] to-[#E5A83C] px-5 py-3.5 text-[16px] font-bold text-[#241A05] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
				>
					<Swords className="h-5 w-5" />
					マッチングを開始
				</button>

				<button
					type="button"
					onClick={onClose}
					className="flex w-full items-center justify-center gap-2 rounded-lg border border-[#C9A961] bg-[#0A1A35]/60 px-5 py-3 text-[15px] font-semibold text-[#B8A874] transition-colors hover:bg-[#0A1A35] hover:text-[#E5C875]"
				>
					<X className="h-4 w-4" />
					戻る
				</button>
			</form>
		</div>
	);
}
