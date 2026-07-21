class CreateGameResults < ActiveRecord::Migration[8.1]
  def change
    # game_mode / difficulty enum は create_scores で作成済みのものを再利用する
    create_table :game_results do |t|
      t.references :user, foreign_key: true, null: false, index: false # ログインユーザーのみ・非公開
      t.enum :game_mode, enum_type: :game_mode, null: false
      t.enum :difficulty, enum_type: :difficulty, null: false
      t.integer :score              # random 用（timeattack 行は null。scores と同じモード依存）
      t.integer :time_ms            # timeattack 用 ms（random 行は null）
      t.integer :accuracy, null: false     # 0..100 の整数パーセント
      t.integer :wpm, null: false
      t.integer :max_combo, null: false
      t.integer :correct_cards, null: false
      t.timestamps
    end

    # 履歴テーブルの「最新 N 件」取得（user_id + created_at 降順）と
    # ユーザー別ベスト導出（user_id 先頭）の双方に効く
    add_index :game_results, [ :user_id, :created_at ], order: { created_at: :desc },
      name: "idx_game_results_user_recent"
  end
end
