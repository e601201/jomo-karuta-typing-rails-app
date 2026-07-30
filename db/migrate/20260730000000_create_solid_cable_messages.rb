class CreateSolidCableMessages < ActiveRecord::Migration[8.1]
  def change
    # Action Cable (solid_cable) の pub/sub テーブル。専用 DB は設けずプライマリ DB に置く（ADR 0009）。
    # 定義は solid_cable gem 同梱の db/cable_schema.rb と同一。
    create_table :solid_cable_messages do |t|
      t.binary :channel, limit: 1024, null: false
      t.binary :payload, limit: 536_870_912, null: false
      t.datetime :created_at, null: false
      t.integer :channel_hash, limit: 8, null: false

      t.index :channel
      t.index :channel_hash
      t.index :created_at
    end
  end
end
