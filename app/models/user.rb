class User < ApplicationRecord
  # OAuth プロバイダがメールアドレスを提供しなかった場合（GitHub のプライバシー設定など）
  class EmailUnavailableError < StandardError; end

  has_many :identities, dependent: :destroy
  has_one :user_setting, dependent: :destroy
  # 退会してもランキングの記録は残す（nick_name は scores 行が持っており、
  # リーダーボードは users を参照しないため、:destroy だと公開順位が書き換わる）
  has_many :scores, dependent: :nullify
  # プレイ記録は非公開の個人データなので、退会時は一緒に消す
  has_many :game_results, dependent: :destroy
  # フィードバックは運営の受信箱なので、退会しても本文は残す（user_id だけ外す）
  has_many :feedbacks, dependent: :nullify

  validates :email, presence: true, uniqueness: true

  # 運営（フィードバック一覧を読める人。CONTEXT.md「運営」）かどうか。
  # 許可リストは ENV["ADMIN_EMAILS"]（カンマ区切り）。dev/test は .env、
  # 本番は Kamal が credentials(admin.emails) から注入する（OAuth クレデンシャルと同じ経路）。
  # 未設定・空なら誰も運営にならない（fail closed）。
  def admin?
    return false if email.blank?

    self.class.admin_emails.include?(email.downcase)
  end

  # メモ化しない（プロセス内で ENV は変わらないが、テストが ENV を差し替えて実挙動を検証するため）
  def self.admin_emails
    ENV.fetch("ADMIN_EMAILS", "").split(",").filter_map { |e| e.strip.downcase.presence }
  end

  # ベストスコア（全プレイ記録の中での自己最高。CONTEXT.md / ADR 0005 参照）。
  # 導出元はランキング登録済みの scores ではなく game_results（全プレイ）。
  # 並び順はリーダーボードとタイブレーク（created_at 先着優先)まで揃える
  def best_scores
    random = game_results.random.where.not(score: nil).order(score: :desc, created_at: :asc).first
    timeattack = game_results.timeattack.where.not(time_ms: nil).order(time_ms: :asc, created_at: :asc).first
    {
      random: random && { score: random.score, difficulty: random.difficulty },
      timeattack: timeattack && { time_ms: timeattack.time_ms, difficulty: timeattack.difficulty }
    }
  end

  # バッジの評価結果（全カタログ + 各自の解除状態・解除日時・進捗）。
  # 解除テーブルは持たず全プレイ記録から毎回導出する（ADR 0007）
  def badges
    Badge.evaluate(game_results.order(created_at: :asc, id: :asc).to_a)
  end

  # 現在進行中の連続プレイ（JST 暦日で数える。実績・バッジ画面のパネル統計用）
  def current_play_streak
    Badge::Stats.new(game_results.order(created_at: :asc, id: :asc).to_a).current_streak
  end

  # OmniAuth の auth ハッシュからユーザーを解決する。
  # (a) 既存 Identity → その user を返す
  # (b) メールアドレス一致の既存ユーザー → Identity を紐付けて返す
  # (c) いずれもなし → ユーザー + Identity を新規作成
  def self.from_omniauth(auth)
    identity = Identity.find_by(provider: auth.provider, uid: auth.uid)
    return identity.user if identity

    email = auth.info&.email
    raise EmailUnavailableError, "provider #{auth.provider} did not supply an email" if email.blank?

    user = find_by(email: email)
    user ||= create!(
      email: email,
      nickname: auth.info.name.presence || auth.info.nickname.presence,
      avatar_url: auth.info.image
    )
    user.identities.create!(provider: auth.provider, uid: auth.uid)
    user
  end
end
