require "rails_helper"

RSpec.describe Feedback, type: :model do
  describe "validations" do
    describe "body" do
      it "is invalid when blank" do
        feedback = build(:feedback, body: "")
        expect(feedback).not_to be_valid
        expect(feedback.errors[:body]).to be_present
      end

      it "is valid at exactly the max length" do
        expect(build(:feedback, body: "あ" * Feedback::BODY_MAX_LENGTH)).to be_valid
      end

      it "is invalid past the max length" do
        feedback = build(:feedback, body: "あ" * (Feedback::BODY_MAX_LENGTH + 1))
        expect(feedback).not_to be_valid
        expect(feedback.errors[:body]).to be_present
      end
    end

    describe "category" do
      it "is valid for each defined category" do
        Feedback.categories.each_key do |category|
          expect(build(:feedback, category: category)).to be_valid
        end
      end

      it "is invalid when blank" do
        feedback = build(:feedback, category: nil)
        expect(feedback).not_to be_valid
        expect(feedback.errors[:category]).to be_present
      end

      it "raises for an unknown category value" do
        expect { build(:feedback, category: "bogus") }.to raise_error(ArgumentError)
      end
    end

    describe "email" do
      it "is valid when blank (optional)" do
        expect(build(:feedback, email: nil)).to be_valid
        expect(build(:feedback, email: "")).to be_valid
      end

      it "is valid with a well-formed address" do
        expect(build(:feedback, email: "player@example.com")).to be_valid
      end

      it "is invalid with a malformed address" do
        feedback = build(:feedback, email: "not-an-email")
        expect(feedback).not_to be_valid
        expect(feedback.errors[:email]).to be_present
      end
    end
  end

  describe "associations" do
    it "is valid without a user (guest feedback)" do
      expect(build(:feedback, user: nil)).to be_valid
    end

    it "belongs to a user when present" do
      user = create(:user)
      expect(build(:feedback, user: user)).to be_valid
    end
  end
end
