class Feedback < ApplicationRecord
  # ログイン中に送られたときだけ user が紐付く（ゲスト送信は user_id nil）
  belongs_to :user, optional: true

  BODY_MAX_LENGTH = 2000

  # 4 カテゴリの単一チャネル（CONTEXT.md「フィードバック」参照）。
  # DB 側は feedback_category の native enum。不正値の代入は ArgumentError になり、
  # コントローラで 422 相当（フォーム再描画）に落とす。
  enum :category, {
    bug_report: "bug_report",
    feature_request: "feature_request",
    usage_question: "usage_question",
    other: "other"
  }

  validates :category, presence: true
  validates :body, presence: true, length: { maximum: BODY_MAX_LENGTH }
  # email は任意。記入があるときだけ形式を検証する（ゲストの返信先）
  validates :email, format: { with: URI::MailTo::EMAIL_REGEXP }, allow_blank: true
end
