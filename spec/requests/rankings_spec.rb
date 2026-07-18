require "rails_helper"

RSpec.describe "Rankings", type: :request, inertia: true do
  describe "GET /ranking" do
    it "renders the Ranking component with default params" do
      get "/ranking"

      expect(response).to have_http_status(:ok)
      expect_inertia.to render_component("Ranking")
      expect(inertia.props[:gameMode]).to eq("random")
      expect(inertia.props[:difficulty]).to eq("standard")
      expect(inertia.props[:entries]).to eq([])
      # ゲストにベストスコアは存在しない
      expect(inertia.props[:best_scores]).to be_nil
    end

    it "accepts valid game_mode and difficulty params" do
      get "/ranking", params: { game_mode: "timeattack", difficulty: "advanced" }

      expect_inertia.to render_component("Ranking")
      expect(inertia.props[:gameMode]).to eq("timeattack")
      expect(inertia.props[:difficulty]).to eq("advanced")
    end

    it "falls back to defaults for invalid params" do
      get "/ranking", params: { game_mode: "bogus", difficulty: "nightmare" }

      expect_inertia.to render_component("Ranking")
      expect(inertia.props[:gameMode]).to eq("random")
      expect(inertia.props[:difficulty]).to eq("standard")
    end

    it "returns random-mode entries ordered by score desc with the whitelisted attributes" do
      low = create(:score, :random_score, score: 100, nick_name: "二位")
      high = create(:score, :random_score, score: 300, nick_name: "一位")
      create(:score, :random_score, score: 999, difficulty: "beginner")
      create(:score, :timeattack_score, time_ms: 10_000)

      get "/ranking", params: { game_mode: "random", difficulty: "standard" }

      entries = inertia.props[:entries]
      expect(entries.map { |e| e[:id] }).to eq([ high.id, low.id ])
      expect(entries.first.keys).to match_array(%w[id nick_name score time_ms difficulty game_mode created_at])
      expect(entries.first[:nick_name]).to eq("一位")
      expect(entries.first[:score]).to eq(300)
      expect(entries.first[:game_mode]).to eq("random")
      expect(entries.first[:difficulty]).to eq("standard")
    end

    it "returns timeattack entries ordered by time_ms asc" do
      slow = create(:score, :timeattack_score, time_ms: 60_000)
      fast = create(:score, :timeattack_score, time_ms: 20_000)
      create(:score, :random_score, score: 100)

      get "/ranking", params: { game_mode: "timeattack", difficulty: "standard" }

      entries = inertia.props[:entries]
      expect(entries.map { |e| e[:id] }).to eq([ fast.id, slow.id ])
      expect(entries.first[:time_ms]).to eq(20_000)
      expect(entries.first[:game_mode]).to eq("timeattack")
    end
  end
end
