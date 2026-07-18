class CreateUserSettings < ActiveRecord::Migration[8.1]
  def change
    # ラベルはフロントの TS 文字列リテラルと完全一致させる（"extra-large" のハイフン含む）
    create_enum :font_size, %w[small medium large extra-large]
    create_enum :theme, %w[light dark auto]
    create_enum :input_method, %w[romaji kana]

    create_table :user_settings do |t|
      t.references :user, null: false, foreign_key: true, index: { unique: true }
      # default はフロント settings-store.ts の defaultSettings と一致させる
      t.enum :font_size, enum_type: :font_size, null: false, default: "medium"
      t.enum :theme, enum_type: :theme, null: false, default: "auto"
      t.boolean :animations, null: false, default: true
      t.boolean :bgm_enabled, null: false, default: true
      t.integer :bgm_volume, null: false, default: 50
      t.boolean :effects_enabled, null: false, default: true
      t.integer :effects_volume, null: false, default: 50
      t.boolean :typing_sound_enabled, null: false, default: true
      t.integer :typing_sound_volume, null: false, default: 50
      t.boolean :voice_enabled, null: false, default: false
      t.decimal :voice_speed, precision: 2, scale: 1, null: false, default: 1.0
      t.enum :input_method, enum_type: :input_method, null: false, default: "romaji"
      t.timestamps
    end
  end
end
