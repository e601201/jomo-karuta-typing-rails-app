require "rails_helper"

RSpec.describe KarutaDeck do
  describe ".card_ids" do
    it "loads all 44 unique card ids from the frontend JSON" do
      expect(described_class.card_ids.length).to eq(44)
      expect(described_class.card_ids.uniq.length).to eq(44)
    end
  end

  describe ".build" do
    it "builds a random deck as a permutation of all cards" do
      deck = described_class.build("random")
      expect(deck.sort).to eq(described_class.card_ids.sort)
    end

    it "builds a timeattack deck of 10 distinct cards" do
      deck = described_class.build("timeattack")
      expect(deck.length).to eq(10)
      expect(deck.uniq.length).to eq(10)
      expect(deck - described_class.card_ids).to be_empty
    end

    it "raises ArgumentError for an unknown mode" do
      expect { described_class.build("battle") }.to raise_error(ArgumentError)
    end
  end
end
