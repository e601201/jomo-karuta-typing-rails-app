class CreateBattleRooms < ActiveRecord::Migration[8.1]
  def change
    create_enum :battle_room_status, %w[waiting matched finished canceled]

    create_table :battle_rooms do |t|
      # game_mode enum は create_scores で作成済みのものを再利用する（対戦結果は保存しないため値の追加も不要）
      t.enum :game_mode, enum_type: :game_mode, null: false
      # 合言葉。PassphraseModal の maxlength=20 に合わせる
      t.string :passphrase, null: false, limit: 20
      t.enum :status, enum_type: :battle_room_status, null: false, default: "waiting"
      t.references :host, null: false, foreign_key: { to_table: :users }
      t.references :guest, foreign_key: { to_table: :users }
      # マッチ成立時にサーバが確定する山札（カード id の配列。両者同一順序で個別同時プレイする）
      t.jsonb :deck, null: false, default: []
      t.timestamps
    end

    # 同じ（モード, 合言葉）の待機部屋は同時に1つだけ。join-or-create の作成競合を DB で弾く
    add_index :battle_rooms, %i[game_mode passphrase], unique: true,
      where: "status = 'waiting'", name: "idx_battle_rooms_waiting_key"
  end
end
