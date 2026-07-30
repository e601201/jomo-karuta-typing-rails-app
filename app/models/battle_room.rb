class BattleRoom < ApplicationRecord
  # 待機・対戦中の部屋の寿命と、終了済み部屋を掃除するまでの保持期間
  # （ジョブ基盤を持たないためレイジーに掃除する）
  WAITING_TIMEOUT = 30.minutes
  MATCHED_TIMEOUT = 1.hour
  TERMINAL_RETENTION = 24.hours

  belongs_to :host, class_name: "User"
  belongs_to :guest, class_name: "User", optional: true

  enum :game_mode, { random: "random", timeattack: "timeattack" }
  enum :status, { waiting: "waiting", matched: "matched", finished: "finished", canceled: "canceled" }

  validates :game_mode, presence: true
  validates :passphrase, presence: true, length: { maximum: 20 }

  def participant?(user)
    user.present? && [ host_id, guest_id ].include?(user.id)
  end

  def player_ids
    [ host_id, guest_id ].compact
  end

  # 合言葉マッチング（join-or-create 一本。ADR 0010）
  # - 待機部屋がなければ作成して待つ
  # - 自分の待機部屋なら冪等に待機を返す（自己マッチ防止）
  # - 他人の待機部屋なら参加して成立し、このタイミングで山札を確定する
  # 作成競合（RecordNotUnique）は部分一意インデックスで検出し、1回だけ join 側としてやり直す。
  def self.join_or_create!(user:, game_mode:, passphrase:, retried: false)
    game_mode = game_mode.to_s
    passphrase = passphrase.to_s.strip
    raise ArgumentError, "'#{game_mode}' is not a valid game_mode" unless game_modes.key?(game_mode)

    cleanup_stale!

    # 同じユーザーの別の待機部屋は残さない（合言葉やモードを変えて再マッチングした場合の置き去り対策）。
    # 下のトランザクションの外で行い、他ユーザーの join との行ロック順序交差（AB-BA デッドロック）を避ける。
    where(host: user, status: :waiting).where.not(game_mode: game_mode, passphrase: passphrase)
      .update_all(status: "canceled", updated_at: Time.current)

    transaction do
      room = lock.find_by(game_mode: game_mode, passphrase: passphrase, status: :waiting)

      if room.nil?
        [ :waiting, create!(game_mode: game_mode, passphrase: passphrase, host: user) ]
      elsif room.host_id == user.id
        [ :waiting, room ]
      else
        room.update!(guest: user, status: :matched, deck: KarutaDeck.build(room.game_mode))
        [ :matched, room ]
      end
    end
  rescue ActiveRecord::RecordNotUnique
    raise if retried

    join_or_create!(user: user, game_mode: game_mode, passphrase: passphrase, retried: true)
  end

  def self.cleanup_stale!
    waiting.where(updated_at: ...WAITING_TIMEOUT.ago).update_all(status: "canceled", updated_at: Time.current)
    # サーバ異常終了などで unsubscribed が観測されず matched のまま取り残された部屋も終了させる
    matched.where(updated_at: ...MATCHED_TIMEOUT.ago).update_all(status: "finished", updated_at: Time.current)
    where(status: %i[finished canceled]).where(updated_at: ...TERMINAL_RETENTION.ago).delete_all
  end
end
