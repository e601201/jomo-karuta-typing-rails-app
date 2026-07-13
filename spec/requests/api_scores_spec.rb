# NOTE: CSRF について — test 環境では ActionController::Base.allow_forgery_protection が
# false（config/environments/test.rb）のため、X-XSRF-TOKEN ヘッダなしでハッピーパスを検証する。
# 本番では ApplicationController#verified_request? の X-XSRF-TOKEN ヘッダ検証で通過する。
require "rails_helper"

RSpec.describe "Api::Scores", type: :request do
  describe "POST /api/scores" do
    context "with a valid random payload" do
      let(:payload) do
        { nick_name: "太郎", difficulty: "standard", score: 1200, game_mode: "random" }
      end

      it "creates a score row and returns success" do
        expect {
          post "/api/scores", params: payload, as: :json
        }.to change(Score, :count).by(1)

        expect(response).to have_http_status(:created)
        expect(response.parsed_body).to eq({ "success" => true })

        score = Score.last
        expect(score.nick_name).to eq("太郎")
        expect(score.difficulty).to eq("standard")
        expect(score.game_mode).to eq("random")
        expect(score.score).to eq(1200)
        expect(score.time_ms).to be_nil
      end

      it "stores user_id nil when logged out" do
        post "/api/scores", params: payload, as: :json

        expect(response).to have_http_status(:created)
        expect(Score.last.user_id).to be_nil
      end
    end

    context "with a valid timeattack payload" do
      it "maps time to time_ms" do
        expect {
          post "/api/scores",
               params: { nick_name: "花子", difficulty: "advanced", time: 45_230, game_mode: "timeattack" },
               as: :json
        }.to change(Score, :count).by(1)

        expect(response).to have_http_status(:created)
        expect(response.parsed_body).to eq({ "success" => true })

        score = Score.last
        expect(score.game_mode).to eq("timeattack")
        expect(score.difficulty).to eq("advanced")
        expect(score.time_ms).to eq(45_230)
        expect(score.score).to be_nil
      end
    end

    context "with an invalid payload" do
      it "returns 422 with success false when nick_name is blank" do
        expect {
          post "/api/scores",
               params: { nick_name: "", difficulty: "standard", score: 100, game_mode: "random" },
               as: :json
        }.not_to change(Score, :count)

        expect(response).to have_http_status(422)
        body = response.parsed_body
        expect(body["success"]).to be(false)
        expect(body["error"]).to be_present
      end

      it "returns 422 when a random payload is missing score" do
        post "/api/scores",
             params: { nick_name: "太郎", difficulty: "standard", game_mode: "random" },
             as: :json

        expect(response).to have_http_status(422)
        expect(response.parsed_body["success"]).to be(false)
      end

      it "returns 422 when game_mode is not a valid enum value" do
        post "/api/scores",
             params: { nick_name: "太郎", difficulty: "standard", score: 100, game_mode: "bogus" },
             as: :json

        expect(response).to have_http_status(422)
        expect(response.parsed_body["success"]).to be(false)
      end
    end
  end
end
