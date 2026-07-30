module Api
  class BattleRoomsController < ApplicationController
    # フラットな JSON を受けるため、model 名での自動パラメータラップを無効化する
    wrap_parameters format: []

    # 対戦はログインユーザーのみ。API なので HTML リダイレクトではなく JSON 401 を返す。
    before_action :require_logged_in

    # 合言葉マッチング（join-or-create 一本）。
    # status: "waiting" = 部屋を作って待機 / "matched" = 既存の待機部屋に参加して成立
    def create
      status, room = BattleRoom.join_or_create!(
        user: current_user,
        game_mode: params[:game_mode],
        passphrase: params[:passphrase]
      )

      # 待機中のホストへ成立を通知する（ホストはチャンネル購読済み。ゲストはこのレスポンスで遷移する）
      BattleChannel.broadcast_to(room, { type: "matched", roomId: room.id }) if status == :matched

      render json: { success: true, status: status, room: { id: room.id } }, status: :created
    rescue ActiveRecord::RecordInvalid => e
      render json: { success: false, error: e.record.errors.full_messages.to_sentence },
             status: :unprocessable_entity
    rescue ArgumentError => e
      render json: { success: false, error: e.message }, status: :unprocessable_entity
    end

    # マッチング待機のキャンセル。参加との競合は行ロックで直列化し、
    # 既に成立していたら 409 で部屋 id を返してクライアントをそのまま対戦へ進ませる。
    def destroy
      room = BattleRoom.find_by(id: params[:id])
      unless room&.participant?(current_user)
        return render json: { success: false, error: "部屋が見つかりません" }, status: :not_found
      end

      room.with_lock do
        room.update!(status: :canceled) if room.waiting?
      end

      if room.matched?
        render json: { success: false, status: "matched", room: { id: room.id } }, status: :conflict
      else
        head :no_content
      end
    end

    private

    def require_logged_in
      return if current_user

      render json: { success: false, error: "ログインが必要です" }, status: :unauthorized
    end
  end
end
