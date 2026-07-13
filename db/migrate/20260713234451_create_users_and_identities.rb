class CreateUsersAndIdentities < ActiveRecord::Migration[8.1]
  def change
    create_table :users do |t|
      t.string :email, null: false
      t.string :nickname
      t.string :avatar_url
      t.timestamps
    end
    add_index :users, :email, unique: true

    create_table :identities do |t|
      t.references :user, null: false, foreign_key: true
      t.string :provider, null: false # "google_oauth2" | "github"
      t.string :uid, null: false
      t.timestamps
    end
    add_index :identities, [ :provider, :uid ], unique: true
  end
end
