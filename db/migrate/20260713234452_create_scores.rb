class CreateScores < ActiveRecord::Migration[8.1]
  def change
    create_enum :game_mode, %w[random timeattack]
    create_enum :difficulty, %w[beginner standard advanced]

    create_table :scores do |t|
      # 旧ランキング登録モーダルの maxlength=20 に合わせる
      t.string :nick_name, null: false, limit: 20
      t.integer :score                # random 用（timeattack 行は null）
      t.integer :time_ms              # timeattack 用 ms（random 行は null。旧 Score.time 相当）
      t.enum :game_mode, enum_type: :game_mode, null: false
      t.enum :difficulty, enum_type: :difficulty, null: false
      t.references :user, foreign_key: true, null: true # 匿名投稿可・ログイン時のみ紐付け
      t.timestamps
    end

    # リーダーボード用の部分インデックス（random: score 降順 / timeattack: time_ms 昇順）
    add_index :scores, [ :game_mode, :difficulty, :score ],
      order: { score: :desc }, where: "score IS NOT NULL", name: "idx_scores_leaderboard_score"
    add_index :scores, [ :game_mode, :difficulty, :time_ms ],
      where: "time_ms IS NOT NULL", name: "idx_scores_leaderboard_time"
  end
end
