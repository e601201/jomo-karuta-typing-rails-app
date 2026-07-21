# NOTE: CSRF について — test 環境では allow_forgery_protection が false のため、
# X-XSRF-TOKEN ヘッダなしでハッピーパスを検証する（api_scores_spec と同じ）。
require "rails_helper"

RSpec.describe "Api::GameResults", type: :request do
  def log_in_via_google(email: "player@example.com", name: "Player One", uid: "google-uid-1")
    OmniAuth.config.mock_auth[:google_oauth2] = OmniAuth::AuthHash.new(
      provider: "google_oauth2",
      uid: uid,
      info: { email: email, name: name, image: "https://example.com/avatar.png" }
    )
    get "/auth/google_oauth2/callback"
  end

  let(:random_payload) do
    { game_mode: "random", difficulty: "standard", score: 1200,
      accuracy: 96, wpm: 62, max_combo: 15, correct_cards: 10 }
  end
  let(:timeattack_payload) do
    { game_mode: "timeattack", difficulty: "advanced", time: 30_000,
      accuracy: 88, wpm: 70, max_combo: 9, correct_cards: 8 }
  end

  describe "POST /api/game_results" do
    context "when logged in" do
      before { log_in_via_google }

      it "creates a random play record tied to the current user" do
        expect {
          post "/api/game_results", params: random_payload, as: :json
        }.to change(GameResult, :count).by(1)

        expect(response).to have_http_status(:created)
        expect(response.parsed_body).to eq({ "success" => true })

        result = GameResult.last
        expect(result.user).to eq(User.last)
        expect(result).to have_attributes(
          game_mode: "random", difficulty: "standard", score: 1200,
          time_ms: nil, accuracy: 96, wpm: 62, max_combo: 15, correct_cards: 10
        )
      end

      it "maps 'time' to time_ms for timeattack" do
        post "/api/game_results", params: timeattack_payload, as: :json

        expect(response).to have_http_status(:created)
        result = GameResult.last
        expect(result).to have_attributes(game_mode: "timeattack", time_ms: 30_000, score: nil)
      end

      it "returns 422 for an invalid payload (random without score)" do
        expect {
          post "/api/game_results", params: random_payload.merge(score: nil), as: :json
        }.not_to change(GameResult, :count)

        expect(response).to have_http_status(:unprocessable_entity)
        expect(response.parsed_body["success"]).to be(false)
      end

      it "returns 422 for an invalid enum value" do
        post "/api/game_results", params: random_payload.merge(game_mode: "bogus"), as: :json

        expect(response).to have_http_status(:unprocessable_entity)
        expect(response.parsed_body["success"]).to be(false)
      end
    end

    context "when logged out" do
      it "rejects with 401 and creates nothing" do
        expect {
          post "/api/game_results", params: random_payload, as: :json
        }.not_to change(GameResult, :count)

        expect(response).to have_http_status(:unauthorized)
        expect(response.parsed_body["success"]).to be(false)
      end
    end
  end
end
