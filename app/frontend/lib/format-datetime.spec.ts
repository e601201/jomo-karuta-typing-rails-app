import { describe, expect, it } from 'vitest';
import { formatDateTime } from './format-datetime';

describe('formatDateTime', () => {
	it('ISO 日時を ja-JP の年月日と時分で返す', () => {
		const formatted = formatDateTime('2024-06-08T01:02:00.000Z');

		expect(formatted).toMatch(/\d{4}\/\d{2}\/\d{2}/);
		expect(formatted).toMatch(/\d{1,2}:\d{2}/);
	});
});
