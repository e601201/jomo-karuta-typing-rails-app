import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import BattleResult from './BattleResult';
import type { BattleStats } from '@/types/battle';

function stats(overrides: Partial<BattleStats> = {}): BattleStats {
	return {
		score: null,
		timeMs: null,
		taken: 0,
		accuracy: 100,
		wpm: 60,
		maxCombo: 5,
		...overrides
	};
}

describe('BattleResult', () => {
	const onRematch = vi.fn();
	const onGoHome = vi.fn();

	beforeEach(() => {
		onRematch.mockClear();
		onGoHome.mockClear();
	});

	it('ランダムモードの勝ちを表示する（両者のスコアと取得札）', () => {
		render(
			<BattleResult
				mode="random"
				outcome="win"
				myStats={stats({ score: 8450, taken: 12, accuracy: 96.8, wpm: 72, maxCombo: 18 })}
				opponentStats={stats({ score: 6920, taken: 9 })}
				opponentLeft={false}
				onRematch={onRematch}
				onGoHome={onGoHome}
			/>
		);

		expect(screen.getByText('あなたの勝ち！')).toBeInTheDocument();
		expect(screen.getByText('8,450')).toBeInTheDocument();
		expect(screen.getByText('6,920')).toBeInTheDocument();
		expect(screen.getByText('取得札 12枚')).toBeInTheDocument();
		expect(screen.getByText('取得札 9枚')).toBeInTheDocument();
		expect(screen.getByText('96.80%')).toBeInTheDocument();
	});

	it('タイムアタックモードは取得札数を主表示にし、タイムを添える', () => {
		render(
			<BattleResult
				mode="timeattack"
				outcome="lose"
				myStats={stats({ timeMs: 58320, taken: 7 })}
				opponentStats={stats({ timeMs: 51000, taken: 10 })}
				opponentLeft={false}
				onRematch={onRematch}
				onGoHome={onGoHome}
			/>
		);

		expect(screen.getByText('あなたの負け…')).toBeInTheDocument();
		expect(screen.getByText('タイム 58.32秒')).toBeInTheDocument();
	});

	it('引き分けを表示する', () => {
		render(
			<BattleResult
				mode="random"
				outcome="draw"
				myStats={stats({ score: 500 })}
				opponentStats={stats({ score: 500 })}
				opponentLeft={false}
				onRematch={onRematch}
				onGoHome={onGoHome}
			/>
		);

		expect(screen.getByText('引き分け')).toBeInTheDocument();
	});

	it('不戦勝（相手の退出）を表示する', () => {
		render(
			<BattleResult
				mode="random"
				outcome="walkover"
				myStats={stats({ score: 500 })}
				opponentStats={null}
				opponentLeft={true}
				onRematch={onRematch}
				onGoHome={onGoHome}
			/>
		);

		expect(screen.getByText('あなたの勝ち！（不戦勝）')).toBeInTheDocument();
		expect(screen.getByText('（退出）')).toBeInTheDocument();
	});

	it('未決着の間は「相手の結果を待っています…」を表示し再戦できない', () => {
		render(
			<BattleResult
				mode="random"
				outcome={null}
				myStats={stats({ score: 500 })}
				opponentStats={null}
				opponentLeft={false}
				onRematch={onRematch}
				onGoHome={onGoHome}
			/>
		);

		expect(screen.getByText('相手の結果を待っています…')).toBeInTheDocument();
		const rematch = screen.getByRole('button', { name: /もう一度対戦する/ });
		expect(rematch).toBeDisabled();
	});

	it('もう一度対戦する / メインメニューに戻る のハンドラを呼ぶ', () => {
		render(
			<BattleResult
				mode="random"
				outcome="win"
				myStats={stats({ score: 500 })}
				opponentStats={stats({ score: 100 })}
				opponentLeft={false}
				onRematch={onRematch}
				onGoHome={onGoHome}
			/>
		);

		fireEvent.click(screen.getByRole('button', { name: /もう一度対戦する/ }));
		expect(onRematch).toHaveBeenCalled();

		fireEvent.click(screen.getByRole('button', { name: /メインメニューに戻る/ }));
		expect(onGoHome).toHaveBeenCalled();
	});
});
