module Api
  class ScoresController < ApplicationController
    # CSRF は ApplicationController#verified_request? の X-XSRF-TOKEN ヘッダ検証で通す
    # （forgery protection のスキップはしない）

    def create
      score = Score.new(score_attributes)
      score.user = current_user if current_user

      if score.save
        render json: { success: true }, status: :created
      else
        render json: { success: false, error: score.errors.full_messages.to_sentence },
               status: :unprocessable_entity
      end
    rescue ArgumentError => e
      # enum に不正な値（game_mode / difficulty）が渡された場合も 422 で返す
      render json: { success: false, error: e.message }, status: :unprocessable_entity
    end

    private

    def score_params
      params.permit(:nick_name, :score, :time, :difficulty, :game_mode)
    end

    # フロントは経過時間を 'time'（ms）で送るため、time_ms カラムへ詰め替える
    def score_attributes
      {
        nick_name: score_params[:nick_name],
        difficulty: score_params[:difficulty],
        game_mode: score_params[:game_mode],
        score: score_params[:score],
        time_ms: score_params[:time]
      }
    end
  end
end
