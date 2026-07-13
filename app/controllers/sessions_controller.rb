class SessionsController < ApplicationController
  # request phase (POST /auth/:provider) は OmniAuth ミドルウェア +
  # omniauth-rails_csrf_protection が処理する。callback は GET なので
  # CSRF 検証のスキップは不要。

  def new
    return redirect_to "/profile" if current_user

    render inertia: "auth/Login"
  end

  def create
    auth = request.env["omniauth.auth"]
    user = User.from_omniauth(auth)
    reset_session
    session[:user_id] = user.id
    redirect_to root_path
  rescue User::EmailUnavailableError
    redirect_to "/auth/error?message=email_unavailable"
  end

  def error
    render inertia: "auth/Error", props: { message: params[:message] }
  end

  def destroy
    reset_session
    redirect_to root_path
  end
end
