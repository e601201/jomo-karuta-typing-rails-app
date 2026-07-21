require "rails_helper"

RSpec.describe "Profiles", type: :request do
  describe "GET /profile" do
    it "redirects to the login page when not authenticated" do
      get "/profile"
      expect(response).to redirect_to("/auth/login")
    end

    it "renders the profile page when authenticated" do
      OmniAuth.config.mock_auth[:google_oauth2] = OmniAuth::AuthHash.new(
        provider: "google_oauth2",
        uid: "google-uid-1",
        info: { email: "player@example.com", name: "Player One" }
      )
      get "/auth/google_oauth2/callback"

      get "/profile"
      expect_inertia.to render_component("Profile")
      expect(inertia.props[:auth][:user][:email]).to eq("player@example.com")
    end

    it "shares the user's best scores (from all play records) with achieved difficulty" do
      OmniAuth.config.mock_auth[:google_oauth2] = OmniAuth::AuthHash.new(
        provider: "google_oauth2",
        uid: "google-uid-1",
        info: { email: "player@example.com", name: "Player One" }
      )
      get "/auth/google_oauth2/callback"

      user = User.find_by!(email: "player@example.com")
      create(:game_result, :random_result, user: user, score: 1200, difficulty: "advanced")
      create(:game_result, :random_result, user: user, score: 800, difficulty: "standard")
      create(:game_result, :timeattack_result, user: user, time_ms: 30_000, difficulty: "beginner")

      get "/profile"
      expect(inertia.props[:best_scores]).to eq(
        "random" => { "score" => 1200, "difficulty" => "advanced" },
        "timeattack" => { "time_ms" => 30_000, "difficulty" => "beginner" }
      )
    end
  end
end
