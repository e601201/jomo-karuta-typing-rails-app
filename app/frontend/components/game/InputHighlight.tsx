import { useMemo } from 'react';
import type { RandomModeDifficulty } from '@/types';
import BlindInputDisplay from './BlindInputDisplay';

export type InputState = 'pending' | 'correct' | 'incorrect' | 'current';

interface Props {
	text: string;
	inputStates: InputState[];
	currentPosition: number;
	showRomaji?: boolean;
	romaji?: string;
	romajiStates?: InputState[];
	animateErrors?: boolean;
	colorblindMode?: boolean;
	highContrast?: boolean;
	currentRomajiPosition?: number;
	difficulty?: RandomModeDifficulty;
	showHint?: boolean; // ヒント表示フラグ
}

// Parse hiragana text into proper units (considering multi-character units)
function parseTextUnits(inputText: string): string[] {
	const units: string[] = [];
	let i = 0;

	while (i < inputText.length) {
		const current = inputText[i];
		const next = inputText[i + 1];

		// Check for small ya, yu, yo (拗音)
		if (
			next &&
			(next === 'ゃ' ||
				next === 'ゅ' ||
				next === 'ょ' ||
				next === 'ぁ' ||
				next === 'ぃ' ||
				next === 'ぅ' ||
				next === 'ぇ' ||
				next === 'ぉ')
		) {
			units.push(current + next);
			i += 2;
		}
		// Check for small tsu (促音)
		else if (current === 'っ') {
			if (next) {
				units.push(current + next);
				i += 2;
			} else {
				units.push(current);
				i++;
			}
		} else {
			units.push(current);
			i++;
		}
	}

	return units;
}

// Get color class for character state
function getColorClass(state: InputState): string {
	switch (state) {
		case 'correct':
			return 'text-gray-200';
		case 'incorrect':
			return 'text-red-500';
		case 'current':
			return 'text-blue-500 font-bold';
		default:
			return 'text-gray-600';
	}
}

// Get ARIA label for accessibility
function getAriaLabel(char: string, state: InputState): string {
	const stateLabels: Record<InputState, string> = {
		correct: '正解',
		incorrect: '不正解',
		pending: '未入力',
		current: '現在位置'
	};

	return `${char}: ${stateLabels[state]}`;
}

// Get text size class based on screen size
function getTextSizeClass(): string {
	return 'text-xl md:text-2xl lg:text-4xl';
}

export default function InputHighlight({
	text,
	inputStates,
	currentPosition,
	showRomaji = false,
	romaji = '',
	romajiStates = [],
	animateErrors = false,
	colorblindMode = false,
	highContrast = false,
	currentRomajiPosition = 0,
	difficulty = 'standard',
	showHint = false
}: Props) {
	// Split text into characters
	const characters = useMemo(() => parseTextUnits(text), [text]);
	const romajiCharacters = romaji.split('');

	// Get animation class
	function getAnimationClass(state: InputState, index: number): string {
		let classes = 'transition-colors duration-200';

		if (state === 'incorrect' && animateErrors && index === currentPosition) {
			classes += ' animate-shake';
		}

		return classes;
	}

	if (difficulty === 'advanced') {
		// 上級者モード：ブラインド入力表示
		// 直前の入力が正解かどうか（ブラインドモード用）
		const isLastInputCorrect =
			currentPosition > 0 ? inputStates[currentPosition - 1] === 'correct' : true;

		// 正解済みのひらがな（correct のもののみ連結）
		let completedText = '';
		for (let i = 0; i < currentPosition && i < characters.length; i++) {
			if (inputStates[i] === 'correct') {
				completedText += characters[i];
			}
		}

		// 現在入力中のひらがな単位
		const currentCharacter =
			currentPosition < characters.length && inputStates[currentPosition] === 'current'
				? characters[currentPosition]
				: '';

		// 入力済みローマ字（romajiStates の状態に関わらず、現在位置より前を表示）
		let completedRomaji = '';
		for (let i = 0; i < currentRomajiPosition && i < romajiCharacters.length; i++) {
			completedRomaji += romajiCharacters[i];
		}

		// 現在入力中の1文字を特別に表示する必要はない（旧実装のまま空文字）
		const currentRomajiChar = '';

		return (
			<BlindInputDisplay
				totalChars={text.length}
				currentPosition={currentPosition}
				isCorrect={isLastInputCorrect}
				completedText={completedText}
				currentChar={currentCharacter}
				completedRomaji={completedRomaji}
				currentRomaji={currentRomajiChar}
				showHint={showHint}
				hintText={text}
			/>
		);
	}

	// 通常モード：テキストとハイライト表示
	return (
		<>
			<style>{`
				@keyframes input-highlight-shake {
					0%,
					100% {
						transform: translateX(0);
					}
					25% {
						transform: translateX(-4px);
					}
					75% {
						transform: translateX(4px);
					}
				}

				.animate-shake {
					animation: input-highlight-shake 0.5s ease-in-out;
				}
			`}</style>
			<div
				data-testid="highlight-container"
				className={`font-mono ${getTextSizeClass()} flex flex-wrap items-center justify-center gap-1`}
			>
				{characters.length === 0
					? null /* Empty state */
					: characters.map((char, index) => (
							<span
								key={index}
								data-testid={`char-${index}`}
								className={`relative inline-block ${getColorClass(inputStates[index])} ${getAnimationClass(
									inputStates[index],
									index
								)} ${highContrast ? 'border border-current' : ''}`}
								aria-label={getAriaLabel(char, inputStates[index])}
							>
								{char}
							</span>
						))}
			</div>

			{/* Romaji display */}
			{showRomaji && romaji && (
				<div
					data-testid="romaji-container"
					className={`mt-2 flex items-center justify-center gap-0.5 font-mono ${getTextSizeClass()}`}
				>
					{romajiCharacters.map((romajiChar, index) => (
						<span
							key={index}
							data-testid={`romaji-char-${index}`}
							className={`relative inline-block ${getColorClass(
								romajiStates[index] || 'pending'
							)} transition-colors duration-200`}
						>
							{romajiChar.toUpperCase()}

							{/* Colorblind mode icons for romaji */}
							{colorblindMode && romajiStates[index] === 'correct' && (
								<span className="icon-check absolute -top-2 left-1/2 -translate-x-1/2 transform text-xs">
									✓
								</span>
							)}
							{colorblindMode && romajiStates[index] === 'incorrect' && (
								<span className="icon-cross absolute -top-2 left-1/2 -translate-x-1/2 transform text-xs">
									✗
								</span>
							)}

							{/* Cursor for romaji at current input position */}
							{index === currentRomajiPosition && (
								<span
									data-testid={`romaji-cursor-${index}`}
									className="absolute -bottom-1 left-0 h-0.5 w-full animate-pulse bg-blue-500"
								></span>
							)}
						</span>
					))}
				</div>
			)}
		</>
	);
}
