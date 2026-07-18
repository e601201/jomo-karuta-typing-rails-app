module Api
  class SettingsController < ApplicationController
    # CSRF は ApplicationController#verified_request? の X-XSRF-TOKEN ヘッダ検証で通す
    # （forgery protection のスキップはしない）

    before_action :require_login_json

    # 12 項目の全置換（部分更新なし）。行はここで遅延作成する
    # （ログイン時に先行作成すると settings: null の「未保存」シグナルが壊れる。ADR-0004）
    def update
      retried = false
      begin
        setting = UserSetting.find_or_initialize_by(user: current_user)
        setting.assign_attributes(UserSetting.attributes_from_frontend(settings_params))

        if setting.save
          render json: { success: true, settings: setting.as_frontend }
        else
          render json: { success: false, errors: setting.errors.full_messages },
                 status: :unprocessable_entity
        end
      rescue ActiveRecord::RecordNotUnique
        # 複数タブの初回引き継ぎ PUT がほぼ同時に走ると、双方が新規行を build して
        # 後発の INSERT が user_id の unique index に衝突する。衝突した時点で
        # 既存行は確定しているので、取得し直して一度だけリトライする
        raise if retried

        retried = true
        retry
      end
    end

    private

    def settings_params
      params.permit(
        display: %i[fontSize theme animations],
        sound: %i[bgmEnabled bgmVolume effectsEnabled effectsVolume
                  typingSoundEnabled typingSoundVolume voiceEnabled voiceSpeed],
        keyboard: %i[inputMethod]
      )
    end

    # fetch 系 API なのでリダイレクトではなく 401 JSON を返す
    def require_login_json
      return if current_user

      render json: { success: false, errors: [ "ログインが必要です" ] }, status: :unauthorized
    end
  end
end
