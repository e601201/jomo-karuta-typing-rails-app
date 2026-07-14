import { Link } from '@inertiajs/react';
import type { AuthUser } from '@/types';

interface Props {
	user: AuthUser | null;
}

export default function Header({ user }: Props) {
	return (
		<nav aria-label="Global" className="backdrop-blur-md">
			<div className="mx-auto max-w-7xl px-8">
				<div className="flex h-16 items-center justify-between">
					<div className="flex">
						<Link href="/" className="-m-1.5 flex items-center p-1.5">
							<span className="sr-only">上毛かるたタイピング</span>
							<span className="ml-2 text-xl text-gray-100">上毛かるたタイピング</span>
						</Link>
					</div>
					<div className="flex justify-end">
						{user ? (
							<Link href="/profile" className="-m-1.5 flex items-center p-1.5">
								<span className="sr-only">プロフィール</span>
								{user.avatar_url ? (
									<img
										src={user.avatar_url}
										alt="プロフィール"
										className="h-10 w-10 rounded-full object-cover ring-1 ring-gray-300 hover:ring-2 hover:ring-gray-400"
									/>
								) : (
									<span className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-300 text-lg font-semibold text-gray-700 ring-1 ring-gray-300 hover:ring-2 hover:ring-gray-400">
										{(user.nickname ?? user.email).charAt(0).toUpperCase()}
									</span>
								)}
							</Link>
						) : (
							<Link
								href="/auth/login"
								className="text-xl leading-6 font-semibold text-gray-100 hover:text-gray-300"
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
