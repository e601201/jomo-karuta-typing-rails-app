require "rails_helper"

RSpec.describe "Histories", type: :request do
  def log_in
    OmniAuth.config.mock_auth[:google_oauth2] = OmniAuth::AuthHash.new(
      provider: "google_oauth2",
      uid: "google-uid-1",
      info: { email: "player@example.com", name: "Player One" }
    )
    get "/auth/google_oauth2/callback"
    User.find_by!(email: "player@example.com")
  end

  describe "GET /history" do
    it "redirects to the login page when not authenticated" do
      get "/history"
      expect(response).to redirect_to("/auth/login")
    end

    it "renders the History component with an empty summary for a user with no records" do
      log_in

      get "/history"

      expect_inertia.to render_component("History")
      summary = inertia.props[:summary]
      expect(summary[:totalPlays]).to eq(0)
      expect(summary[:bestScore]).to be_nil
      expect(summary[:bestTime]).to be_nil
      expect(summary[:averageAccuracy]).to be_nil
      expect(inertia.props[:records]).to eq([])
    end

    it "summarizes across all plays and returns whitelisted record fields" do
      user = log_in
      create(:game_result, :random_result, user: user, score: 1200, difficulty: "advanced", accuracy: 90)
      create(:game_result, :random_result, user: user, score: 800, difficulty: "beginner", accuracy: 100)
      create(:game_result, :timeattack_result, user: user, time_ms: 30_000, difficulty: "standard", accuracy: 80)

      get "/history"

      summary = inertia.props[:summary]
      expect(summary[:totalPlays]).to eq(3)
      expect(summary[:bestScore]).to eq("score" => 1200, "difficulty" => "advanced")
      expect(summary[:bestTime]).to eq("time_ms" => 30_000, "difficulty" => "standard")
      expect(summary[:averageAccuracy]).to eq(90) # (90 + 100 + 80) / 3

      records = inertia.props[:records]
      expect(records.size).to eq(3)
      expect(records.first.keys).to match_array(
        %w[id game_mode difficulty score time_ms accuracy max_combo created_at]
      )
    end

    it "ignores other users' records" do
      log_in
      create(:game_result, :random_result, score: 5000) # 別ユーザー

      get "/history"

      expect(inertia.props[:summary][:totalPlays]).to eq(0)
      expect(inertia.props[:records]).to eq([])
    end

    it "returns records newest first and caps at the recent limit" do
      user = log_in
      limit = HistoriesController::RECENT_LIMIT
      oldest = create(:game_result, :random_result, user: user, created_at: (limit + 5).minutes.ago)
      create_list(:game_result, limit, :random_result, user: user)

      get "/history"

      records = inertia.props[:records]
      expect(records.size).to eq(limit)
      expect(records.map { |r| r["id"] }).not_to include(oldest.id)
      expect(inertia.props[:summary][:totalPlays]).to eq(limit + 1)
      expect(inertia.props[:recentLimit]).to eq(limit)
    end
  end
end
