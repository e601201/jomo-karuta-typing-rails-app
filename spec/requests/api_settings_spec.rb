# NOTE: CSRF について — test 環境では ActionController::Base.allow_forgery_protection が
# false（config/environments/test.rb）のため、X-XSRF-TOKEN ヘッダなしでハッピーパスを検証する。
# 本番では ApplicationController#verified_request? の X-XSRF-TOKEN ヘッダ検証で通過する。
require "rails_helper"

RSpec.describe "Api::Settings", type: :request do
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

  let(:valid_payload) do
    {
      display: { fontSize: "large", theme: "dark", animations: false },
      sound: {
        bgmEnabled: false, bgmVolume: 30,
        effectsEnabled: true, effectsVolume: 70,
        typingSoundEnabled: false, typingSoundVolume: 10,
        voiceEnabled: true, voiceSpeed: 1.5
      },
      keyboard: { inputMethod: "kana" }
    }
  end

  describe "PUT /api/settings" do
    context "when not logged in" do
      it "returns 401 JSON and does not create a row" do
        expect {
          put "/api/settings", params: valid_payload, as: :json
        }.not_to change(UserSetting, :count)

        expect(response).to have_http_status(:unauthorized)
        expect(response.parsed_body["success"]).to be(false)
      end
    end

    context "when logged in without a saved setting" do
      before { log_in_via_google }

      it "lazily creates the row and returns the saved settings" do
        expect {
          put "/api/settings", params: valid_payload, as: :json
        }.to change(UserSetting, :count).by(1)

        expect(response).to have_http_status(:ok)
        body = response.parsed_body
        expect(body["success"]).to be(true)
        expect(body["settings"]).to eq(
          "display" => { "fontSize" => "large", "theme" => "dark", "animations" => false },
          "sound" => {
            "bgmEnabled" => false, "bgmVolume" => 30,
            "effectsEnabled" => true, "effectsVolume" => 70,
            "typingSoundEnabled" => false, "typingSoundVolume" => 10,
            "voiceEnabled" => true, "voiceSpeed" => 1.5
          },
          "keyboard" => { "inputMethod" => "kana" }
        )

        setting = User.find_by!(email: "player@example.com").user_setting
        expect(setting).to have_attributes(
          font_size: "large", theme: "dark", animations: false,
          bgm_enabled: false, bgm_volume: 30,
          effects_enabled: true, effects_volume: 70,
          typing_sound_enabled: false, typing_sound_volume: 10,
          voice_enabled: true, input_method: "kana"
        )
        expect(setting.voice_speed).to eq(1.5)
      end

      it "retries on a unique-index collision instead of returning 500 (複数タブの同時初回 PUT)" do
        # find_or_initialize_by の後・INSERT の前に別タブの PUT が行を作った状況を、
        # 1回目の呼び出しでだけ既存行を作ってから新規レコードを返すことで再現する
        calls = 0
        allow(UserSetting).to receive(:find_or_initialize_by).and_wrap_original do |original, **args|
          calls += 1
          if calls == 1
            UserSetting.create!(user: args[:user])
            UserSetting.new(**args)
          else
            original.call(**args)
          end
        end

        put "/api/settings", params: valid_payload, as: :json

        expect(response).to have_http_status(:ok)
        expect(response.parsed_body["success"]).to be(true)
        expect(UserSetting.where(user: User.find_by!(email: "player@example.com")).count).to eq(1)
        setting = User.find_by!(email: "player@example.com").user_setting
        expect(setting.theme).to eq("dark")
      end

      it "returns 422 without creating a row when a volume is out of range" do
        payload = valid_payload.deep_merge(sound: { bgmVolume: 101 })

        expect {
          put "/api/settings", params: payload, as: :json
        }.not_to change(UserSetting, :count)

        expect(response).to have_http_status(422)
        body = response.parsed_body
        expect(body["success"]).to be(false)
        expect(body["errors"]).to be_present
      end

      it "returns 422 without creating a row when the theme is unknown" do
        payload = valid_payload.deep_merge(display: { theme: "sepia" })

        expect {
          put "/api/settings", params: payload, as: :json
        }.not_to change(UserSetting, :count)

        expect(response).to have_http_status(422)
        expect(response.parsed_body["success"]).to be(false)
      end
    end

    context "when logged in with a saved setting" do
      before { log_in_via_google }

      it "replaces all 12 settings without creating another row" do
        put "/api/settings", params: valid_payload, as: :json
        replacement = {
          display: { fontSize: "extra-large", theme: "light", animations: true },
          sound: {
            bgmEnabled: true, bgmVolume: 0,
            effectsEnabled: false, effectsVolume: 100,
            typingSoundEnabled: true, typingSoundVolume: 55,
            voiceEnabled: false, voiceSpeed: 0.5
          },
          keyboard: { inputMethod: "romaji" }
        }

        expect {
          put "/api/settings", params: replacement, as: :json
        }.not_to change(UserSetting, :count)

        expect(response).to have_http_status(:ok)
        setting = User.find_by!(email: "player@example.com").user_setting
        expect(setting).to have_attributes(
          font_size: "extra-large", theme: "light", animations: true,
          bgm_enabled: true, bgm_volume: 0,
          effects_enabled: false, effects_volume: 100,
          typing_sound_enabled: true, typing_sound_volume: 55,
          voice_enabled: false, input_method: "romaji"
        )
        expect(setting.voice_speed).to eq(0.5)
      end

      it "keeps the stored values when the replacement is invalid" do
        put "/api/settings", params: valid_payload, as: :json
        put "/api/settings", params: valid_payload.deep_merge(sound: { effectsVolume: 101 }), as: :json

        expect(response).to have_http_status(422)
        setting = User.find_by!(email: "player@example.com").user_setting
        expect(setting.effects_volume).to eq(70)
      end
    end
  end

  describe "shared props settings" do
    it "shares nil while no setting is saved (the first-sync signal)" do
      log_in_via_google

      get "/settings"
      expect(inertia.props[:settings]).to be_nil
    end

    it "shares the saved settings after a PUT" do
      log_in_via_google
      put "/api/settings", params: valid_payload, as: :json

      get "/settings"
      # inertia.props はトップレベルのみシンボル化され、ネストは文字列キーで返る
      expect(inertia.props[:settings]).to eq(
        "display" => { "fontSize" => "large", "theme" => "dark", "animations" => false },
        "sound" => {
          "bgmEnabled" => false, "bgmVolume" => 30,
          "effectsEnabled" => true, "effectsVolume" => 70,
          "typingSoundEnabled" => false, "typingSoundVolume" => 10,
          "voiceEnabled" => true, "voiceSpeed" => 1.5
        },
        "keyboard" => { "inputMethod" => "kana" }
      )
    end

    it "shares settings saved outside this session (別ブラウザでの保存を DB 経由で反映する)" do
      log_in_via_google
      # 別ブラウザからの PUT を、このセッションを介さない直接の行作成で代替する
      User.find_by!(email: "player@example.com").create_user_setting!(font_size: "large")

      get "/settings"
      expect(inertia.props[:settings]["display"]["fontSize"]).to eq("large")
    end

    it "shares nil when not logged in" do
      get "/settings"
      expect(inertia.props[:settings]).to be_nil
    end

    it "does not create a user_setting row on signup alone" do
      expect { log_in_via_google }.not_to change(UserSetting, :count)
    end
  end
end
