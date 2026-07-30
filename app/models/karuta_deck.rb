# 対戦モードの山札を生成する。カードデータの源泉はフロントの karuta-cards.json 一箇所のみで、
# サーバは id の一覧だけを読む（DB には持たない）。
class KarutaDeck
  CARDS_PATH = Rails.root.join("app/frontend/lib/data/karuta-cards.json")
  TIMEATTACK_SIZE = 10

  class << self
    def build(game_mode)
      case game_mode.to_s
      when "random" then card_ids.shuffle
      when "timeattack" then card_ids.sample(TIMEATTACK_SIZE)
      else raise ArgumentError, "unknown game_mode: #{game_mode}"
      end
    end

    def card_ids
      @card_ids ||= JSON.parse(CARDS_PATH.read).map { |card| card.fetch("id") }.freeze
    end
  end
end
