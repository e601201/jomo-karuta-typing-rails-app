require "rails_helper"

RSpec.describe "Pages", type: :request do
  describe "GET /how-to-play" do
    # 遊び方はゲスト用メニューからも辿れるため、require_login を付けてはならない。
    # profiles_controller を写して認証を足す事故を防ぐ回帰テスト。
    it "renders the how-to-play page without authentication" do
      get "/how-to-play"

      expect(response).to have_http_status(:ok)
      expect_inertia.to render_component("HowToPlay")
    end
  end
end
