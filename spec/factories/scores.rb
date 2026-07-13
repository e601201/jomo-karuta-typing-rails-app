FactoryBot.define do
  factory :score do
    nick_name { "テストプレイヤー" }
    difficulty { "standard" }
    game_mode { "random" }
    score { 1000 }
    time_ms { nil }

    trait :random_score do
      game_mode { "random" }
      score { 1000 }
      time_ms { nil }
    end

    trait :timeattack_score do
      game_mode { "timeattack" }
      score { nil }
      time_ms { 30_000 }
    end
  end
end
