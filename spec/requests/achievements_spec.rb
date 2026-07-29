require "rails_helper"

RSpec.describe "Achievements", type: :request do
  def log_in
    OmniAuth.config.mock_auth[:google_oauth2] = OmniAuth::AuthHash.new(
      provider: "google_oauth2",
      uid: "google-uid-1",
      info: { email: "player@example.com", name: "Player One" }
    )
    get "/auth/google_oauth2/callback"
    User.find_by!(email: "player@example.com")
  end

  describe "GET /achievements" do
    it "redirects to the login page when not authenticated" do
      get "/achievements"
      expect(response).to redirect_to("/auth/login")
    end

    it "renders the Achievements component with the full locked catalog for a user with no records" do
      log_in

      get "/achievements"

      expect_inertia.to render_component("Achievements")
      badges = inertia.props[:badges]
      expect(badges.size).to eq(17)
      expect(badges.map { |b| b[:unlocked] }).to all(be(false))
      expect(inertia.props[:categories]).to eq(%w[初級 精度 スピード 継続 特別])
      expect(inertia.props[:stats]).to eq("totalPlays" => 0, "currentStreak" => 0)
    end

    it "reflects unlocks and panel stats derived from the user's own records" do
      user = log_in
      create(:game_result, :random_result, user: user, accuracy: 96)
      create(:game_result, :random_result, user: user, accuracy: 80, created_at: 1.day.ago)
      create(:game_result, :random_result, score: 6000, accuracy: 100) # 別ユーザー

      get "/achievements"

      badges = inertia.props[:badges]
      first_play = badges.find { |b| b[:id] == "first_play" }
      expect(first_play[:unlocked]).to be(true)
      expect(first_play[:unlocked_at]).to be_present
      adept = badges.find { |b| b[:id] == "adept" }
      expect(adept[:unlocked]).to be(true)
      # 別ユーザーの 6000 点は混ざらない
      monument = badges.find { |b| b[:id] == "monument" }
      expect(monument[:unlocked]).to be(false)
      expect(inertia.props[:stats][:totalPlays]).to eq(2)
      expect(inertia.props[:stats][:currentStreak]).to eq(2)
    end
  end
end
