import type { GameMode } from '@/types';

interface Props {
	mode: GameMode;
	title: string;
	description: string;
	disabled?: boolean;
	onclick: (mode: GameMode) => void;
}

export default function GameModeCard({
	mode,
	title,
	description,
	disabled = false,
	onclick
}: Props) {
	return (
		<button
			onClick={() => onclick(mode)}
			disabled={disabled}
			className="group min-h-[44px] w-full transform rounded-xl border-3 border-green-400 bg-white p-5 text-left shadow-lg transition-all hover:-translate-y-1 hover:border-green-600 hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-50"
			aria-label={title}
			aria-describedby={`${mode}-description`}
		>
			<h2 className="mb-1 text-xl font-bold text-gray-800">{title}</h2>
			<p id={`${mode}-description`} className="text-gray-600">
				{description}
			</p>
		</button>
	);
}
