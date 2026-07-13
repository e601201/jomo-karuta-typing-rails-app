import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import PauseOverlay from './PauseOverlay';

describe('PauseOverlay Component', () => {
	const mockOnResume = vi.fn();
	const mockOnExit = vi.fn();
	const mockOnSettings = vi.fn();

	const defaultGameStats = {
		currentCard: 5,
		totalCards: 44,
		elapsedTime: 30000,
		pauseCount: 2,
		score: 1500,
		accuracy: 95.5
	};

	beforeEach(() => {
		mockOnResume.mockClear();
		mockOnExit.mockClear();
		mockOnSettings.mockClear();
	});

	describe('Display Tests', () => {
		it('TC-011: should display overlay when paused', () => {
			render(
				<PauseOverlay
					isPaused={true}
					gameStats={defaultGameStats}
					onResume={mockOnResume}
					onExit={mockOnExit}
				/>
			);

			const overlay = screen.getByTestId('pause-overlay');
			expect(overlay).toBeInTheDocument();
			expect(overlay).toHaveClass('bg-black', 'bg-opacity-70');

			const modal = screen.getByTestId('pause-modal');
			expect(modal).toBeInTheDocument();
			expect(modal).toHaveClass('bg-white', 'rounded-2xl');
		});

		it('should not display when not paused', () => {
			render(
				<PauseOverlay
					isPaused={false}
					gameStats={defaultGameStats}
					onResume={mockOnResume}
					onExit={mockOnExit}
				/>
			);

			expect(screen.queryByTestId('pause-overlay')).not.toBeInTheDocument();
		});

		it('TC-012: should display game statistics', () => {
			render(
				<PauseOverlay
					isPaused={true}
					gameStats={defaultGameStats}
					onResume={mockOnResume}
					onExit={mockOnExit}
				/>
			);

			expect(screen.getByText('一時停止中')).toBeInTheDocument();
			expect(screen.getByText('5/44枚完了')).toBeInTheDocument();
			expect(screen.getByText('00:30')).toBeInTheDocument(); // 30秒
			expect(screen.getByText('スコア: 1500')).toBeInTheDocument();
			// 正確率は小数2桁で表示
			expect(screen.getByText('正確率: 95.50%')).toBeInTheDocument();
			expect(screen.getByText('一時停止回数: 2回')).toBeInTheDocument();
		});
	});

	describe('Resume Functionality', () => {
		it('TC-003: should handle resume button click', async () => {
			// カウントダウン無しの場合は即時再開する
			render(
				<PauseOverlay
					isPaused={true}
					gameStats={defaultGameStats}
					onResume={mockOnResume}
					onExit={mockOnExit}
					showCountdown={false}
				/>
			);

			const resumeButton = screen.getByText('再開');
			fireEvent.click(resumeButton);

			expect(mockOnResume).toHaveBeenCalled();
		});

		it('TC-003b: should start countdown (not immediate resume) when countdown enabled', async () => {
			render(
				<PauseOverlay
					isPaused={true}
					gameStats={defaultGameStats}
					onResume={mockOnResume}
					onExit={mockOnExit}
					showCountdown={true}
				/>
			);

			fireEvent.click(screen.getByText('再開'));

			// 再開ボタンはカウントダウン演出を開始し、まだ onResume は呼ばれない
			expect(screen.getByTestId('countdown-display')).toBeInTheDocument();
			expect(mockOnResume).not.toHaveBeenCalled();
		});

		it('TC-013: should show countdown when resuming', async () => {
			render(
				<PauseOverlay
					isPaused={true}
					gameStats={defaultGameStats}
					onResume={mockOnResume}
					onExit={mockOnExit}
					showCountdown={true}
					countdownDuration={3}
				/>
			);

			const resumeButton = screen.getByText('再開');
			fireEvent.click(resumeButton);

			// Should show countdown
			expect(screen.getByTestId('countdown-display')).toBeInTheDocument();
			expect(screen.getByText('3')).toBeInTheDocument();

			// Simulate countdown
			await waitFor(() => expect(screen.getByText('2')).toBeInTheDocument(), {
				timeout: 1500
			});
			await waitFor(() => expect(screen.getByText('1')).toBeInTheDocument(), {
				timeout: 2500
			});
		});

		it('TC-015: should skip countdown on space key', async () => {
			render(
				<PauseOverlay
					isPaused={true}
					gameStats={defaultGameStats}
					onResume={mockOnResume}
					onExit={mockOnExit}
					showCountdown={true}
				/>
			);

			// 再開クリックで内部カウントダウンを開始してから Space でスキップ
			fireEvent.click(screen.getByText('再開'));
			expect(screen.getByTestId('countdown-display')).toBeInTheDocument();

			fireEvent.keyDown(document, { key: ' ' });
			expect(mockOnResume).toHaveBeenCalledWith({ skipCountdown: true });
		});
	});

	describe('Menu Options', () => {
		it('TC-029: should show settings button if handler provided', () => {
			render(
				<PauseOverlay
					isPaused={true}
					gameStats={defaultGameStats}
					onResume={mockOnResume}
					onExit={mockOnExit}
					onSettings={mockOnSettings}
				/>
			);

			const settingsButton = screen.getByText('設定');
			expect(settingsButton).toBeInTheDocument();
		});

		it('TC-030: should handle exit button click', async () => {
			render(
				<PauseOverlay
					isPaused={true}
					gameStats={defaultGameStats}
					onResume={mockOnResume}
					onExit={mockOnExit}
				/>
			);

			const exitButton = screen.getByText('終了');
			fireEvent.click(exitButton);

			// Should show confirmation dialog
			expect(screen.getByText('本当に終了しますか？')).toBeInTheDocument();

			const confirmButton = screen.getByText('はい');
			fireEvent.click(confirmButton);

			expect(mockOnExit).toHaveBeenCalled();
		});

		it('TC-031: should cancel exit on dialog cancel', async () => {
			render(
				<PauseOverlay
					isPaused={true}
					gameStats={defaultGameStats}
					onResume={mockOnResume}
					onExit={mockOnExit}
				/>
			);

			const exitButton = screen.getByText('終了');
			fireEvent.click(exitButton);

			const cancelButton = screen.getByText('いいえ');
			fireEvent.click(cancelButton);

			expect(mockOnExit).not.toHaveBeenCalled();
			expect(screen.queryByText('本当に終了しますか？')).not.toBeInTheDocument();
		});
	});

	describe('Keyboard Handling', () => {
		it('TC-017: should handle ESC key for resume', async () => {
			// カウントダウン無しなら ESC で即時再開
			render(
				<PauseOverlay
					isPaused={true}
					gameStats={defaultGameStats}
					onResume={mockOnResume}
					onExit={mockOnExit}
					showCountdown={false}
				/>
			);

			fireEvent.keyDown(document, { key: 'Escape' });
			expect(mockOnResume).toHaveBeenCalled();
		});

		it('should prevent ESC during countdown', async () => {
			render(
				<PauseOverlay
					isPaused={true}
					gameStats={defaultGameStats}
					onResume={mockOnResume}
					onExit={mockOnExit}
					showCountdown={true}
				/>
			);

			// カウントダウン中は ESC で即時再開しない
			fireEvent.click(screen.getByText('再開'));
			expect(screen.getByTestId('countdown-display')).toBeInTheDocument();

			fireEvent.keyDown(document, { key: 'Escape' });
			expect(mockOnResume).not.toHaveBeenCalled();
		});
	});

	describe('Animation Tests', () => {
		it('TC-023: should have fade animation classes', () => {
			render(
				<PauseOverlay
					isPaused={true}
					gameStats={defaultGameStats}
					onResume={mockOnResume}
					onExit={mockOnExit}
				/>
			);

			const overlay = screen.getByTestId('pause-overlay');
			expect(overlay).toHaveClass('transition-opacity', 'duration-300');

			const modal = screen.getByTestId('pause-modal');
			expect(modal).toHaveClass('transition-all', 'duration-300');
		});

		it('TC-024: should have scale animation', () => {
			render(
				<PauseOverlay
					isPaused={true}
					gameStats={defaultGameStats}
					onResume={mockOnResume}
					onExit={mockOnExit}
				/>
			);

			const modal = screen.getByTestId('pause-modal');
			expect(modal).toHaveClass('scale-100');
		});
	});

	describe('Accessibility', () => {
		it('TC-032: should support keyboard navigation', async () => {
			render(
				<PauseOverlay
					isPaused={true}
					gameStats={defaultGameStats}
					onResume={mockOnResume}
					onExit={mockOnExit}
					onSettings={mockOnSettings}
				/>
			);

			// ネイティブの Tab 移動は happy-dom では再現できないため、
			// ボタンがネイティブにフォーカス可能で、DOM 上のタブ順が
			// 再開 → 設定 → 終了 になっていることを検証する。
			const resumeButton = screen.getByText('再開');
			const settingsButton = screen.getByText('設定');
			const exitButton = screen.getByText('終了');

			resumeButton.focus();
			expect(document.activeElement).toBe(resumeButton);

			const buttons = screen.getAllByRole('button');
			const order = buttons.filter((b) => [resumeButton, settingsButton, exitButton].includes(b));
			expect(order).toEqual([resumeButton, settingsButton, exitButton]);
		});

		it('TC-033: should have proper ARIA attributes', () => {
			render(
				<PauseOverlay
					isPaused={true}
					gameStats={defaultGameStats}
					onResume={mockOnResume}
					onExit={mockOnExit}
				/>
			);

			const modal = screen.getByTestId('pause-modal');
			expect(modal).toHaveAttribute('role', 'dialog');
			expect(modal).toHaveAttribute('aria-labelledby', 'pause-title');
			expect(modal).toHaveAttribute('aria-modal', 'true');

			const overlay = screen.getByTestId('pause-overlay');
			expect(overlay).toHaveAttribute('aria-hidden', 'false');
		});
	});

	describe('Responsive Design', () => {
		it('TC-035: should adjust for mobile screens', () => {
			global.innerWidth = 375;

			render(
				<PauseOverlay
					isPaused={true}
					gameStats={defaultGameStats}
					onResume={mockOnResume}
					onExit={mockOnExit}
				/>
			);

			const modal = screen.getByTestId('pause-modal');
			expect(modal).toHaveClass('w-full', 'h-full', 'md:w-auto', 'md:h-auto');
		});

		it('TC-037: should center on desktop', () => {
			global.innerWidth = 1280;

			render(
				<PauseOverlay
					isPaused={true}
					gameStats={defaultGameStats}
					onResume={mockOnResume}
					onExit={mockOnExit}
				/>
			);

			const modal = screen.getByTestId('pause-modal');
			expect(modal).toHaveClass('max-w-lg');
		});
	});

	describe('Edge Cases', () => {
		it('should handle missing game stats gracefully', () => {
			render(
				<PauseOverlay
					isPaused={true}
					gameStats={{
						currentCard: 0,
						totalCards: 0,
						elapsedTime: 0,
						pauseCount: 0,
						score: 0,
						accuracy: 0
					}}
					onResume={mockOnResume}
					onExit={mockOnExit}
				/>
			);

			expect(screen.getByText('0/0枚完了')).toBeInTheDocument();
			expect(screen.getByText('00:00')).toBeInTheDocument();
		});

		it('should format large numbers correctly', () => {
			render(
				<PauseOverlay
					isPaused={true}
					gameStats={{
						...defaultGameStats,
						elapsedTime: 3661000, // 1 hour, 1 minute, 1 second
						score: 999999
					}}
					onResume={mockOnResume}
					onExit={mockOnExit}
				/>
			);

			expect(screen.getByText('61:01')).toBeInTheDocument(); // mm:ss format
			expect(screen.getByText('スコア: 999999')).toBeInTheDocument();
		});
	});
});
