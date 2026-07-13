/**
 * ひらがなテキストをタイピング単位にパースする（旧 game/+page.svelte から抽出）。
 * きゃ・しゅ などの拗音、っ+次文字 の促音、読点を1単位として扱う。
 */
export function parseHiraganaUnits(text: string): string[] {
	const units: string[] = [];
	let i = 0;

	while (i < text.length) {
		const current = text[i];
		const next = text[i + 1];

		// 読点をそのまま単位として扱う
		if (current === '、') {
			units.push(current);
			i++;
		}
		// 小さいや、ゆ、よ（拗音）をチェック
		else if (
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
		// 小さいつ（促音）をチェック
		else if (current === 'っ') {
			// 小さいつは通常、次の子音を二重にして入力
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
