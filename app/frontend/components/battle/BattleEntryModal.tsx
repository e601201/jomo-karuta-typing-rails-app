import { ChevronRight, KeyRound, LogIn, X } from 'lucide-react';

interface Props {
	show: boolean;
	onClose: () => void;
	/** どちらの選択肢も合言葉フォームへ進む（マッチングは join-or-create 一本のため動作は同じ） */
	onSelect: () => void;
}

const options = [
	{
		key: 'create',
		icon: KeyRound,
		title: '合言葉を設定',
		description: '部屋を作って友達を招待',
		sub: '好きな合言葉を決めて、相手に伝えよう',
		accentClass: 'border-[#3FB56B] text-[#3FB56B]',
		iconBoxClass: 'border-[#3FB56B] bg-[#3FB56B]/20 text-[#3FB56B]'
	},
	{
		key: 'join',
		icon: LogIn,
		title: '合言葉を入れる',
		description: '相手の部屋に参加',
		sub: '教えてもらった合言葉を入力して参加',
		accentClass: 'border-[#5A8FE5] text-[#5A8FE5]',
		iconBoxClass: 'border-[#5A8FE5] bg-[#5A8FE5]/20 text-[#5A8FE5]'
	}
] as const;

export default function BattleEntryModal({ show, onClose, onSelect }: Props) {
	function handleBackdropClick(e: React.MouseEvent) {
		if (e.target === e.currentTarget) {
			onClose();
		}
	}

	if (!show) return null;

	return (
		<div
			data-testid="battle-entry-modal"
			className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
			onClick={handleBackdropClick}
		>
			<div
				className="flex w-full max-w-140 flex-col gap-5.5 rounded-[14px] border-2 border-[#C9A961] bg-[#0F2145] px-10 py-9 shadow-[0_8px_32px_rgba(0,0,0,0.4)]"
				style={{ fontFamily: "'Noto Serif JP', serif" }}
			>
				<div className="flex flex-col items-center gap-1.5">
					<h2 className="text-[26px] font-black text-[#E5C875]">対戦モード</h2>
					<div className="flex items-center gap-2">
						<span className="h-px w-10 bg-[#C9A961]/50" />
						<span className="text-[10px] text-[#C9A961]">◆</span>
						<span className="h-px w-10 bg-[#C9A961]/50" />
					</div>
				</div>

				{options.map((option) => (
					<button
						key={option.key}
						onClick={onSelect}
						className={`flex w-full items-center gap-4 rounded-[10px] border bg-[#132D57] px-5 py-[18px] text-left transition-colors hover:bg-[#1A3868] ${option.accentClass}`}
					>
						<span
							className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-[10px] border ${option.iconBoxClass}`}
						>
							<option.icon className="h-6 w-6" />
						</span>
						<span className="flex min-w-0 flex-1 flex-col gap-1">
							<span className="text-lg font-extrabold text-[#F5E9C8]">{option.title}</span>
							<span className="text-[13px] font-medium text-[#B8A874]">{option.description}</span>
							<span className="text-xs text-[#B8A874]">{option.sub}</span>
						</span>
						<ChevronRight className="h-5 w-5 shrink-0" />
					</button>
				))}

				<div className="h-px w-full bg-[#C9A961]/30" />

				<button
					onClick={onClose}
					className="flex w-full items-center justify-center gap-2 rounded-lg border border-[#C9A961] bg-[#0A1A35]/60 px-5 py-3 text-[15px] font-semibold text-[#B8A874] transition-colors hover:bg-[#0A1A35] hover:text-[#E5C875]"
				>
					<X className="h-4 w-4" />
					キャンセル
				</button>
			</div>
		</div>
	);
}
