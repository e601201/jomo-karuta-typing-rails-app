class UserSetting < ApplicationRecord
  belongs_to :user

  FONT_SIZES    = %w[small medium large extra-large].freeze
  THEMES        = %w[light dark auto].freeze
  INPUT_METHODS = %w[romaji kana].freeze

  # enum マクロは使わない（"extra-large" のハイフンで生成メソッド名が壊れるため）。
  # inclusion / numericality バリデーションで検証する
  validates :font_size, inclusion: { in: FONT_SIZES }
  validates :theme, inclusion: { in: THEMES }
  validates :input_method, inclusion: { in: INPUT_METHODS }

  validates :bgm_volume, :effects_volume, :typing_sound_volume,
            numericality: { only_integer: true, greater_than_or_equal_to: 0, less_than_or_equal_to: 100 }
  validates :voice_speed,
            numericality: { greater_than_or_equal_to: 0.5, less_than_or_equal_to: 2.0 }

  # 真偽値は nil を弾く（false は有効値のため presence は使えない）
  validates :animations, :bgm_enabled, :effects_enabled, :typing_sound_enabled, :voice_enabled,
            inclusion: { in: [ true, false ] }

  # フロントの UserSettings 型（camelCase・ネスト）へ変換する
  def as_frontend
    {
      display: {
        fontSize: font_size,
        theme: theme,
        animations: animations
      },
      sound: {
        bgmEnabled: bgm_enabled,
        bgmVolume: bgm_volume,
        effectsEnabled: effects_enabled,
        effectsVolume: effects_volume,
        typingSoundEnabled: typing_sound_enabled,
        typingSoundVolume: typing_sound_volume,
        voiceEnabled: voice_enabled,
        voiceSpeed: voice_speed.to_f
      },
      keyboard: {
        inputMethod: input_method
      }
    }
  end

  # フロントの UserSettings 型（camelCase・ネスト）→ カラム属性ハッシュ
  def self.attributes_from_frontend(params)
    display  = params[:display] || {}
    sound    = params[:sound] || {}
    keyboard = params[:keyboard] || {}

    {
      font_size: display[:fontSize],
      theme: display[:theme],
      animations: display[:animations],
      bgm_enabled: sound[:bgmEnabled],
      bgm_volume: sound[:bgmVolume],
      effects_enabled: sound[:effectsEnabled],
      effects_volume: sound[:effectsVolume],
      typing_sound_enabled: sound[:typingSoundEnabled],
      typing_sound_volume: sound[:typingSoundVolume],
      voice_enabled: sound[:voiceEnabled],
      voice_speed: sound[:voiceSpeed],
      input_method: keyboard[:inputMethod]
    }
  end
end
