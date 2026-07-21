# NOTE: CSRF について — test 環境では allow_forgery_protection が false
# （config/environments/test.rb）のため、X-XSRF-TOKEN ヘッダなしで検証する。
# 本番では ApplicationController#verified_request? のヘッダ検証で通過する。
require "rails_helper"

RSpec.describe "Feedbacks", type: :request do
  def log_in_via_google(email: "player@example.com", name: "Player One", uid: "google-uid-1")
    OmniAuth.config.mock_auth[:google_oauth2] = OmniAuth::AuthHash.new(
      provider: "google_oauth2",
      uid: uid,
      info: { email: email, name: name, image: "https://example.com/avatar.png" }
    )
    get "/auth/google_oauth2/callback"
  end

  describe "GET /feedback" do
    # ゲスト用メニューからも辿れるため require_login を付けてはならない（/how-to-play と同じ方針）。
    # profiles_controller を写して認証を足す事故を防ぐ回帰テスト。
    it "renders the feedback form without authentication" do
      get "/feedback"

      expect(response).to have_http_status(:ok)
      expect_inertia.to render_component("Feedback")
    end
  end

  describe "POST /feedback" do
    let(:payload) do
      { category: "bug_report", subject: "スコア表示の不具合", body: "スコアが表示されません。", email: "" }
    end

    context "with a valid payload" do
      it "creates a feedback row and redirects back to the form" do
        expect {
          post "/feedback", params: payload
        }.to change(Feedback, :count).by(1)

        expect(response).to redirect_to("/feedback")

        feedback = Feedback.last
        expect(feedback.category).to eq("bug_report")
        expect(feedback.subject).to eq("スコア表示の不具合")
        expect(feedback.body).to eq("スコアが表示されません。")
        expect(feedback.email).to be_blank
      end

      it "keeps subject optional" do
        expect {
          post "/feedback", params: payload.merge(subject: "")
        }.to change(Feedback, :count).by(1)

        expect(Feedback.last.subject).to be_blank
      end

      it "stores user_id nil when logged out" do
        post "/feedback", params: payload

        expect(Feedback.last.user_id).to be_nil
      end

      it "stores the logged-in user's id" do
        log_in_via_google(email: "player@example.com")
        user = User.find_by!(email: "player@example.com")

        post "/feedback", params: payload

        expect(Feedback.last.user).to eq(user)
      end

      # user_id はサーバの session からのみ決まる（クライアントの申告は信用しない）
      it "ignores a client-supplied user_id" do
        other = create(:user)

        post "/feedback", params: payload.merge(user_id: other.id)

        expect(Feedback.last.user_id).to be_nil
      end

      it "keeps the optional email when provided" do
        post "/feedback", params: payload.merge(email: "player@example.com")

        expect(Feedback.last.email).to eq("player@example.com")
      end
    end

    context "with an invalid payload" do
      it "does not create when body is blank and redirects back" do
        expect {
          post "/feedback", params: payload.merge(body: "")
        }.not_to change(Feedback, :count)

        expect(response).to redirect_to("/feedback")
      end

      it "does not create when category is missing" do
        expect {
          post "/feedback", params: payload.merge(category: "")
        }.not_to change(Feedback, :count)

        expect(response).to redirect_to("/feedback")
      end

      it "does not raise and does not create for a tampered category value" do
        expect {
          post "/feedback", params: payload.merge(category: "bogus")
        }.not_to change(Feedback, :count)

        expect(response).to redirect_to("/feedback")
      end
    end

    context "with the honeypot filled (bot)" do
      it "silently discards the submission but responds as success" do
        expect {
          post "/feedback", params: payload.merge(website: "http://spam.example.com")
        }.not_to change(Feedback, :count)

        expect(response).to redirect_to("/feedback")
      end
    end
  end
end
