# This file is auto-generated from the current state of the database. Instead
# of editing this file, please use the migrations feature of Active Record to
# incrementally modify your database, and then regenerate this schema definition.
#
# This file is the source Rails uses to define your schema when running `bin/rails
# db:schema:load`. When creating a new database, `bin/rails db:schema:load` tends to
# be faster and is potentially less error prone than running all of your
# migrations from scratch. Old migrations may fail to apply correctly if those
# migrations use external dependencies or application code.
#
# It's strongly recommended that you check this file into your version control system.

ActiveRecord::Schema[8.1].define(version: 2026_07_21_000001) do
  # These are extensions that must be enabled in order to support this database
  enable_extension "pg_catalog.plpgsql"

  # Custom types defined in this database.
  # Note that some types may not work with other database engines. Be careful if changing database.
  create_enum "difficulty", ["beginner", "standard", "advanced"]
  create_enum "feedback_category", ["bug_report", "feature_request", "usage_question", "other"]
  create_enum "font_size", ["small", "medium", "large", "extra-large"]
  create_enum "game_mode", ["random", "timeattack"]
  create_enum "input_method", ["romaji", "kana"]
  create_enum "theme", ["light", "dark", "auto"]

  create_table "feedbacks", force: :cascade do |t|
    t.text "body", null: false
    t.enum "category", null: false, enum_type: "feedback_category"
    t.datetime "created_at", null: false
    t.string "email"
    t.string "subject"
    t.datetime "updated_at", null: false
    t.bigint "user_id"
    t.index ["user_id"], name: "index_feedbacks_on_user_id"
  end

  create_table "identities", force: :cascade do |t|
    t.datetime "created_at", null: false
    t.string "provider", null: false
    t.string "uid", null: false
    t.datetime "updated_at", null: false
    t.bigint "user_id", null: false
    t.index ["provider", "uid"], name: "index_identities_on_provider_and_uid", unique: true
    t.index ["user_id"], name: "index_identities_on_user_id"
  end

  create_table "scores", force: :cascade do |t|
    t.datetime "created_at", null: false
    t.enum "difficulty", null: false, enum_type: "difficulty"
    t.enum "game_mode", null: false, enum_type: "game_mode"
    t.string "nick_name", limit: 20, null: false
    t.integer "score"
    t.integer "time_ms"
    t.datetime "updated_at", null: false
    t.bigint "user_id"
    t.index ["game_mode", "difficulty", "score"], name: "idx_scores_leaderboard_score", order: { score: :desc }, where: "(score IS NOT NULL)"
    t.index ["game_mode", "difficulty", "time_ms"], name: "idx_scores_leaderboard_time", where: "(time_ms IS NOT NULL)"
    t.index ["user_id"], name: "index_scores_on_user_id"
  end

  create_table "user_settings", force: :cascade do |t|
    t.boolean "animations", default: true, null: false
    t.boolean "bgm_enabled", default: true, null: false
    t.integer "bgm_volume", default: 50, null: false
    t.datetime "created_at", null: false
    t.boolean "effects_enabled", default: true, null: false
    t.integer "effects_volume", default: 50, null: false
    t.enum "font_size", default: "medium", null: false, enum_type: "font_size"
    t.enum "input_method", default: "romaji", null: false, enum_type: "input_method"
    t.enum "theme", default: "auto", null: false, enum_type: "theme"
    t.boolean "typing_sound_enabled", default: true, null: false
    t.integer "typing_sound_volume", default: 50, null: false
    t.datetime "updated_at", null: false
    t.bigint "user_id", null: false
    t.boolean "voice_enabled", default: false, null: false
    t.decimal "voice_speed", precision: 2, scale: 1, default: "1.0", null: false
    t.index ["user_id"], name: "index_user_settings_on_user_id", unique: true
  end

  create_table "users", force: :cascade do |t|
    t.string "avatar_url"
    t.datetime "created_at", null: false
    t.string "email", null: false
    t.string "nickname"
    t.datetime "updated_at", null: false
    t.index ["email"], name: "index_users_on_email", unique: true
  end

  add_foreign_key "feedbacks", "users"
  add_foreign_key "identities", "users"
  add_foreign_key "scores", "users"
  add_foreign_key "user_settings", "users"
end
