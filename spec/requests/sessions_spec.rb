require "rails_helper"

RSpec::Matchers.define_negated_matcher :not_change, :change

RSpec.describe "Sessions", type: :request, inertia: true do
  def mock_google_auth(email: "player@example.com", name: "Player One", uid: "google-uid-1")
    OmniAuth.config.mock_auth[:google_oauth2] = OmniAuth::AuthHash.new(
      provider: "google_oauth2",
      uid: uid,
      info: { email: email, name: name, image: "https://example.com/avatar.png" }
    )
  end

  def log_in_via_google(**options)
    mock_google_auth(**options)
    get "/auth/google_oauth2/callback"
  end

  describe "GET /auth/:provider/callback" do
    it "creates a user and identity, then redirects to root" do
      mock_google_auth

      expect {
        get "/auth/google_oauth2/callback"
      }.to change(User, :count).by(1).and change(Identity, :count).by(1)

      expect(response).to redirect_to(root_path)
    end

    it "logs the user in (shared auth props contain the user)" do
      log_in_via_google(email: "player@example.com")
      follow_redirect!

      get "/profile"
      expect_inertia.to render_component("Profile")
      expect(inertia.props[:auth][:user][:email]).to eq("player@example.com")
    end

    context "when the provider does not supply an email" do
      it "redirects to the auth error page with email_unavailable" do
        OmniAuth.config.mock_auth[:github] = OmniAuth::AuthHash.new(
          provider: "github",
          uid: "github-uid-1",
          info: { nickname: "octocat" }
        )

        expect {
          get "/auth/github/callback"
        }.to not_change(User, :count).and not_change(Identity, :count)

        expect(response).to redirect_to("/auth/error?message=email_unavailable")
      end
    end
  end

  describe "GET /auth/login" do
    it "renders the login page when not logged in" do
      get "/auth/login"
      expect_inertia.to render_component("auth/Login")
    end

    it "redirects to /profile when already logged in" do
      log_in_via_google

      get "/auth/login"
      expect(response).to redirect_to("/profile")
    end
  end

  describe "GET /auth/error" do
    it "renders the auth error page with the message prop" do
      get "/auth/error", params: { message: "invalid_credentials" }

      expect_inertia.to render_component("auth/Error")
      expect(inertia.props[:message]).to eq("invalid_credentials")
    end
  end

  describe "DELETE /auth/logout" do
    it "clears the session and redirects to root" do
      log_in_via_google

      delete "/auth/logout"
      expect(response).to redirect_to(root_path)

      get "/profile"
      expect(response).to redirect_to("/auth/login")
    end
  end
end
