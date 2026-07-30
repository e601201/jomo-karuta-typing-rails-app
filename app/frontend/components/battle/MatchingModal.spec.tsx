import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import MatchingModal from './MatchingModal';

describe('MatchingModal', () => {
	const onCancel = vi.fn();

	beforeEach(() => {
		onCancel.mockClear();
	});

	it('show=false のときは何も表示しない', () => {
		render(<MatchingModal show={false} passphrase="ぐんまちゃん" onCancel={onCancel} />);
		expect(screen.queryByTestId('matching-modal')).not.toBeInTheDocument();
	});

	it('合言葉と待機状態を表示する', () => {
		render(<MatchingModal show passphrase="ぐんまちゃん" onCancel={onCancel} />);

		expect(screen.getByText('マッチング中')).toBeInTheDocument();
		expect(screen.getByText('合言葉：ぐんまちゃん')).toBeInTheDocument();
		expect(screen.getByText('あなた')).toBeInTheDocument();
		expect(screen.getByText('相手')).toBeInTheDocument();
		expect(screen.getByText('待機中…')).toBeInTheDocument();
	});

	it('マッチングをやめるで onCancel を呼ぶ', () => {
		render(<MatchingModal show passphrase="ぐんまちゃん" onCancel={onCancel} />);
		fireEvent.click(screen.getByRole('button', { name: /マッチングをやめる/ }));
		expect(onCancel).toHaveBeenCalled();
	});
});
