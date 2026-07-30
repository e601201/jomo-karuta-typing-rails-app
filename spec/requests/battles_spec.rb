require "rails_helper"

RSpec.describe "Battles", type: :request do
  def log_in
    OmniAuth.config.mock_auth[:google_oauth2] = OmniAuth::AuthHash.new(
      provider: "google_oauth2",
      uid: "google-uid-1",
      info: { email: "player@example.com", name: "Player One" }
    )
    get "/auth/google_oauth2/callback"
    User.find_by!(email: "player@example.com")
  end

  describe "GET /battle/:id" do
    it "redirects to the login page when not authenticated" do
      room = create(:battle_room, :matched)

      get "/battle/#{room.id}"

      expect(response).to redirect_to("/auth/login")
    end

    it "renders the Battle component with the room props for a participant" do
      me = log_in
      room = create(:battle_room, :matched, host: me)

      get "/battle/#{room.id}"

      expect_inertia.to render_component("Battle")
      expect(inertia.props[:room]).to include(
        id: room.id,
        gameMode: "random",
        deck: room.deck,
        hostId: me.id,
        guestId: room.guest_id
      )
    end

    it "redirects home for a non-participant" do
      log_in
      room = create(:battle_room, :matched)

      get "/battle/#{room.id}"

      expect(response).to redirect_to("/")
    end

    it "redirects home while the room is still waiting" do
      me = log_in
      room = create(:battle_room, host: me)

      get "/battle/#{room.id}"

      expect(response).to redirect_to("/")
    end

    it "redirects home once the room is finished" do
      me = log_in
      room = create(:battle_room, :matched, host: me)
      room.update!(status: :finished)

      get "/battle/#{room.id}"

      expect(response).to redirect_to("/")
    end

    it "redirects home for an unknown room id" do
      log_in

      get "/battle/0"

      expect(response).to redirect_to("/")
    end
  end
end
