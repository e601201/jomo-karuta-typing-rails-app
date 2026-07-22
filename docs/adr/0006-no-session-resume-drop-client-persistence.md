# セッション復帰機能を実装せず、クライアント側の作りかけ永続化を削除する

プレイ中のセッションを localStorage へ5秒ごとに自動保存する仕組み（`game-store.ts` の `saveSession` / `startAutoSave`）と、IndexedDB / localStorage のクライアント永続化一式（`app/frontend/lib/storage/`）は、**書き込むだけで読み戻す経路が実装されないまま**止まっていた（`loadSession` / `hasSession` はどこからも呼ばれていない）。中断したプレイを「続きから」再開する機能は**今後も実装しない**方針を確定し、作りかけの足場ごと削除する。プレイ履歴・実績・ベストスコアはアカウント優先の DB 保存（ADR 0004・プレイ記録）へ一本化済みで、クライアント側の永続化が使われる見込みは無い。

**理由**: 中断復帰 UX の価値に対し、クライアントとサーバの双方に永続化状態を抱える複雑さ（不整合・マイグレーション・メモリフォールバック）が見合わない。誰も読まないデータをプレイ中ずっと5秒おきに書き続ける現状は、無駄な定期書き込みでもある。クライアント永続化を採らない判断は #8（未接続の localStorage `bestScores` 経路の削除）から一貫している。

## Consequences

- `lib/storage/`（`indexed-db.ts` / `local-storage.ts` と各 spec）と本番依存 `dexie` が消える。`JomoKarutaDB` は実ブラウザの IndexedDB に一度も作られたことが無く、既存ユーザーへの影響は無い。
- `game-store.ts` から `saveSession` / `startAutoSave` / `stopAutoSave` と5秒自動保存インターバルを削除する。これらは公開 export だったが、ストア外からの参照はゼロ（spec を含む）。
- 将来セッション復帰を導入する場合は、この ADR を superseded にしたうえで、アカウント優先方針（ADR 0004）と整合する形（サーバ側セッション等）で再設計する。作りかけのクライアント実装を復活させる前提には立たない。
