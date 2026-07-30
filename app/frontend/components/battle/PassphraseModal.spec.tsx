import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import PassphraseModal from './PassphraseModal';

describe('PassphraseModal', () => {
	const onClose = vi.fn();
	const onSubmit = vi.fn();

	beforeEach(() => {
		onClose.mockClear();
		onSubmit.mockClear();
	});

	function renderModal(props: Partial<React.ComponentProps<typeof PassphraseModal>> = {}) {
		return render(<PassphraseModal show onClose={onClose} onSubmit={onSubmit} {...props} />);
	}

	it('show=false のときは何も表示しない', () => {
		render(<PassphraseModal show={false} onClose={onClose} onSubmit={onSubmit} />);
		expect(screen.queryByTestId('passphrase-modal')).not.toBeInTheDocument();
	});

	it('合言葉が空の間はマッチングを開始できない', () => {
		renderModal();
		const submit = screen.getByRole('button', { name: /マッチングを開始/ });
		expect(submit).toBeDisabled();

		fireEvent.click(submit);
		expect(onSubmit).not.toHaveBeenCalled();
	});

	it('入力した合言葉を前後の空白を除いて送信する', () => {
		renderModal();
		fireEvent.change(screen.getByPlaceholderText('ぐんまちゃん'), {
			target: { value: '  ぐんまちゃん  ' }
		});
		fireEvent.click(screen.getByRole('button', { name: /マッチングを開始/ }));

		expect(onSubmit).toHaveBeenCalledWith('ぐんまちゃん');
	});

	it('エラーメッセージを表示する', () => {
		renderModal({ error: '合言葉を入力してください' });
		expect(screen.getByRole('alert')).toHaveTextContent('合言葉を入力してください');
	});

	it('戻るで onClose を呼ぶ', () => {
		renderModal();
		fireEvent.click(screen.getByRole('button', { name: /戻る/ }));
		expect(onClose).toHaveBeenCalled();
	});
});
