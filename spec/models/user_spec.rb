require "rails_helper"

RSpec::Matchers.define_negated_matcher :not_change, :change

RSpec.describe User, type: :model do
  def build_auth(provider: "google_oauth2", uid: "uid-123", email: "taro@example.com",
                 name: "Taro Gunma", nickname: nil, image: nil)
    OmniAuth::AuthHash.new(
      provider: provider,
      uid: uid,
      info: { email: email, name: name, nickname: nickname, image: image }
    )
  end

  describe "validations" do
    it "is valid with an email" do
      expect(build(:user)).to be_valid
    end

    it "requires an email" do
      user = build(:user, email: nil)
      expect(user).not_to be_valid
      expect(user.errors[:email]).to be_present
    end

    it "requires a unique email" do
      create(:user, email: "taro@example.com")
      user = build(:user, email: "taro@example.com")
      expect(user).not_to be_valid
      expect(user.errors[:email]).to be_present
    end
  end

  describe "associations" do
    it "has many scores" do
      user = create(:user)
      mine = create(:score, :random_score, user: user)
      create(:score, :random_score)

      expect(user.scores).to eq([ mine ])
    end

    it "nullifies scores on destroy so leaderboard entries survive" do
      user = create(:user)
      score = create(:score, :random_score, user: user)

      expect { user.destroy! }.not_to change(Score, :count)
      expect(score.reload.user_id).to be_nil
    end
  end

  describe "#best_scores" do
    it "returns nil for both modes when the user has no scores" do
      user = create(:user)

      expect(user.best_scores).to eq(random: nil, timeattack: nil)
    end

    it "returns the highest score for random and the lowest time for timeattack, with their difficulties" do
      user = create(:user)
      create(:score, :random_score, user: user, score: 800, difficulty: "beginner")
      create(:score, :random_score, user: user, score: 1200, difficulty: "advanced")
      create(:score, :timeattack_score, user: user, time_ms: 45_000, difficulty: "standard")
      create(:score, :timeattack_score, user: user, time_ms: 30_000, difficulty: "beginner")

      expect(user.best_scores).to eq(
        random: { score: 1200, difficulty: "advanced" },
        timeattack: { time_ms: 30_000, difficulty: "beginner" }
      )
    end

    it "ignores other users' scores" do
      user = create(:user)
      create(:score, :random_score, score: 9999)
      create(:score, :timeattack_score, time_ms: 1)

      expect(user.best_scores).to eq(random: nil, timeattack: nil)
    end

    it "breaks ties by created_at like the leaderboard (first achiever wins)" do
      user = create(:user)
      first = create(:score, :random_score, user: user, score: 1000, difficulty: "beginner",
                     created_at: 2.days.ago)
      create(:score, :random_score, user: user, score: 1000, difficulty: "advanced",
             created_at: 1.day.ago)

      expect(user.best_scores[:random]).to eq(score: 1000, difficulty: first.difficulty)
    end
  end

  describe ".from_omniauth" do
    context "when an identity already exists for provider/uid" do
      it "returns the identity's user without creating records" do
        identity = create(:identity, provider: "google_oauth2", uid: "uid-123")

        result = nil
        expect {
          result = described_class.from_omniauth(build_auth(uid: "uid-123"))
        }.to not_change(described_class, :count).and not_change(Identity, :count)

        expect(result).to eq(identity.user)
      end
    end

    context "when a user with the same email exists" do
      it "attaches a new identity to that user" do
        user = create(:user, email: "taro@example.com")

        result = nil
        expect {
          result = described_class.from_omniauth(build_auth(provider: "github", uid: "gh-1"))
        }.to change(Identity, :count).by(1).and not_change(described_class, :count)

        expect(result).to eq(user)
        expect(user.identities.last).to have_attributes(provider: "github", uid: "gh-1")
      end
    end

    context "when neither identity nor user exists" do
      it "creates a user and an identity" do
        result = nil
        expect {
          result = described_class.from_omniauth(
            build_auth(email: "new@example.com", name: "New Player", image: "https://example.com/a.png")
          )
        }.to change(described_class, :count).by(1).and change(Identity, :count).by(1)

        expect(result).to have_attributes(
          email: "new@example.com",
          nickname: "New Player",
          avatar_url: "https://example.com/a.png"
        )
        expect(result.identities.sole).to have_attributes(provider: "google_oauth2", uid: "uid-123")
      end

      it "falls back to auth.info.nickname when name is missing" do
        result = described_class.from_omniauth(
          build_auth(email: "octo@example.com", name: nil, nickname: "octocat")
        )
        expect(result.nickname).to eq("octocat")
      end
    end

    context "when the provider does not supply an email" do
      it "raises EmailUnavailableError and creates nothing" do
        expect {
          expect {
            described_class.from_omniauth(build_auth(provider: "github", email: nil, name: nil, nickname: nil))
          }.to raise_error(User::EmailUnavailableError)
        }.to not_change(described_class, :count).and not_change(Identity, :count)
      end
    end
  end
end
