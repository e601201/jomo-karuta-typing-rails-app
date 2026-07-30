import { User, UserRound } from 'lucide-react';

const SERIF = { fontFamily: "'Noto Serif JP', serif" } as const;

interface Props {
	myTaken: number;
	opponentTaken: number;
	opponentLeft?: boolean;
}

/** 対戦中の取得札カウンター（あなた vs 相手）。相手の枚数はリアルタイムに更新される */
export default function OpponentProgress({ myTaken, opponentTaken, opponentLeft = false }: Props) {
	return (
		<div
			data-testid="opponent-progress"
			className="mb-6 flex items-center justify-center gap-4 rounded-lg border border-[#C9A961] bg-[#0A1A35]/80 px-6 py-4 shadow-lg"
		>
			<div className="flex flex-1 items-center justify-end gap-3">
				<span
					className="flex items-center gap-2 text-[15px] font-bold text-[#F5E9C8]"
					style={SERIF}
				>
					<User className="h-4 w-4 text-[#3FB56B]" />
					あなた
				</span>
				<span className="text-sm text-[#B8A874]" style={SERIF}>
					取得札
				</span>
				<span
					data-testid="my-taken"
					className="text-2xl font-extrabold text-[#E5C875] tabular-nums"
					style={SERIF}
				>
					{myTaken}
				</span>
				<span className="text-sm text-[#B8A874]" style={SERIF}>
					枚
				</span>
			</div>
			<span className="text-lg font-black text-[#C8302A]" style={SERIF}>
				VS
			</span>
			<div className="flex flex-1 items-center justify-start gap-3">
				<span
					className="flex items-center gap-2 text-[15px] font-bold text-[#B8A874]"
					style={SERIF}
				>
					<UserRound className="h-4 w-4" />
					相手
				</span>
				<span className="text-sm text-[#B8A874]" style={SERIF}>
					取得札
				</span>
				<span
					data-testid="opponent-taken"
					className="text-2xl font-extrabold text-[#F5E9C8] tabular-nums"
					style={SERIF}
				>
					{opponentTaken}
				</span>
				<span className="text-sm text-[#B8A874]" style={SERIF}>
					枚
				</span>
				{opponentLeft && (
					<span className="text-xs font-semibold text-[#E5453D]" style={SERIF}>
						（退出）
					</span>
				)}
			</div>
		</div>
	);
}
