import { describe, it, expect, beforeEach } from 'vitest';
import { InputValidator } from '@/lib/typing/input-validator';
import { parseHiraganaUnits } from './hiragana-units';
import {
	matchHiraganaProgress,
	buildInputStatesAfterInput,
	buildInputStatesAfterBackspace,
	buildInputStatesOnError,
	buildRomajiStates,
	buildRomajiStatesOnError
} from './input-states';

describe('matchHiraganaProgress', () => {
	let validator: InputValidator;

	beforeEach(() => {
		validator = new InputValidator();
	});

	const progressFor = (target: string, input: string) => {
		validator.setTarget(target);
		return matchHiraganaProgress(parseHiraganaUnits(target), input, validator);
	};

	it('入力が無ければ完了数0', () => {
		expect(progressFor('ぐんまけん', '')).toEqual({
			completedCount: 0,
			partiallyCompleteIndex: -1
		});
	});

	it('1単位の完成を数える', () => {
		expect(progressFor('ぐんまけん', 'gu')).toEqual({
			completedCount: 1,
			partiallyCompleteIndex: -1
		});
	});

	it("単独の'n'は「ん」の打鍵途中として保持する", () => {
		expect(progressFor('ぐんまけん', 'gun')).toEqual({
			completedCount: 1,
			partiallyCompleteIndex: 1
		});
	});

	it("'n'+子音で「ん」が確定する（gunm → ぐ・ん完成、ま入力中）", () => {
		expect(progressFor('ぐんまけん', 'gunm')).toEqual({
			completedCount: 2,
			partiallyCompleteIndex: 2
		});
	});

	it("'nn'でも「ん」が確定する", () => {
		expect(progressFor('ぐんまけん', 'gunn')).toEqual({
			completedCount: 2,
			partiallyCompleteIndex: -1
		});
	});

	it('語末の「ん」は単独nでは完成しない（gunmaken → 4単位のみ完成）', () => {
		expect(progressFor('ぐんまけん', 'gunmaken')).toEqual({
			completedCount: 4,
			partiallyCompleteIndex: 4
		});
	});

	it('語末の「ん」はnnで完成する（全単位完成）', () => {
		expect(progressFor('ぐんまけん', 'gunmakenn')).toEqual({
			completedCount: 5,
			partiallyCompleteIndex: -1
		});
	});

	it('拗音単位（しゃ = sha/sya）を1単位として数える', () => {
		expect(progressFor('しゃしん', 'sha')).toEqual({
			completedCount: 1,
			partiallyCompleteIndex: -1
		});
		expect(progressFor('しゃしん', 'sya')).toEqual({
			completedCount: 1,
			partiallyCompleteIndex: -1
		});
	});

	it('促音単位（っぽ = ppo）を1単位として数える', () => {
		expect(progressFor('にっぽん', 'nippo')).toEqual({
			completedCount: 2,
			partiallyCompleteIndex: -1
		});
	});

	it('途中までの子音は打鍵途中として現在位置を指す', () => {
		expect(progressFor('つるまう', 'tsur')).toEqual({
			completedCount: 1,
			partiallyCompleteIndex: 1
		});
	});
});

describe('状態配列ビルダー', () => {
	it('buildInputStatesAfterInput: 完了分のみ correct、残りは pending', () => {
		expect(buildInputStatesAfterInput(4, 2)).toEqual(['correct', 'correct', 'pending', 'pending']);
	});

	it('buildInputStatesAfterBackspace: 打鍵途中の単位は current', () => {
		expect(buildInputStatesAfterBackspace(4, 1, 1)).toEqual([
			'correct',
			'current',
			'pending',
			'pending'
		]);
	});

	it('buildInputStatesAfterBackspace: 打鍵途中が無ければ pending のみ', () => {
		expect(buildInputStatesAfterBackspace(3, 1, -1)).toEqual(['correct', 'pending', 'pending']);
	});

	it('buildInputStatesOnError: 現在の単位を incorrect にし errorIndex を返す', () => {
		expect(buildInputStatesOnError(4, 2)).toEqual({
			states: ['correct', 'correct', 'incorrect', 'pending'],
			errorIndex: 2
		});
	});

	it('buildRomajiStates: 入力済み位置まで correct', () => {
		expect(buildRomajiStates(4, 2)).toEqual(['correct', 'correct', 'pending', 'pending']);
	});

	it('buildRomajiStatesOnError: 入力位置を incorrect にする', () => {
		expect(buildRomajiStatesOnError(4, 2)).toEqual(['correct', 'correct', 'incorrect', 'pending']);
	});
});
