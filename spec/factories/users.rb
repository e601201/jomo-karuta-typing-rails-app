FactoryBot.define do
  factory :user do
    sequence(:email) { |n| "user#{n}@example.com" }
    nickname { "テストユーザー" }
  end

  factory :identity do
    user
    provider { "google_oauth2" }
    sequence(:uid) { |n| "uid-#{n}" }
  end
end
