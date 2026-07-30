import { KeyRound, LoaderCircle, User, UserRound, X } from 'lucide-react';

interface Props {
	show: boolean;
	passphrase: string;
	onCancel: () => void;
}

export default function MatchingModal({ show, passphrase, onCancel }: Props) {
	if (!show) return null;

	return (
		<div
			data-testid="matching-modal"
			className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
		>
			<div
				className="flex w-full max-w-140 flex-col items-center gap-5.5 rounded-[14px] border-2 border-[#C9A961] bg-[#0F2145] px-10 py-9 shadow-[0_8px_32px_rgba(0,0,0,0.4)]"
				style={{ fontFamily: "'Noto Serif JP', serif" }}
			>
				<div className="flex flex-col items-center gap-1.5">
					<h2 className="text-[26px] font-black text-[#E5C875]">マッチング中</h2>
					<div className="flex items-center gap-2">
						<span className="h-px w-10 bg-[#C9A961]/50" />
						<span className="text-[10px] text-[#C9A961]">◆</span>
						<span className="h-px w-10 bg-[#C9A961]/50" />
					</div>
				</div>

				<LoaderCircle className="h-10 w-10 animate-spin text-[#E5C875]" />

				<p className="text-[15px] font-semibold text-[#F5E9C8]">相手の参加を待っています…</p>

				<div className="flex items-center gap-2 rounded-lg border border-[#C9A961]/60 bg-[#132D57] px-4 py-2">
					<KeyRound className="h-4 w-4 text-[#C9A961]" />
					<span className="text-[15px] font-bold text-[#E5C875]">合言葉：{passphrase}</span>
				</div>

				<p className="text-[13px] text-[#B8A874]">同じ合言葉を入力した相手とマッチングします</p>

				<div className="flex w-full items-center justify-center gap-4">
					<div className="flex flex-1 flex-col items-center gap-1 rounded-[10px] border border-[#3FB56B] bg-[#132D57] px-5 py-4">
						<span className="flex items-center gap-2 text-[15px] font-bold text-[#F5E9C8]">
							<User className="h-4 w-4" />
							あなた
						</span>
						<span className="text-xs font-semibold text-[#3FB56B]">準備完了</span>
					</div>
					<span className="text-lg font-black text-[#C8302A]">VS</span>
					<div className="flex flex-1 flex-col items-center gap-1 rounded-[10px] border border-[#C9A961]/40 bg-[#132D57] px-5 py-4">
						<span className="flex items-center gap-2 text-[15px] font-bold text-[#B8A874]">
							<UserRound className="h-4 w-4" />
							相手
						</span>
						<span className="text-xs text-[#B8A874]">待機中…</span>
					</div>
				</div>

				<button
					onClick={onCancel}
					className="flex w-full items-center justify-center gap-2 rounded-lg border border-[#C9A961] bg-[#0A1A35]/60 px-5 py-3 text-[15px] font-semibold text-[#B8A874] transition-colors hover:bg-[#0A1A35] hover:text-[#E5C875]"
				>
					<X className="h-4 w-4" />
					マッチングをやめる
				</button>
			</div>
		</div>
	);
}
