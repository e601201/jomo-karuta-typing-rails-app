interface Props {
	message?: string;
}

export default function LoadingSpinner({ message = '読み込み中...' }: Props) {
	return (
		<div className="flex min-h-[400px] flex-col items-center justify-center">
			<div
				data-testid="loading-spinner"
				className="h-12 w-12 animate-spin rounded-full border-b-2 border-green-600"
				role="status"
				aria-label="Loading"
			></div>
			<p className="mt-4 text-gray-600">{message}</p>
		</div>
	);
}
