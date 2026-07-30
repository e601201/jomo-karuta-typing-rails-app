# NOTE: CSRF について — test 環境では allow_forgery_protection が false のため、
# X-XSRF-TOKEN ヘッダなしでハッピーパスを検証する（api_scores_spec と同じ）。
require "rails_helper"

RSpec.describe "Api::BattleRooms", type: :request do
  include ActionCable::TestHelper

  def log_in_via_google(email: "player@example.com", name: "Player One", uid: "google-uid-1")
    OmniAuth.config.mock_auth[:google_oauth2] = OmniAuth::AuthHash.new(
      provider: "google_oauth2",
      uid: uid,
      info: { email: email, name: name, image: "https://example.com/avatar.png" }
    )
    get "/auth/google_oauth2/callback"
  end

  describe "POST /api/battle_rooms" do
    it "returns 401 when logged out" do
      post "/api/battle_rooms", params: { game_mode: "random", passphrase: "gunma" }, as: :json

      expect(response).to have_http_status(:unauthorized)
    end

    context "when logged in" do
      before { log_in_via_google }

      let(:me) { User.find_by!(email: "player@example.com") }

      it "creates a waiting room" do
        expect {
          post "/api/battle_rooms", params: { game_mode: "random", passphrase: "gunma" }, as: :json
        }.to change(BattleRoom, :count).by(1)

        expect(response).to have_http_status(:created)
        expect(response.parsed_body).to include("success" => true, "status" => "waiting")

        room = BattleRoom.last
        expect(room).to have_attributes(passphrase: "gunma", status: "waiting", host: me, deck: [])
        expect(response.parsed_body.dig("room", "id")).to eq(room.id)
      end

      it "matches another user's waiting room and broadcasts matched to it" do
        room = create(:battle_room, game_mode: "random", passphrase: "gunma")

        expect {
          post "/api/battle_rooms", params: { game_mode: "random", passphrase: "gunma" }, as: :json
        }.to have_broadcasted_to(room).from_channel(BattleChannel).with(a_hash_including("type" => "matched"))

        expect(response.parsed_body).to include("status" => "matched")
        expect(room.reload).to have_attributes(status: "matched", guest: me)
        expect(room.deck.length).to eq(44)
      end

      it "creates a fresh waiting room when the same key is already matched" do
        create(:battle_room, :matched, game_mode: "random", passphrase: "gunma")

        expect {
          post "/api/battle_rooms", params: { game_mode: "random", passphrase: "gunma" }, as: :json
        }.to change(BattleRoom, :count).by(1)

        expect(response.parsed_body).to include("status" => "waiting")
      end

      it "rejects a blank passphrase with 422" do
        post "/api/battle_rooms", params: { game_mode: "random", passphrase: "  " }, as: :json

        expect(response).to have_http_status(:unprocessable_entity)
        expect(response.parsed_body["success"]).to be(false)
      end

      it "rejects an unknown game_mode with 422" do
        post "/api/battle_rooms", params: { game_mode: "battle", passphrase: "gunma" }, as: :json

        expect(response).to have_http_status(:unprocessable_entity)
      end
    end
  end

  describe "DELETE /api/battle_rooms/:id" do
    it "returns 401 when logged out" do
      room = create(:battle_room)

      delete "/api/battle_rooms/#{room.id}"

      expect(response).to have_http_status(:unauthorized)
    end

    context "when logged in" do
      before { log_in_via_google }

      let(:me) { User.find_by!(email: "player@example.com") }

      it "cancels my waiting room" do
        room = create(:battle_room, host: me)

        delete "/api/battle_rooms/#{room.id}"

        expect(response).to have_http_status(:no_content)
        expect(room.reload.status).to eq("canceled")
      end

      it "returns 409 with the room id when the room is already matched" do
        room = create(:battle_room, :matched, host: me)

        delete "/api/battle_rooms/#{room.id}"

        expect(response).to have_http_status(:conflict)
        expect(response.parsed_body).to include("status" => "matched")
        expect(response.parsed_body.dig("room", "id")).to eq(room.id)
        expect(room.reload.status).to eq("matched")
      end

      it "returns 404 for another user's room" do
        room = create(:battle_room)

        delete "/api/battle_rooms/#{room.id}"

        expect(response).to have_http_status(:not_found)
        expect(room.reload.status).to eq("waiting")
      end
    end
  end
end
