class RankingsController < ApplicationController
  VALID_GAME_MODES = %w[random timeattack].freeze
  VALID_DIFFICULTIES = %w[beginner standard advanced].freeze

  def index
    game_mode = VALID_GAME_MODES.include?(params[:game_mode]) ? params[:game_mode] : "random"
    difficulty = VALID_DIFFICULTIES.include?(params[:difficulty]) ? params[:difficulty] : "standard"

    entries =
      if game_mode == "timeattack"
        Score.time_leaderboard(difficulty)
      else
        Score.score_leaderboard(difficulty)
      end

    render inertia: "Ranking", props: {
      gameMode: game_mode,
      difficulty: difficulty,
      entries: entries.as_json(only: %i[id nick_name score time_ms difficulty game_mode created_at])
    }
  end
end
