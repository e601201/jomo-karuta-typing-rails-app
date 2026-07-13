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

ActiveRecord::Schema[8.1].define(version: 2026_07_13_234452) do
  # These are extensions that must be enabled in order to support this database
  enable_extension "pg_catalog.plpgsql"

  # Custom types defined in this database.
  # Note that some types may not work with other database engines. Be careful if changing database.
  create_enum "difficulty", ["beginner", "standard", "advanced"]
  create_enum "game_mode", ["random", "timeattack"]

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

  create_table "users", force: :cascade do |t|
    t.string "avatar_url"
    t.datetime "created_at", null: false
    t.string "email", null: false
    t.string "nickname"
    t.datetime "updated_at", null: false
    t.index ["email"], name: "index_users_on_email", unique: true
  end

  add_foreign_key "identities", "users"
  add_foreign_key "scores", "users"
end
