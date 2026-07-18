class ApplicationController < ActionController::Base
  # Only allow modern browsers supporting webp images, web push, badges, import maps, CSS nesting, and CSS :has.
  allow_browser versions: :modern

  before_action :set_csrf_cookie

  inertia_share do
    {
      auth: { user: current_user&.as_json(only: %i[id email nickname avatar_url created_at]) },
      # 未ログイン / 未保存は nil（nil が「初回引き継ぎ対象」のシグナル。ADR-0004）
      settings: current_user&.user_setting&.as_frontend,
      # ベストスコア（ランキング登録済みスコア中の自己最高）。未ログインは nil
      best_scores: current_user&.best_scores,
      csrf_token: form_authenticity_token,
      flash: flash.to_h
    }
  end

  private

  def current_user
    return nil unless session[:user_id]

    @current_user ||= User.find_by(id: session[:user_id])
  end

  def require_login
    redirect_to "/auth/login" unless current_user
  end

  # fetch 系 API 呼び出し用に XSRF トークンをクッキーで配布する
  def set_csrf_cookie
    cookies["XSRF-TOKEN"] = { value: form_authenticity_token, same_site: :lax }
  end

  # Inertia/fetch 互換: X-XSRF-TOKEN ヘッダによる CSRF 検証も許可する
  def verified_request?
    super || valid_authenticity_token?(session, request.headers["X-XSRF-TOKEN"])
  end
end
