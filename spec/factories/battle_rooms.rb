FactoryBot.define do
  factory :battle_room do
    association :host, factory: :user
    game_mode { "random" }
    sequence(:passphrase) { |n| "あいことば#{n}" }

    trait :timeattack do
      game_mode { "timeattack" }
    end

    trait :matched do
      association :guest, factory: :user
      status { "matched" }
      deck { KarutaDeck.build(game_mode) }
    end
  end
end
