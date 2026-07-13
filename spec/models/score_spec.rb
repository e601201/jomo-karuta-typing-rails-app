require "rails_helper"

RSpec.describe Score, type: :model do
  describe "validations" do
    describe "nick_name" do
      it "is invalid when blank" do
        score = build(:score, :random_score, nick_name: "")
        expect(score).not_to be_valid
        expect(score.errors[:nick_name]).to be_present
      end

      it "is valid with exactly 20 characters" do
        score = build(:score, :random_score, nick_name: "あ" * 20)
        expect(score).to be_valid
      end

      it "is invalid with 21 characters" do
        score = build(:score, :random_score, nick_name: "あ" * 21)
        expect(score).not_to be_valid
        expect(score.errors[:nick_name]).to be_present
      end
    end

    context "when game_mode is random" do
      it "is valid with a non-negative integer score" do
        expect(build(:score, :random_score, score: 0)).to be_valid
        expect(build(:score, :random_score, score: 12_345)).to be_valid
      end

      it "is invalid without a score" do
        score = build(:score, :random_score, score: nil)
        expect(score).not_to be_valid
        expect(score.errors[:score]).to be_present
      end

      it "is invalid with a negative score" do
        score = build(:score, :random_score, score: -1)
        expect(score).not_to be_valid
        expect(score.errors[:score]).to be_present
      end

      it "does not require time_ms" do
        expect(build(:score, :random_score, time_ms: nil)).to be_valid
      end
    end

    context "when game_mode is timeattack" do
      it "is valid with a positive integer time_ms" do
        expect(build(:score, :timeattack_score, time_ms: 1)).to be_valid
        expect(build(:score, :timeattack_score, time_ms: 45_230)).to be_valid
      end

      it "is invalid without time_ms" do
        score = build(:score, :timeattack_score, time_ms: nil)
        expect(score).not_to be_valid
        expect(score.errors[:time_ms]).to be_present
      end

      it "is invalid with a zero time_ms" do
        score = build(:score, :timeattack_score, time_ms: 0)
        expect(score).not_to be_valid
        expect(score.errors[:time_ms]).to be_present
      end

      it "does not require score" do
        expect(build(:score, :timeattack_score, score: nil)).to be_valid
      end
    end
  end

  describe ".score_leaderboard" do
    it "orders by score desc" do
      low = create(:score, :random_score, score: 100)
      high = create(:score, :random_score, score: 300)
      mid = create(:score, :random_score, score: 200)

      expect(Score.score_leaderboard("standard")).to eq([ high, mid, low ])
    end

    it "breaks ties by created_at asc (earlier submission wins)" do
      later = create(:score, :random_score, score: 100, created_at: Time.zone.parse("2026-07-02 00:00:00"))
      earlier = create(:score, :random_score, score: 100, created_at: Time.zone.parse("2026-07-01 00:00:00"))

      expect(Score.score_leaderboard("standard")).to eq([ earlier, later ])
    end

    it "filters by difficulty and random game_mode" do
      standard = create(:score, :random_score, difficulty: "standard")
      create(:score, :random_score, difficulty: "beginner")
      create(:score, :timeattack_score, difficulty: "standard")

      expect(Score.score_leaderboard("standard")).to eq([ standard ])
    end

    it "limits the results to 100 entries" do
      101.times { |i| create(:score, :random_score, score: i) }

      leaderboard = Score.score_leaderboard("standard")
      expect(leaderboard.size).to eq(100)
      # 最下位スコア（0）が切り落とされる
      expect(leaderboard.map(&:score)).not_to include(0)
    end
  end

  describe ".time_leaderboard" do
    it "orders by time_ms asc" do
      slow = create(:score, :timeattack_score, time_ms: 60_000)
      fast = create(:score, :timeattack_score, time_ms: 20_000)
      mid = create(:score, :timeattack_score, time_ms: 40_000)

      expect(Score.time_leaderboard("standard")).to eq([ fast, mid, slow ])
    end

    it "breaks ties by created_at asc (earlier submission wins)" do
      later = create(:score, :timeattack_score, time_ms: 30_000, created_at: Time.zone.parse("2026-07-02 00:00:00"))
      earlier = create(:score, :timeattack_score, time_ms: 30_000, created_at: Time.zone.parse("2026-07-01 00:00:00"))

      expect(Score.time_leaderboard("standard")).to eq([ earlier, later ])
    end

    it "filters by difficulty and timeattack game_mode" do
      advanced = create(:score, :timeattack_score, difficulty: "advanced")
      create(:score, :timeattack_score, difficulty: "standard")
      create(:score, :random_score, difficulty: "advanced")

      expect(Score.time_leaderboard("advanced")).to eq([ advanced ])
    end

    it "limits the results to 100 entries" do
      101.times { |i| create(:score, :timeattack_score, time_ms: 10_000 + i) }

      leaderboard = Score.time_leaderboard("standard")
      expect(leaderboard.size).to eq(100)
      # 最も遅いタイムが切り落とされる
      expect(leaderboard.map(&:time_ms)).not_to include(10_100)
    end
  end
end
