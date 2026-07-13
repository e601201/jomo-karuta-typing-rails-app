import { Link } from '@inertiajs/react';
import type { AuthUser } from '@/types';

interface Props {
	user: AuthUser | null;
}

export default function Header({ user }: Props) {
	return (
		<nav aria-label="Global" className="sticky top-0 z-40 bg-green-100/30 backdrop-blur-md">
			<div className="mx-auto max-w-7xl px-8">
				<div className="flex h-16 items-center justify-between">
					<div className="flex">
						<Link href="/" className="-m-1.5 flex items-center p-1.5">
							<span className="sr-only">上毛かるたタイピング</span>
							<span className="ml-2 text-xl text-gray-600">上毛かるたタイピング</span>
						</Link>
					</div>
					<div className="flex justify-end">
						{user ? (
							<Link
								href="/profile"
								className="text-xl leading-6 font-semibold text-gray-900 hover:text-gray-600"
							>
								プロフィール
								<span aria-hidden="true">&rarr;</span>
							</Link>
						) : (
							<Link
								href="/auth/login"
								className="text-xl leading-6 font-semibold text-gray-900 hover:text-gray-600"
							>
								ログイン
								<span aria-hidden="true">&rarr;</span>
							</Link>
						)}
					</div>
				</div>
			</div>
		</nav>
	);
}
