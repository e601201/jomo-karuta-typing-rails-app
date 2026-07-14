import type { GameMode } from '@/types';

interface Props {
	mode: GameMode;
	title: string;
	description: string;
	image: string;
	disabled?: boolean;
	onclick: (mode: GameMode) => void;
}

export default function GameModeCard({
	mode,
	title,
	description,
	image,
	disabled = false,
	onclick
}: Props) {
	return (
		<button
			onClick={() => onclick(mode)}
			disabled={disabled}
			className="group min-h-[44px] w-full transform transition-all hover:-translate-y-1 disabled:cursor-not-allowed disabled:opacity-50"
			aria-label={title}
			aria-describedby={`${mode}-description`}
		>
			<img
				src={image}
				alt=""
				className="h-auto w-full drop-shadow-lg transition-all group-hover:drop-shadow-xl"
			/>
			<p id={`${mode}-description`} className="sr-only">
				{description}
			</p>
		</button>
	);
}
