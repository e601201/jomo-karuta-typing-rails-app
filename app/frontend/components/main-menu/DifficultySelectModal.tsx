import { BookOpen, ChevronRight, Leaf, X, Zap } from 'lucide-react';
import type { RandomModeDifficulty } from '@/types';

interface Props {
	show: boolean;
	onClose: () => void;
	onSelect: (difficulty: RandomModeDifficulty) => void;
}

interface DifficultyOption {
	difficulty: RandomModeDifficulty;
	title: string;
	description: string;
	sub: string;
	icon: typeof Leaf;
	accentClass: string;
	iconBoxClass: string;
	subClass: string;
}

const difficultyOptions: DifficultyOption[] = [
	{
		difficulty: 'beginner',
		title: '初心者モード',
		description: 'キーワードで練習',
		sub: '短い読み札（5〜10文字程度）',
		icon: Leaf,
		accentClass: 'border-[#3FB56B] text-[#3FB56B]',
		iconBoxClass: 'border-[#3FB56B] bg-[#3FB56B]/20 text-[#3FB56B]',
		subClass: 'text-[#B8A874]'
	},
	{
		difficulty: 'standard',
		title: '標準モード',
		description: 'すべての読み札',
		sub: '通常の読み札（13〜19文字）',
		icon: BookOpen,
		accentClass: 'border-[#5A8FE5] text-[#5A8FE5]',
		iconBoxClass: 'border-[#5A8FE5] bg-[#5A8FE5]/20 text-[#5A8FE5]',
		subClass: 'text-[#B8A874]'
	},
	{
		difficulty: 'advanced',
		title: '上級者モード',
		description: '競技かるた式',
		sub: '取り札のみ表示・読み札の暗記必須',
		icon: Zap,
		accentClass: 'border-[#C8302A] text-[#C8302A]',
		iconBoxClass: 'border-[#C8302A] bg-black text-[#C8302A]',
		subClass: 'font-bold text-[#C8302A]'
	}
];

export default function DifficultySelectModal({ show, onClose, onSelect }: Props) {
	function handleSelect(difficulty: RandomModeDifficulty) {
		onSelect(difficulty);
		onClose();
	}

	function handleBackdropClick(e: React.MouseEvent) {
		if (e.target === e.currentTarget) {
			onClose();
		}
	}

	if (!show) return null;

	return (
		<>
			<div
				className="animate-fadeIn fixed inset-0 z-50 flex items-center justify-center p-4"
				onClick={handleBackdropClick}
			>
				<div
					className="animate-scaleIn flex w-full max-w-140 flex-col gap-5.5 rounded-[14px] border-2 border-[#C9A961] bg-[#0F2145] px-10 py-9 shadow-[0_8px_32px_rgba(0,0,0,0.4)]"
					style={{ fontFamily: "'Noto Serif JP', serif" }}
				>
					<div className="flex flex-col items-center gap-1.5">
						<h2 className="text-[26px] font-black text-[#E5C875]">難易度を選択</h2>
						<div className="flex items-center gap-2">
							<span className="h-px w-10 bg-[#C9A961]/50" />
							<span className="text-[10px] text-[#C9A961]">◆</span>
							<span className="h-px w-10 bg-[#C9A961]/50" />
						</div>
					</div>

					{difficultyOptions.map((option) => (
						<button
							key={option.difficulty}
							onClick={() => handleSelect(option.difficulty)}
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
								<span className={`text-xs ${option.subClass}`}>{option.sub}</span>
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
			<style>{`
				@keyframes fadeIn {
					from {
						opacity: 0;
					}
					to {
						opacity: 1;
					}
				}

				@keyframes scaleIn {
					from {
						transform: scale(0.9);
						opacity: 0;
					}
					to {
						transform: scale(1);
						opacity: 1;
					}
				}

				.animate-fadeIn {
					animation: fadeIn 0.2s ease-out;
				}

				.animate-scaleIn {
					animation: scaleIn 0.2s ease-out;
				}
			`}</style>
		</>
	);
}
