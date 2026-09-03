require "rails_helper"

RSpec.describe "Admin::Feedbacks", type: :request do
  def with_admin_emails(value)
    original = ENV["ADMIN_EMAILS"]
    if value.nil?
      ENV.delete("ADMIN_EMAILS")
    else
      ENV["ADMIN_EMAILS"] = value
    end
    yield
  ensure
    if original.nil?
      ENV.delete("ADMIN_EMAILS")
    else
      ENV["ADMIN_EMAILS"] = original
    end
  end

  def log_in(email: "player@example.com", name: "Player One", uid: "google-uid-1")
    OmniAuth.config.mock_auth[:google_oauth2] = OmniAuth::AuthHash.new(
      provider: "google_oauth2",
      uid: uid,
      info: { email: email, name: name }
    )
    get "/auth/google_oauth2/callback"
    User.find_by!(email: email)
  end

  def log_in_as_admin(email: "admin@example.com")
    with_admin_emails(email) do
      log_in(email: email, name: "Operator", uid: "admin-uid-1")
      yield
    end
  end

  describe "GET /admin/feedbacks" do
    it "returns 404 when not logged in (does not redirect to login)" do
      get "/admin/feedbacks"

      expect(response).to have_http_status(:not_found)
      expect(response).not_to redirect_to("/auth/login")
    end

    it "returns 404 for a logged-in non-admin" do
      with_admin_emails("admin@example.com") do
        log_in(email: "player@example.com")

        get "/admin/feedbacks"

        expect(response).to have_http_status(:not_found)
      end
    end

    it "returns 404 when ADMIN_EMAILS is unset even for a previously allowlisted email" do
      log_in(email: "admin@example.com", uid: "was-admin")

      with_admin_emails(nil) do
        get "/admin/feedbacks"

        expect(response).to have_http_status(:not_found)
      end
    end

    it "renders the admin list for an allowlisted user" do
      log_in_as_admin do
        get "/admin/feedbacks"

        expect(response).to have_http_status(:ok)
        expect(response.headers["Cache-Control"]).to include("no-store")
        expect_inertia.to render_component("admin/Feedbacks")
        expect(inertia.props[:auth][:is_admin]).to eq(true)
        expect(inertia.props[:categories]).to eq(Feedback.categories.keys)
        expect(inertia.props[:category]).to be_nil
        expect(inertia.props[:page]).to eq(1)
        expect(inertia.props[:perPage]).to eq(Admin::FeedbacksController::PER_PAGE)
        expect(inertia.props[:total]).to eq(0)
        expect(inertia.props[:feedbacks]).to eq([])
      end
    end

    it "exposes auth.is_admin as false for a regular user on a public page" do
      log_in(email: "player@example.com")

      get "/feedback"

      expect(response).to have_http_status(:ok)
      expect_inertia.to render_component("Feedback")
      expect(inertia.props[:auth][:is_admin]).to eq(false)
    end

    it "lists newest first and breaks ties by id descending" do
      log_in_as_admin do
        older = create(:feedback, body: "古い", created_at: 2.days.ago)
        same_time = Time.zone.parse("2026-01-15 12:00:00")
        first_same = create(:feedback, body: "同一秒・先", created_at: same_time)
        second_same = create(:feedback, body: "同一秒・後", created_at: same_time)
        newest = create(:feedback, body: "新しい", created_at: 1.hour.ago)

        get "/admin/feedbacks"

        ids = inertia.props[:feedbacks].map { |row| row["id"] }
        expect(ids).to eq([ newest.id, second_same.id, first_same.id, older.id ])
      end
    end

    it "whitelists row keys and sender fields" do
      log_in_as_admin do
        guest = create(:feedback, user: nil, email: "reply@example.com", subject: "件名")
        sender = create(:user, email: "sender@example.com", nickname: "送り主")
        create(:feedback, user: sender, email: "other-reply@example.com")

        get "/admin/feedbacks"

        rows = inertia.props[:feedbacks]
        expect(rows.first.keys).to match_array(%w[id category subject body email created_at user])

        guest_row = rows.find { |row| row["id"] == guest.id }
        expect(guest_row["user"]).to be_nil
        expect(guest_row["email"]).to eq("reply@example.com")

        account_row = rows.find { |row| row["id"] != guest.id }
        expect(account_row["user"].keys).to match_array(%w[id nickname email])
        expect(account_row["user"]["email"]).to eq("sender@example.com")
        expect(account_row["user"]["nickname"]).to eq("送り主")
        expect(account_row["user"]).not_to have_key("avatar_url")
      end
    end

    it "filters by category and ignores unknown values" do
      log_in_as_admin do
        bug = create(:feedback, category: "bug_report", body: "バグ")
        create(:feedback, category: "other", body: "その他")

        get "/admin/feedbacks", params: { category: "bug_report" }

        expect(inertia.props[:category]).to eq("bug_report")
        expect(inertia.props[:total]).to eq(1)
        expect(inertia.props[:feedbacks].map { |row| row["id"] }).to eq([ bug.id ])

        get "/admin/feedbacks", params: { category: "bogus" }

        expect(response).to have_http_status(:ok)
        expect(inertia.props[:category]).to be_nil
        expect(inertia.props[:total]).to eq(2)
      end
    end

    it "paginates 50 per page and keeps the filter" do
      log_in_as_admin do
        create_list(:feedback, 51, category: "other")
        create(:feedback, category: "bug_report", body: "別種類")

        get "/admin/feedbacks", params: { category: "other", page: 1 }

        expect(inertia.props[:feedbacks].size).to eq(50)
        expect(inertia.props[:total]).to eq(51)
        expect(inertia.props[:page]).to eq(1)

        get "/admin/feedbacks", params: { category: "other", page: 2 }

        expect(inertia.props[:feedbacks].size).to eq(1)
        expect(inertia.props[:total]).to eq(51)
        expect(inertia.props[:page]).to eq(2)
        expect(inertia.props[:feedbacks].sole["category"]).to eq("other")

        get "/admin/feedbacks", params: { page: 0 }

        expect(inertia.props[:page]).to eq(1)

        get "/admin/feedbacks", params: { page: -1 }

        expect(inertia.props[:page]).to eq(1)

        get "/admin/feedbacks", params: { page: "abc" }

        expect(inertia.props[:page]).to eq(1)

        get "/admin/feedbacks", params: { page: 999 }

        expect(response).to have_http_status(:ok)
        expect(inertia.props[:feedbacks]).to eq([])
        expect(inertia.props[:total]).to eq(52)
      end
    end
  end
end
