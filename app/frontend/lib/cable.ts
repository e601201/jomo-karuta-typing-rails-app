/**
 * Action Cable のコンシューマ（WebSocket 接続）のシングルトン。
 * 接続はアプリ全体で 1 本とし、チャンネル購読側で使い回す。
 */

import { createConsumer, type Consumer } from '@rails/actioncable';

let consumer: Consumer | null = null;

export function getConsumer(): Consumer {
	if (!consumer) {
		consumer = createConsumer();
	}
	return consumer;
}
