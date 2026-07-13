import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import InputHighlight from './InputHighlight';

describe('InputHighlight Component', () => {
	describe('Basic Display', () => {
		it('TC-001: should display initial state with all pending', () => {
			render(
				<InputHighlight
					text="つるまう"
					inputStates={['pending', 'pending', 'pending', 'pending']}
					currentPosition={0}
				/>
			);

			const characters = screen.getAllByTestId(/char-\d+/);
			expect(characters).toHaveLength(4);

			// 未入力文字は text-gray-600（現行配色）
			characters.forEach((char) => {
				expect(char).toHaveClass('text-gray-600');
			});
		});

		it('TC-002: should highlight typed/current characters with the current color scheme', () => {
			render(
				<InputHighlight
					text="つるまう"
					// 現行実装ではカーソル位置は 'current' 状態で表現する
					inputStates={['correct', 'current', 'pending', 'pending']}
					currentPosition={1}
				/>
			);

			// 入力済み（correct）は薄いグレー、現在位置は青字＋太字
			const firstChar = screen.getByTestId('char-0');
			expect(firstChar).toHaveClass('text-gray-200');

			const currentChar = screen.getByTestId('char-1');
			expect(currentChar).toHaveClass('text-blue-500');
			expect(currentChar).toHaveClass('font-bold');
		});

		it('TC-003: should highlight incorrect characters in red', () => {
			render(
				<InputHighlight
					text="つるまう"
					inputStates={['correct', 'incorrect', 'pending', 'pending']}
					currentPosition={1}
					animateErrors={true}
				/>
			);

			const secondChar = screen.getByTestId('char-1');
			expect(secondChar).toHaveClass('text-red-500');
			expect(secondChar).toHaveClass('animate-shake');
		});
	});

	describe('Cursor Display', () => {
		it('TC-004: should mark the current position via the current state', () => {
			render(
				<InputHighlight
					text="つるまう"
					// 現行実装は独立カーソル要素ではなく 'current' 状態で現在位置を表す
					inputStates={['correct', 'correct', 'current', 'pending']}
					currentPosition={2}
				/>
			);

			const currentChar = screen.getByTestId('char-2');
			expect(currentChar).toHaveClass('text-blue-500');
			expect(currentChar).toHaveClass('font-bold');
		});

		it('TC-005: should move the current marker as position advances', () => {
			const { rerender } = render(
				<InputHighlight
					text="つるまう"
					inputStates={['correct', 'current', 'pending', 'pending']}
					currentPosition={1}
				/>
			);

			expect(screen.getByTestId('char-1')).toHaveClass('text-blue-500');

			rerender(
				<InputHighlight
					text="つるまう"
					inputStates={['correct', 'correct', 'current', 'pending']}
					currentPosition={2}
				/>
			);

			// 旧位置は current ではなくなり、新位置が current になる
			expect(screen.getByTestId('char-1')).not.toHaveClass('text-blue-500');
			const currentChar = screen.getByTestId('char-2');
			expect(currentChar).toHaveClass('text-blue-500');
			// 色遷移アニメーションは各文字に付与される
			expect(currentChar).toHaveClass('transition-colors');
		});
	});

	describe('Romaji Display', () => {
		it('TC-006: should display romaji guide when enabled', () => {
			render(
				<InputHighlight
					text="つる"
					inputStates={['pending', 'pending']}
					currentPosition={0}
					showRomaji={true}
					romaji="tsuru"
				/>
			);

			const romajiContainer = screen.getByTestId('romaji-container');
			expect(romajiContainer).toBeInTheDocument();
			// 現行実装ではローマ字を1文字ずつ大文字表示する（文字間に空白が入る）
			expect(romajiContainer).toHaveTextContent(/T\s*S\s*U\s*R\s*U/);
		});

		it('TC-007: should highlight romaji in sync with hiragana', () => {
			render(
				<InputHighlight
					text="つる"
					inputStates={['correct', 'pending']}
					currentPosition={1}
					showRomaji={true}
					romaji="tsuru"
					romajiStates={['correct', 'correct', 'correct', 'pending', 'pending']}
				/>
			);

			const romajiChars = screen.getAllByTestId(/romaji-char-\d+/);
			// correct は薄いグレー、pending は text-gray-600（現行配色）
			expect(romajiChars[0]).toHaveClass('text-gray-200'); // t
			expect(romajiChars[1]).toHaveClass('text-gray-200'); // s
			expect(romajiChars[2]).toHaveClass('text-gray-200'); // u
			expect(romajiChars[3]).toHaveClass('text-gray-600'); // r
			expect(romajiChars[4]).toHaveClass('text-gray-600'); // u
		});
	});

	describe('Animations', () => {
		it('TC-008: should animate color transitions', () => {
			const { rerender } = render(
				<InputHighlight text="つ" inputStates={['pending']} currentPosition={0} />
			);

			const char = screen.getByTestId('char-0');
			expect(char).toHaveClass('transition-colors');
			expect(char).toHaveClass('duration-200');

			rerender(<InputHighlight text="つ" inputStates={['correct']} currentPosition={1} />);

			expect(char).toHaveClass('text-gray-200');
		});

		it('TC-009: should animate error shake', () => {
			render(
				<InputHighlight
					text="つる"
					inputStates={['correct', 'incorrect']}
					currentPosition={1}
					animateErrors={true}
				/>
			);

			const errorChar = screen.getByTestId('char-1');
			expect(errorChar).toHaveClass('animate-shake');
		});

		it('TC-010: should animate the romaji cursor blink', () => {
			// 現行実装では点滅カーソルは通常表示の文字ではなくローマ字ガイド側にある
			render(
				<InputHighlight
					text="つ"
					inputStates={['current']}
					currentPosition={0}
					showRomaji={true}
					romaji="tsu"
					currentRomajiPosition={0}
				/>
			);

			const cursor = screen.getByTestId('romaji-cursor-0');
			expect(cursor).toHaveClass('animate-pulse');
		});
	});

	describe('Performance', () => {
		it('TC-011: should render quickly for initial display', () => {
			const startTime = performance.now();

			render(
				<InputHighlight
					text="あいうえおかきくけこさしすせそたちつてとなにぬねのはひふへほまみむめもやゆよらりるれろわをん"
					inputStates={Array(50).fill('pending')}
					currentPosition={0}
				/>
			);

			const endTime = performance.now();
			// CI ランナーの負荷・GC で実時間は揺れる（16ms 固定だと CI で散発的に失敗した）。
			// 閾値は実性能退行（O(n²) 化＝秒オーダー）だけを捕捉する緩い値とし、フレーク防止のため
			// 安易に縮めないこと。
			expect(endTime - startTime).toBeLessThan(100);
		});

		it('TC-012: should update quickly on state change', () => {
			const { rerender } = render(
				<InputHighlight text="つる" inputStates={['pending', 'pending']} currentPosition={0} />
			);

			const startTime = performance.now();

			rerender(
				<InputHighlight text="つる" inputStates={['correct', 'pending']} currentPosition={1} />
			);

			const endTime = performance.now();
			// 再描画も同様に CI で揺れるため、実退行のみ捕捉する緩い閾値とする（安易に縮めない）。
			expect(endTime - startTime).toBeLessThan(50);
		});
	});

	describe('Accessibility', () => {
		it('TC-015: should support colorblind mode (icons on romaji guide)', () => {
			// 現行実装では色覚対応アイコンはローマ字ガイド側に表示される
			render(
				<InputHighlight
					text="つる"
					inputStates={['correct', 'current']}
					currentPosition={1}
					colorblindMode={true}
					showRomaji={true}
					romaji="tsuru"
					romajiStates={['correct', 'correct', 'correct', 'incorrect', 'pending']}
				/>
			);

			const correctRomaji = screen.getByTestId('romaji-char-0');
			const incorrectRomaji = screen.getByTestId('romaji-char-3');

			expect(correctRomaji.querySelector('.icon-check')).toBeInTheDocument();
			expect(incorrectRomaji.querySelector('.icon-cross')).toBeInTheDocument();
		});

		it('TC-016: should have proper ARIA labels', () => {
			render(
				<InputHighlight text="つる" inputStates={['correct', 'incorrect']} currentPosition={0} />
			);

			const correctChar = screen.getByTestId('char-0');
			const incorrectChar = screen.getByTestId('char-1');

			expect(correctChar).toHaveAttribute('aria-label', 'つ: 正解');
			expect(incorrectChar).toHaveAttribute('aria-label', 'る: 不正解');
		});

		it('TC-017: should support high contrast mode', () => {
			render(
				<InputHighlight
					text="つる"
					inputStates={['correct', 'incorrect']}
					currentPosition={0}
					highContrast={true}
				/>
			);

			const chars = screen.getAllByTestId(/char-\d+/);
			chars.forEach((char) => {
				expect(char).toHaveClass('border');
			});
		});
	});

	describe('Responsive Design', () => {
		it('TC-019: should display correctly on mobile', () => {
			global.innerWidth = 375;

			render(
				<InputHighlight
					text="つるまう"
					inputStates={['pending', 'pending', 'pending', 'pending']}
					currentPosition={0}
				/>
			);

			const container = screen.getByTestId('highlight-container');
			// 現行のレスポンシブ配色: base text-xl / md:text-2xl / lg:text-4xl
			expect(container).toHaveClass('text-xl');
			expect(container).toHaveClass('md:text-2xl');
		});

		it('TC-021: should display correctly on desktop', () => {
			global.innerWidth = 1280;

			render(
				<InputHighlight
					text="つるまう"
					inputStates={['pending', 'pending', 'pending', 'pending']}
					currentPosition={0}
				/>
			);

			const container = screen.getByTestId('highlight-container');
			expect(container).toHaveClass('lg:text-4xl');
		});
	});

	describe('Edge Cases', () => {
		it('TC-022: should handle empty text', () => {
			render(<InputHighlight text="" inputStates={[]} currentPosition={0} />);

			const container = screen.getByTestId('highlight-container');
			expect(container).toBeEmptyDOMElement();
		});

		it('TC-023: should handle very long text', () => {
			const longText = 'あ'.repeat(200);
			const longStates = Array(200).fill('pending');

			render(<InputHighlight text={longText} inputStates={longStates} currentPosition={0} />);

			const container = screen.getByTestId('highlight-container');
			expect(container).toHaveClass('flex-wrap');
		});

		it('TC-024: should handle special characters', () => {
			render(
				<InputHighlight
					text="ー々・"
					inputStates={['pending', 'pending', 'pending']}
					currentPosition={0}
				/>
			);

			expect(screen.getByText('ー')).toBeInTheDocument();
			expect(screen.getByText('々')).toBeInTheDocument();
			expect(screen.getByText('・')).toBeInTheDocument();
		});
	});
});
