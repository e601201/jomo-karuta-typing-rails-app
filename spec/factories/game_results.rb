FactoryBot.define do
  factory :game_result do
    user
    difficulty { "standard" }
    game_mode { "random" }
    score { 1000 }
    time_ms { nil }
    accuracy { 95 }
    wpm { 60 }
    max_combo { 12 }
    correct_cards { 10 }

    trait :random_result do
      game_mode { "random" }
      score { 1000 }
      time_ms { nil }
    end

    trait :timeattack_result do
      game_mode { "timeattack" }
      score { nil }
      time_ms { 30_000 }
    end
  end
end
