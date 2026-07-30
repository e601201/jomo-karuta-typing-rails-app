# 対戦のマッチング待機とプレイの両方を担う単一チャンネル。
# サーバは基本リレーに徹し、唯一の争点（タイムアタックの先着完走）だけを裁定する（ADR 0010）。
class BattleChannel < ApplicationCable::Channel
  def subscribed
    room = current_room
    return reject unless room&.participant?(current_user)

    stream_for room
    # matched broadcast の取りこぼし対策: subscribe 時点の状態を返し、
    # 成立済みならクライアント側でプレイ画面へ遷移させる。
    # stream 登録前に成立が滑り込む隙間を塞ぐため、登録後に読み直した状態を送る。
    room.reload
    transmit({ type: "state", status: room.status, players: room.player_ids })
  end

  def unsubscribed
    return if subscription_rejected?

    room = current_room
    return unless room

    room.with_lock do
      if room.waiting?
        room.update!(status: :canceled)
      elsif room.matched?
        room.update!(status: :finished)
      end
    end
    # 対戦成立後の離脱は相手に通知する（未決着なら相手の不戦勝。決着済みならクライアントが無視する）
    self.class.broadcast_to(room, { type: "opponent_left", userId: current_user.id }) if room.finished?
  end

  # 両者の ready が揃ったタイミングでカウントダウンを同時に始めるための合図。リレーのみ
  def ready(_data)
    relay({ type: "ready", userId: current_user.id })
  end

  def progress(data)
    relay({ type: "progress", userId: current_user.id, taken: int_or_zero(data["taken"]) })
  end

  def finished(data)
    room = current_room
    return unless room

    # タイムアタックは先に10枚を打ち切った方が勝ち。行ロックで先着だけを裁定する
    if room.timeattack?
      decided = false
      room.with_lock do
        if room.matched?
          room.update!(status: :finished)
          decided = true
        end
      end
      self.class.broadcast_to(room, { type: "match_decided", winnerId: current_user.id }) if decided
    else
      room.with_lock do
        room.update!(status: :finished) if room.matched?
      end
    end

    self.class.broadcast_to(room, { type: "player_finished", userId: current_user.id, stats: whitelist_stats(data["stats"]) })
  end

  private

  def current_room
    BattleRoom.find_by(id: params[:id])
  end

  def relay(payload)
    room = current_room
    self.class.broadcast_to(room, payload) if room
  end

  # 成績はクライアント申告値のため、数値フィールドだけを通す。
  # JSON は配列・オブジェクト・真偽値も運べるので、数値以外は落とす（例外にしない）
  def whitelist_stats(stats)
    stats = {} unless stats.is_a?(Hash)
    {
      score: int_or_nil(stats["score"]),
      timeMs: int_or_nil(stats["timeMs"]),
      taken: int_or_zero(stats["taken"]),
      accuracy: stats["accuracy"].is_a?(Numeric) ? stats["accuracy"].to_f : 0.0,
      wpm: int_or_nil(stats["wpm"]),
      maxCombo: int_or_zero(stats["maxCombo"])
    }
  end

  def int_or_nil(value)
    value.is_a?(Numeric) ? value.to_i : nil
  end

  def int_or_zero(value)
    value.is_a?(Numeric) ? value.to_i : 0
  end
end
