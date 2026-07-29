class AchievementsController < ApplicationController
  before_action :require_login

  def index
    render inertia: "Achievements", props: {
      badges: current_user.badges,
      # タブはカタログ由来のカテゴリ列から描く（フロントにはハードコードしない。#21）
      categories: Badge::CATEGORIES,
      stats: {
        totalPlays: current_user.game_results.count,
        currentStreak: current_user.current_play_streak
      }
    }
  end
end
