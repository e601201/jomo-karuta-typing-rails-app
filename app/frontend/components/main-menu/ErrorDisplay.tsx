interface Props {
	error: string;
	onretry: () => void;
}

export default function ErrorDisplay({ error, onretry }: Props) {
	return (
		<div className="mx-auto max-w-md rounded-lg border border-red-200 bg-red-50 p-6 text-center">
			<p className="mb-4 text-red-600">{error}</p>
			<button
				onClick={onretry}
				className="rounded-lg bg-red-600 px-6 py-2 text-white transition-colors hover:bg-red-700"
			>
				再試行
			</button>
		</div>
	);
}
