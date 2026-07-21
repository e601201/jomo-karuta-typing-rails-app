require "rails_helper"

RSpec.describe GameResult, type: :model do
  describe "validations" do
    it "is valid as a random result" do
      expect(build(:game_result, :random_result)).to be_valid
    end

    it "is valid as a timeattack result" do
      expect(build(:game_result, :timeattack_result)).to be_valid
    end

    it "requires a user" do
      expect(build(:game_result, user: nil)).not_to be_valid
    end

    it "requires score for random and forbids relying on time_ms" do
      result = build(:game_result, :random_result, score: nil)
      expect(result).not_to be_valid
      expect(result.errors[:score]).to be_present
    end

    it "requires time_ms for timeattack" do
      result = build(:game_result, :timeattack_result, time_ms: nil)
      expect(result).not_to be_valid
      expect(result.errors[:time_ms]).to be_present
    end

    it "requires accuracy within 0..100" do
      expect(build(:game_result, accuracy: nil)).not_to be_valid
      expect(build(:game_result, accuracy: -1)).not_to be_valid
      expect(build(:game_result, accuracy: 101)).not_to be_valid
      expect(build(:game_result, accuracy: 100)).to be_valid
    end

    it "requires non-negative wpm, max_combo and correct_cards" do
      expect(build(:game_result, wpm: nil)).not_to be_valid
      expect(build(:game_result, max_combo: nil)).not_to be_valid
      expect(build(:game_result, correct_cards: nil)).not_to be_valid
      expect(build(:game_result, wpm: -1)).not_to be_valid
    end
  end

  describe "enum scopes" do
    it "filters by game_mode" do
      user = create(:user)
      random = create(:game_result, :random_result, user: user)
      timeattack = create(:game_result, :timeattack_result, user: user)

      expect(GameResult.random).to eq([ random ])
      expect(GameResult.timeattack).to eq([ timeattack ])
    end
  end
end
