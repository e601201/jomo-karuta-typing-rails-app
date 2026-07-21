FactoryBot.define do
  factory :feedback do
    category { "other" }
    body { "とても楽しいゲームでした。" }
    email { nil }
  end
end
