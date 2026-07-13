import { useEffect, useState } from 'react';
import { X, Trophy, Send } from 'lucide-react';
import { saveScore } from '@/lib/api/scores';
import type { GameMode, RandomModeDifficulty } from '@/types';

interface Props {
	isOpen: boolean;
	score: number;
	difficulty?: RandomModeDifficulty;
	gameMode?: GameMode;
	time?: number;
	onClose: () => void;
	onSuccess?: (nickName: string) => void;
}

export default function RankingRegistrationModal({
	isOpen,
	score,
	difficulty = 'standard',
	gameMode,
	time,
	onClose,
	onSuccess
}: Props) {
	const [nickName, setNickName] = useState('');
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [success, setSuccess] = useState(false);
	const [isComposing, setIsComposing] = useState(false);

	// LocalStorageから前回の名前を取得
	useEffect(() => {
		if (isOpen && typeof window !== 'undefined') {
			const savedName = localStorage.getItem('lastNickName');
			if (savedName) {
				// eslint-disable-next-line react-hooks/set-state-in-effect -- モーダルを開くたびに LocalStorage（外部システム）から復元する
				setNickName(savedName);
			}
		}
	}, [isOpen]);

	async function handleSubmit() {
		if (loading) return;

		setLoading(true);
		setError(null);

		try {
			const nameToSave = nickName.trim() || '名無しの挑戦者';

			// ランキング対象モードはランダム/タイムアタックのみ。それ以外はランダム扱い
			const rankingMode: 'random' | 'timeattack' =
				gameMode === 'timeattack' ? 'timeattack' : 'random';

			// スコアを保存（ゲームモードと時間も含めて）
			const result = await saveScore(nameToSave, score, difficulty, rankingMode, time);

			if (result.success) {
				// 名前をLocalStorageに保存
				if (nickName.trim()) {
					localStorage.setItem('lastNickName', nickName.trim());
				}

				setSuccess(true);
				onSuccess?.(nameToSave);

				// 少し待ってから閉じる
				setTimeout(() => {
					onClose();
					// リセット
					setSuccess(false);
					setError(null);
				}, 2000);
			} else {
				setError(result.error || 'スコアの登録に失敗しました');
			}
		} catch (err) {
			setError('エラーが発生しました');
			console.error('Failed to save score:', err);
		} finally {
			setLoading(false);
		}
	}

	function handleKeydown(e: React.KeyboardEvent) {
		// IMEで変換中の場合はEnterキーで送信しない
		if (e.key === 'Enter' && !loading && !isComposing) {
			handleSubmit();
		}
		if (e.key === 'Escape') {
			onClose();
		}
	}

	function handleCompositionStart() {
		setIsComposing(true);
	}

	function handleCompositionEnd() {
		setIsComposing(false);
	}

	if (!isOpen) return null;

	return (
		<>
			{/* オーバーレイ */}
			<div
				className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
				onClick={(e) => {
					if (e.target === e.currentTarget) onClose();
				}}
				onKeyDown={(e) => {
					if (e.key === 'Escape') onClose();
				}}
				tabIndex={-1}
				role="dialog"
				aria-modal="true"
				aria-labelledby="ranking-modal-title"
			>
				{/* モーダル本体 */}
				<div className="animate-in fade-in zoom-in w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl duration-200">
					{/* ヘッダー */}
					<div className="mb-4 flex items-center justify-between">
						<h2
							id="ranking-modal-title"
							className="flex items-center gap-2 text-2xl font-bold text-gray-800"
						>
							<Trophy className="h-6 w-6 text-yellow-500" />
							ランキング登録
						</h2>
						<button
							onClick={onClose}
							className="rounded-lg p-2 text-gray-500 transition-colors hover:bg-gray-100"
							aria-label="閉じる"
						>
							<X className="h-5 w-5" />
						</button>
					</div>

					{success ? (
						/* 成功メッセージ */
						<div className="py-8 text-center">
							<div className="mb-4">
								<Trophy className="mx-auto h-16 w-16 animate-bounce text-yellow-500" />
							</div>
							<p className="mb-2 text-xl font-bold text-gray-800">登録完了！</p>
							<p className="text-gray-600">ランキングに登録されました</p>
						</div>
					) : (
						<>
							{/* スコア表示 */}
							<div className="mb-6 rounded-lg border border-yellow-200 bg-linear-to-r from-yellow-50 to-orange-50 p-4">
								<div className="flex items-center justify-between">
									<div>
										<p className="mb-1 text-sm text-gray-600">
											{gameMode === 'timeattack' ? 'クリアタイム' : 'あなたのスコア'}
										</p>
										<p className="bg-linear-to-r from-yellow-500 to-orange-500 bg-clip-text text-4xl font-bold text-transparent">
											{gameMode === 'timeattack' && time ? (
												<>
													{Math.floor(time / 1000)}.
													{String(Math.floor((time % 1000) / 10)).padStart(2, '0')}秒
												</>
											) : (
												score.toLocaleString()
											)}
										</p>
									</div>
									<div className="text-right">
										<p className="mb-1 text-sm text-gray-600">難易度</p>
										<p className="text-lg font-bold">
											{difficulty === 'beginner' ? (
												<span className="text-green-500">🔰 初心者</span>
											) : difficulty === 'advanced' ? (
												<span className="text-purple-500">🏆 上級者</span>
											) : (
												<span className="text-blue-500">📖 標準</span>
											)}
										</p>
									</div>
								</div>
							</div>

							{/* 入力フォーム */}
							<div className="space-y-4">
								<div>
									<label
										htmlFor="nickname"
										className="mb-2 block text-sm font-medium text-gray-700"
									>
										ニックネーム
									</label>
									<input
										id="nickname"
										type="text"
										value={nickName}
										onChange={(e) => setNickName(e.target.value)}
										placeholder="名無しの挑戦者"
										maxLength={20}
										disabled={loading}
										onCompositionStart={handleCompositionStart}
										onCompositionEnd={handleCompositionEnd}
										onKeyDown={handleKeydown}
										className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-gray-800 placeholder-gray-400 transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-200 focus:outline-none disabled:bg-gray-100 disabled:opacity-50"
									/>
									<p className="mt-1 text-xs text-gray-500">
										最大20文字・空欄の場合は「名無しの挑戦者」として登録されます
									</p>
								</div>

								{error && (
									<div className="rounded-lg border border-red-200 bg-red-50 p-3">
										<p className="text-sm text-red-600">{error}</p>
									</div>
								)}

								{/* ボタン */}
								<div className="flex gap-3">
									<button
										onClick={onClose}
										disabled={loading}
										className="flex-1 rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
									>
										キャンセル
									</button>
									<button
										onClick={handleSubmit}
										disabled={loading}
										className="flex flex-1 items-center justify-center rounded-lg bg-linear-to-r from-yellow-500 to-orange-500 px-4 py-2 font-bold text-white transition-all hover:from-yellow-600 hover:to-orange-600 disabled:cursor-not-allowed disabled:opacity-50"
									>
										{loading ? (
											<>
												<span className="mr-2 inline-block h-4 w-4 animate-spin rounded-full border-b-2 border-white"></span>
												登録中...
											</>
										) : (
											<>
												<Send className="mr-2 h-4 w-4" />
												登録する
											</>
										)}
									</button>
								</div>
							</div>
						</>
					)}
				</div>
			</div>
			<style>{`
				@keyframes fade-in {
					from {
						opacity: 0;
					}
					to {
						opacity: 1;
					}
				}

				@keyframes zoom-in {
					from {
						transform: scale(0.95);
					}
					to {
						transform: scale(1);
					}
				}

				.animate-in {
					animation:
						fade-in 0.2s ease-out,
						zoom-in 0.2s ease-out;
				}
			`}</style>
		</>
	);
}
