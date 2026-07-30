module ApplicationCable
  class Connection < ActionCable::Connection::Base
    identified_by :current_user

    def connect
      self.current_user = find_verified_user
    end

    private

    # 認証は cookie セッション一本（OmniAuth ログイン時に session[:user_id] が入る）。
    # WebSocket ハンドシェイクでは request.session を参照できないため、暗号化 cookie を直接読む。
    def find_verified_user
      session = cookies.encrypted[Rails.application.config.session_options[:key]]
      user = session && User.find_by(id: session["user_id"])
      user || reject_unauthorized_connection
    end
  end
end
