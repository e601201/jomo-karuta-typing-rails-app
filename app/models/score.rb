class Score < ApplicationRecord
  belongs_to :user, optional: true

  enum :game_mode, { random: "random", timeattack: "timeattack" }
  enum :difficulty, { beginner: "beginner", standard: "standard", advanced: "advanced" }

  validates :nick_name, presence: true, length: { maximum: 20 }
  validates :game_mode, presence: true
  validates :difficulty, presence: true

  # ランダムモードはスコア必須（0 以上の整数）
  validates :score, presence: true,
                    numericality: { only_integer: true, greater_than_or_equal_to: 0 },
                    if: :random?

  # タイムアタックはタイム必須（1ms 以上の整数）
  validates :time_ms, presence: true,
                      numericality: { only_integer: true, greater_than: 0 },
                      if: :timeattack?

  # タイブレークは created_at 先着優先
  scope :score_leaderboard, ->(difficulty) {
    where(game_mode: :random, difficulty:)
      .where.not(score: nil)
      .order(score: :desc, created_at: :asc)
      .limit(100)
  }

  scope :time_leaderboard, ->(difficulty) {
    where(game_mode: :timeattack, difficulty:)
      .where.not(time_ms: nil)
      .order(time_ms: :asc, created_at: :asc)
      .limit(100)
  }
end
