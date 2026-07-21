import type { ReactNode } from 'react';
import { Head, usePage } from '@inertiajs/react';
import {
	BookOpen,
	CornerDownLeft,
	Delete,
	Eye,
	Gamepad2,
	Keyboard,
	Pause,
	Shuffle,
	SkipForward,
	Timer,
	Trophy
} from 'lucide-react';
import type { SharedProps } from '@/types';
import Header from '@/components/layout/Header';
import backgroundImage from '@/assets/images/background.webp';

const SERIF = { fontFamily: "'Noto Serif JP', serif" } as const;
const MONO = { fontFamily: "'JetBrains Mono', monospace" } as const;

// 旧 HowToPlayModal.tsx の置き換え（#10）。デザインは Profile / Ranking と同じダークデザイン。
// 本文の用語と規則は CONTEXT.md（撥音ルール / 短縮読み / ブラインド入力 / ライブスコア / 最終スコア /
// 開始カウントダウン / ランキング登録）を正典とする。挙動を変えたらこのページも直すこと。

function Section({
	icon,
	title,
	children
}: {
	icon: ReactNode;
	title: string;
	children: ReactNode;
}) {
	return (
		<section className="flex flex-col gap-3.5">
			<div className="flex items-center gap-2.5">
				<span className="h-6 w-1 rounded-sm bg-[#C8302A]" />
				<span className="text-[#E5C875]">{icon}</span>
				<h2 className="text-[22px] font-extrabold text-[#E5C875]">{title}</h2>
			</div>
			{children}
		</section>
	);
}

/** 罫線付きのカード。モード紹介・操作方法・ルールの共通の器。 */
function Card({ children }: { children: ReactNode }) {
	return (
		<div className="flex flex-col gap-2 rounded-[10px] border border-[#C9A961] bg-[#132D57] px-5 py-4">
			{children}
		</div>
	);
}

function Body({ children }: { children: ReactNode }) {
	return <p className="text-[15px] leading-[1.9] text-[#F5E9C8]">{children}</p>;
}

/** キーボードのキーを表す装飾。Esc / Enter などの打鍵対象に使う。 */
function Key({ children }: { children: ReactNode }) {
	return (
		<kbd
			className="mx-0.5 inline-block rounded border border-[#C9A961] bg-[#0F2952] px-2 py-0.5 text-[13px] font-bold text-[#E5C875]"
			style={MONO}
		>
			{children}
		</kbd>
	);
}

/** ローマ字の入力例。正誤を色で示す。 */
function Romaji({ children, bad = false }: { children: ReactNode; bad?: boolean }) {
	return (
		<span
			className={`font-bold ${bad ? 'text-[#E5453D] line-through' : 'text-[#7FD18B]'}`}
			style={MONO}
		>
			{children}
		</span>
	);
}

function Bullets({ items }: { items: ReactNode[] }) {
	return (
		<ul className="flex flex-col gap-2">
			{items.map((item, i) => (
				<li key={i} className="flex gap-2.5 text-[15px] leading-[1.9] text-[#F5E9C8]">
					<span aria-hidden="true" className="mt-[2px] shrink-0 text-[#C9A961]">
						・
					</span>
					<span className="min-w-0">{item}</span>
				</li>
			))}
		</ul>
	);
}

const RANDOM_DIFFICULTIES = [
	{
		name: '初心者',
		desc: '札ごとに用意された短縮読みが出題されます。まずはここから。'
	},
	{
		name: '標準',
		desc: '読み札がそのまま出題されます。'
	},
	{
		name: '上級者',
		desc: '未入力の部分が伏せ字で隠れるブラインド入力になります。困ったら Enter でヒントを出せます。'
	}
];

const CONTROLS = [
	{
		icon: Pause,
		key: 'Esc',
		title: '一時停止 / 再開',
		desc: '解除するとカウントダウンを挟んでから再開します。'
	},
	{
		icon: CornerDownLeft,
		key: 'Enter',
		title: 'ヒント表示（上級者のみ）',
		desc: '伏せ字になっている読み札の全文を2秒間だけ表示します。'
	},
	{
		icon: SkipForward,
		key: null,
		title: 'スキップ',
		desc: '画面下の「スキップ」ボタンで今の札を飛ばせます。タイムアタックでは10秒のペナルティが付きます。'
	},
	{
		icon: Delete,
		key: 'Backspace',
		title: '入力の削除',
		desc: '打ち間違えても消せます。削除してもコンボは途切れません。'
	}
];

export default function HowToPlay() {
	const { auth } = usePage().props as unknown as SharedProps;

	return (
		<div
			className="min-h-screen bg-cover bg-fixed bg-center"
			style={{ backgroundImage: `url(${backgroundImage})`, ...SERIF }}
		>
			<Head title="遊び方 - 上毛かるたタイピング" />

			<Header user={auth?.user ?? null} />

			<div className="p-8">
				<div className="mx-auto flex w-full max-w-[880px] flex-col gap-5">
					{/* ヒーロー */}
					<header className="flex flex-wrap items-center gap-4 rounded-[10px] border border-[#C9A961] bg-[#0A1A35CC] px-8 py-4">
						<div className="flex items-center gap-3">
							<span className="flex h-11 w-11 items-center justify-center rounded-full bg-[#C9A961]">
								<BookOpen className="h-[22px] w-[22px] text-[#0F2952]" />
							</span>
							<h1
								className="text-[32px] font-black text-white"
								style={{ textShadow: '0 2px 4px rgba(0,0,0,0.67)' }}
							>
								遊び方
							</h1>
						</div>
					</header>

					<main className="flex flex-col gap-9 rounded-[10px] border-2 border-[#C9A961] bg-[#0A1A35DD] px-9 py-8">
						<Section icon={<BookOpen className="h-5 w-5" />} title="上毛かるたタイピングとは">
							<Body>
								群馬名物「上毛かるた」全44札の読みを、ローマ字で打つタイピングゲームです。
								<br />
								楽しく遊びながら、かるたを覚えてタイピングも上達させましょう。
							</Body>
						</Section>

						<Section icon={<Gamepad2 className="h-5 w-5" />} title="ゲームモード">
							<Card>
								<div className="flex items-center gap-2.5">
									<Shuffle className="h-[18px] w-[18px] shrink-0 text-[#E5C875]" />
									<h3 className="text-lg font-extrabold text-[#F5E9C8]">ランダムモード</h3>
								</div>
								<Body>
									全44札がランダムな順序で出題されます。制限時間は60秒。難易度を3つから選べます。
								</Body>
								<div className="mt-1 flex flex-col gap-2.5">
									{RANDOM_DIFFICULTIES.map((d) => (
										<div key={d.name} className="flex flex-col gap-0.5">
											<span className="text-[13px] font-bold text-[#C9A961]">{d.name}</span>
											<span className="text-sm leading-[1.8] text-[#F5E9C8]">{d.desc}</span>
										</div>
									))}
								</div>
							</Card>

							<Card>
								<div className="flex items-center gap-2.5">
									<Timer className="h-[18px] w-[18px] shrink-0 text-[#E5C875]" />
									<h3 className="text-lg font-extrabold text-[#F5E9C8]">タイムアタック</h3>
								</div>
								<Body>
									10枚の札を打ち切るまでにかかった時間で競います。ミスをすると2秒、スキップすると10秒が
									タイムに加算されます。
								</Body>
							</Card>
						</Section>

						<Section icon={<Eye className="h-5 w-5" />} title="ゲームの進め方">
							<Bullets
								items={[
									'ホーム画面でゲームモードを選びます。ランダムモードでは続けて難易度を選びます。',
									'3・2・1 のカウントダウンと「スタート！」の合図（約3.8秒）のあとに始まります。',
									'画面中央に表示される読みを、ローマ字で入力してください。',
									'間違えた文字は赤く表示されます。削除しなくても、正しい文字を打ち直せばそのまま進みます。',
									'画面上部に「何枚目 / 全体」と残り時間が出ます。その下に正確率・コンボ・スコアが常時表示されます。',
									'終了すると、正解した札の枚数・正確率・WPM・最大コンボが結果画面に出ます。'
								]}
							/>
						</Section>

						<Section icon={<Keyboard className="h-5 w-5" />} title="操作方法">
							<div className="flex flex-col gap-3">
								{CONTROLS.map((c) => {
									const Icon = c.icon;
									return (
										<div
											key={c.title}
											className="flex items-start gap-4 rounded-[10px] border border-[#C9A961] bg-[#132D57] px-5 py-4"
										>
											<span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] border border-[#C9A961] bg-[#0F2952]">
												<Icon className="h-[18px] w-[18px] text-[#E5C875]" />
											</span>
											<div className="flex min-w-0 flex-1 flex-col gap-1">
												<span className="flex flex-wrap items-center gap-1.5 text-base font-bold text-[#F5E9C8]">
													{c.title}
													{c.key && <Key>{c.key}</Key>}
												</span>
												<span className="text-sm leading-[1.8] text-[#B8A874]">{c.desc}</span>
											</div>
										</div>
									);
								})}
							</div>
						</Section>

						<Section icon={<Keyboard className="h-5 w-5" />} title="タイピングルール">
							<Card>
								<h3 className="text-base font-extrabold text-[#F5E9C8]">複数の綴りが使えます</h3>
								<Bullets
									items={[
										<>画面に出ているローマ字以外の綴りでも正解になります。</>,
										<>
											「くさつ」は <Romaji>KUSATSU</Romaji> でも <Romaji>KUSATU</Romaji> でも可。
										</>,
										<>
											「まえばし」は <Romaji>MAEBASHI</Romaji> でも <Romaji>MAEBASI</Romaji>{' '}
											でも可。
										</>
									]}
								/>
							</Card>

							<Card>
								<h3 className="text-base font-extrabold text-[#F5E9C8]">「ん」の打ち方</h3>
								<Body>
									次の音が<strong className="text-[#E5C875]">母音・な行・や行</strong>のとき、および
									<strong className="text-[#E5C875]">読みの最後</strong>にあるときは{' '}
									<Romaji>nn</Romaji> と打ちます。それ以外は <Romaji>n</Romaji> ひとつでも{' '}
									<Romaji>nn</Romaji> でも構いません。
								</Body>
								<Bullets
									items={[
										<>
											な行の前 —「にほんの」は <Romaji>NIHONNNO</Romaji>（
											<Romaji bad>NIHONNO</Romaji> では通りません）。n が3つ続くので注意。
										</>,
										<>
											な行の前 —「あんなか」は <Romaji>ANNNAKA</Romaji>。
										</>,
										<>
											母音の前 —「たんい」は <Romaji>TANNI</Romaji>（<Romaji bad>TANI</Romaji>{' '}
											では「たに」になります）。
										</>,
										<>
											読みの最後 —「みかん」は <Romaji>MIKANN</Romaji>。
										</>,
										<>
											それ以外 —「ぐんま」は <Romaji>GUNMA</Romaji> でも <Romaji>GUNNMA</Romaji>{' '}
											でも可。
										</>
									]}
								/>
							</Card>

							<Card>
								<h3 className="text-base font-extrabold text-[#F5E9C8]">小さい「っ」の打ち方</h3>
								<Body>
									次の文字の最初のキーを2回続けて打ちます。「かっこう」は <Romaji>KAKKOU</Romaji>、
									「からっかぜ」は <Romaji>KARAKKAZE</Romaji> です。
								</Body>
							</Card>

							<Card>
								<h3 className="text-base font-extrabold text-[#F5E9C8]">読点「、」</h3>
								<Body>
									読みに含まれる「、」も入力対象です。<Key>,</Key> でも <Key>、</Key> でも打てます。
								</Body>
							</Card>
						</Section>

						<Section icon={<Trophy className="h-5 w-5" />} title="ランキング">
							<Bullets
								items={[
									'ゲーム終了後の画面から、好きなニックネームを付けてランキングに登録できます。',
									'登録は任意です。登録しなかったプレイは記録に残りません。',
									'ログインしていると、登録したスコアの中の自己最高がベストスコアとしてヘッダーに表示されます。'
								]}
							/>
						</Section>
					</main>
				</div>
			</div>
		</div>
	);
}
