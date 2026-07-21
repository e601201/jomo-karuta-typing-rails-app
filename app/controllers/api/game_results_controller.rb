module Api
  class GameResultsController < ApplicationController
    # フラットな JSON を受けるため、model 名での自動パラメータラップ（params[:game_result]）を無効化する
    wrap_parameters format: []

    # プレイ記録はログインユーザーのみ（ADR 0005）。API なので HTML リダイレクトではなく JSON 401 を返す。
    before_action :require_logged_in

    # CSRF は ApplicationController#verified_request? の X-XSRF-TOKEN ヘッダ検証で通す
    def create
      result = current_user.game_results.new(game_result_attributes)

      if result.save
        render json: { success: true }, status: :created
      else
        render json: { success: false, error: result.errors.full_messages.to_sentence },
               status: :unprocessable_entity
      end
    rescue ArgumentError => e
      # enum に不正な値（game_mode / difficulty）が渡された場合も 422 で返す
      render json: { success: false, error: e.message }, status: :unprocessable_entity
    end

    private

    def require_logged_in
      return if current_user

      render json: { success: false, error: "ログインが必要です" }, status: :unauthorized
    end

    def game_result_params
      params.permit(:game_mode, :difficulty, :score, :time, :accuracy, :wpm, :max_combo, :correct_cards)
    end

    # フロントは経過時間を 'time'（ms）で送るため、time_ms カラムへ詰め替える（scores と同じ流儀）。
    # accuracy は表示用の小数で届きうるので整数パーセントへ丸める（列は整数）。
    def game_result_attributes
      {
        game_mode: game_result_params[:game_mode],
        difficulty: game_result_params[:difficulty],
        score: game_result_params[:score],
        time_ms: game_result_params[:time],
        accuracy: game_result_params[:accuracy]&.to_f&.round,
        wpm: game_result_params[:wpm],
        max_combo: game_result_params[:max_combo],
        correct_cards: game_result_params[:correct_cards]
      }
    end
  end
end
