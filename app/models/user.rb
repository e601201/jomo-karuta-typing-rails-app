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

  validates :email, presence: true, uniqueness: true

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
