require "rails_helper"

RSpec.describe "Profiles", type: :request, inertia: true do
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
  end
end
