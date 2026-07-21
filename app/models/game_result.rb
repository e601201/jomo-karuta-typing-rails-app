class GameResult < ApplicationRecord
  belongs_to :user

  enum :game_mode, { random: "random", timeattack: "timeattack" }
  enum :difficulty, { beginner: "beginner", standard: "standard", advanced: "advanced" }

  validates :game_mode, presence: true
  validates :difficulty, presence: true

  # 全プレイ共通で残る最終スコアの指標
  validates :accuracy, presence: true,
                       numericality: { only_integer: true, greater_than_or_equal_to: 0, less_than_or_equal_to: 100 }
  validates :wpm, presence: true,
                  numericality: { only_integer: true, greater_than_or_equal_to: 0 }
  validates :max_combo, presence: true,
                        numericality: { only_integer: true, greater_than_or_equal_to: 0 }
  validates :correct_cards, presence: true,
                            numericality: { only_integer: true, greater_than_or_equal_to: 0 }

  # スコア／タイムはモード依存（scores と同じ流儀）。ランダム＝スコア必須、タイムアタック＝タイム必須
  validates :score, presence: true,
                    numericality: { only_integer: true, greater_than_or_equal_to: 0 },
                    if: :random?
  validates :time_ms, presence: true,
                      numericality: { only_integer: true, greater_than: 0 },
                      if: :timeattack?
end
