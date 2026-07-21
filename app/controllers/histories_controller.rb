class HistoriesController < ApplicationController
  before_action :require_login

  # 履歴テーブルは最新 N 件のみ返す。総プレイ回数・平均などのサマリーは全件から集計する（#20 / ADR 0005）
  RECENT_LIMIT = 50

  def index
    results = current_user.game_results
    best = current_user.best_scores

    render inertia: "History", props: {
      summary: {
        totalPlays: results.count,
        bestScore: best[:random],       # { score, difficulty } | nil（ランダムの自己最高）
        bestTime: best[:timeattack],    # { time_ms, difficulty } | nil（タイムアタックの自己最高）
        averageAccuracy: results.average(:accuracy)&.round
      },
      records: results.order(created_at: :desc).limit(RECENT_LIMIT).as_json(
        only: %i[id game_mode difficulty score time_ms accuracy max_combo created_at]
      ),
      recentLimit: RECENT_LIMIT
    }
  end
end
