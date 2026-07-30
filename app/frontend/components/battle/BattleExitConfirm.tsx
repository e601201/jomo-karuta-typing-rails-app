const SERIF = { fontFamily: "'Noto Serif JP', serif" } as const;

interface Props {
	show: boolean;
	onConfirm: () => void;
	onCancel: () => void;
}

/** 対戦中の退出確認。表示中も自分のタイマーは止まらない（ポーズ代わりの悪用防止） */
export default function BattleExitConfirm({ show, onConfirm, onCancel }: Props) {
	if (!show) return null;

	return (
		<div
			data-testid="battle-exit-confirm"
			className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
		>
			<div className="mx-4 rounded-xl border border-[#C9A961] bg-[#0A1A35] p-8 text-center shadow-2xl">
				<h2 className="mb-2 text-xl font-bold text-[#F5E9C8]" style={SERIF}>
					対戦から退出しますか？
				</h2>
				<p className="mb-6 text-sm text-[#B8A874]" style={SERIF}>
					退出すると相手の勝ちになります（対戦中の時間は進み続けます）
				</p>
				<div className="flex justify-center gap-4">
					<button
						onClick={onConfirm}
						className="rounded-lg border border-[#E5453D] bg-[#C8302A] px-8 py-2.5 font-semibold text-white transition-colors hover:bg-[#A8261F]"
						style={SERIF}
					>
						退出する
					</button>
					<button
						onClick={onCancel}
						className="rounded-lg border border-[#5A6472] bg-[#3A4552] px-8 py-2.5 font-semibold text-white transition-colors hover:bg-[#4A5562]"
						style={SERIF}
					>
						続ける
					</button>
				</div>
			</div>
		</div>
	);
}
