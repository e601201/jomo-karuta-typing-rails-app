# OmniAuth は Rails ミドルウェアとして構成する。
# request phase は omniauth-rails_csrf_protection により POST + authenticity token 必須。
Rails.application.config.middleware.use OmniAuth::Builder do
  provider :google_oauth2, ENV["GOOGLE_CLIENT_ID"], ENV["GOOGLE_CLIENT_SECRET"]
  provider :github, ENV["GITHUB_CLIENT_ID"], ENV["GITHUB_CLIENT_SECRET"], scope: "user:email"
end

# 認証失敗時は /auth/error へリダイレクトする（Inertia の auth/Error ページ）
OmniAuth.config.on_failure = proc do |env|
  message_key = env["omniauth.error.type"]
  new_path = "/auth/error?message=#{Rack::Utils.escape(message_key)}"
  Rack::Response.new([ "302 Moved" ], 302, "Location" => new_path).finish
end
