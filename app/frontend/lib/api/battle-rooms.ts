import { postJson, deleteJson } from '@/lib/http';
import type { BattleMode } from '@/types/battle';

/**
 * 対戦の合言葉マッチング API。
 * create は join-or-create 一本: 待機部屋があれば参加（matched）、なければ作成（waiting）。
 */
export interface BattleRoomResponse {
	success: boolean;
	status: 'waiting' | 'matched';
	room: { id: number };
}

export function createOrJoinBattleRoom(
	gameMode: BattleMode,
	passphrase: string
): Promise<BattleRoomResponse> {
	return postJson<BattleRoomResponse>('/api/battle_rooms', {
		game_mode: gameMode,
		passphrase
	});
}

/** マッチング待機のキャンセル。既に成立済みの場合は 409（HttpError）が返る */
export function cancelBattleRoom(roomId: number): Promise<void> {
	return deleteJson<void>(`/api/battle_rooms/${roomId}`);
}
