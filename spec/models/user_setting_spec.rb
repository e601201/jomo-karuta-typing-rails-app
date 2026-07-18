require "rails_helper"

RSpec.describe UserSetting, type: :model do
  describe "defaults" do
    it "is valid with the column defaults (= frontend defaultSettings)" do
      setting = build(:user_setting)
      expect(setting).to be_valid
      expect(setting).to have_attributes(
        font_size: "medium",
        theme: "auto",
        animations: true,
        bgm_enabled: true,
        bgm_volume: 50,
        effects_enabled: true,
        effects_volume: 50,
        typing_sound_enabled: true,
        typing_sound_volume: 50,
        voice_enabled: false,
        input_method: "romaji"
      )
      expect(setting.voice_speed).to eq(1.0)
    end
  end

  describe "volume validations (0..100)" do
    %i[bgm_volume effects_volume typing_sound_volume].each do |column|
      it "accepts 0 and 100 for #{column}" do
        expect(build(:user_setting, column => 0)).to be_valid
        expect(build(:user_setting, column => 100)).to be_valid
      end

      it "rejects 101 and -1 for #{column}" do
        expect(build(:user_setting, column => 101)).not_to be_valid
        expect(build(:user_setting, column => -1)).not_to be_valid
      end

      it "rejects a non-integer for #{column}" do
        expect(build(:user_setting, column => 50.5)).not_to be_valid
      end
    end
  end

  describe "voice_speed validation (0.5..2.0)" do
    it "accepts the boundary values 0.5 and 2.0" do
      expect(build(:user_setting, voice_speed: 0.5)).to be_valid
      expect(build(:user_setting, voice_speed: 2.0)).to be_valid
    end

    it "rejects 0.4 and 2.1" do
      expect(build(:user_setting, voice_speed: 0.4)).not_to be_valid
      expect(build(:user_setting, voice_speed: 2.1)).not_to be_valid
    end
  end

  describe "enum-like inclusion validations" do
    it "accepts extra-large (the hyphenated label) for font_size" do
      expect(build(:user_setting, font_size: "extra-large")).to be_valid
    end

    it "rejects unknown values" do
      expect(build(:user_setting, font_size: "huge")).not_to be_valid
      expect(build(:user_setting, theme: "sepia")).not_to be_valid
      expect(build(:user_setting, input_method: "flick")).not_to be_valid
    end
  end

  describe "boolean validations" do
    %i[animations bgm_enabled effects_enabled typing_sound_enabled voice_enabled].each do |column|
      it "rejects nil but accepts false for #{column}" do
        expect(build(:user_setting, column => nil)).not_to be_valid
        expect(build(:user_setting, column => false)).to be_valid
      end
    end
  end

  describe "association with user" do
    it "is not created automatically when a user is created" do
      expect { create(:user) }.not_to change(described_class, :count)
    end

    it "is destroyed together with its user" do
      setting = create(:user_setting)
      expect { setting.user.destroy }.to change(described_class, :count).by(-1)
    end
  end

  describe "#as_frontend" do
    it "returns the nested camelCase shape with voice_speed as a Float" do
      setting = build(:user_setting, font_size: "extra-large", voice_speed: 1.5, bgm_volume: 80)
      expect(setting.as_frontend).to eq(
        display: { fontSize: "extra-large", theme: "auto", animations: true },
        sound: {
          bgmEnabled: true, bgmVolume: 80,
          effectsEnabled: true, effectsVolume: 50,
          typingSoundEnabled: true, typingSoundVolume: 50,
          voiceEnabled: false, voiceSpeed: 1.5
        },
        keyboard: { inputMethod: "romaji" }
      )
    end
  end

  describe ".attributes_from_frontend" do
    it "maps the nested camelCase shape onto column attributes" do
      attributes = described_class.attributes_from_frontend(
        display: { fontSize: "small", theme: "dark", animations: false },
        sound: {
          bgmEnabled: false, bgmVolume: 10,
          effectsEnabled: false, effectsVolume: 20,
          typingSoundEnabled: false, typingSoundVolume: 30,
          voiceEnabled: true, voiceSpeed: 0.5
        },
        keyboard: { inputMethod: "kana" }
      )

      expect(attributes).to eq(
        font_size: "small",
        theme: "dark",
        animations: false,
        bgm_enabled: false,
        bgm_volume: 10,
        effects_enabled: false,
        effects_volume: 20,
        typing_sound_enabled: false,
        typing_sound_volume: 30,
        voice_enabled: true,
        voice_speed: 0.5,
        input_method: "kana"
      )
    end

    it "maps missing sections to nil attributes (full replacement, no partial update)" do
      attributes = described_class.attributes_from_frontend({})
      expect(attributes.values).to all(be_nil)
    end
  end
end
