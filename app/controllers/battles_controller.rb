class BattlesController < ApplicationController
  before_action :require_login

  # マッチ成立済みの対戦プレイ画面。参加者以外や未成立・終了済みの部屋はトップへ戻す
  # （リロードでの復帰は仕様として行わない。ADR 0006 / ADR 0010）。
  def show
    room = BattleRoom.find_by(id: params[:id])
    unless room&.participant?(current_user) && room.matched?
      return redirect_to root_path, alert: "対戦が見つかりませんでした"
    end

    render inertia: "Battle", props: {
      room: {
        id: room.id,
        gameMode: room.game_mode,
        deck: room.deck,
        hostId: room.host_id,
        guestId: room.guest_id
      }
    }
  end
end
