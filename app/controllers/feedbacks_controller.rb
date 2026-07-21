class FeedbacksController < ApplicationController
  THANKS_MESSAGE = "フィードバックを送信しました。ご協力ありがとうございます。".freeze

  # ゲストからのフィードバックも受け付けるため require_login は付けない（/how-to-play と同様）。
  # 公開 POST になるので rate_limit と honeypot で最低限のスパム対策をする。
  rate_limit to: 5, within: 1.minute, only: :create,
             with: -> { redirect_to feedback_path, alert: "送信が多すぎます。しばらく時間をおいて再度お試しください。" }

  def new
    render inertia: "Feedback"
  end

  def create
    # ハニーポット（人間には見えない website 欄）が埋まっていれば bot とみなし、
    # 保存せず成功と同じ応答を返す（bot に成否を悟らせない）
    return redirect_to(feedback_path, notice: THANKS_MESSAGE) if params[:website].present?

    feedback = Feedback.new(feedback_params)
    # user_id はサーバの session からのみ決める（クライアントの申告は信用しない）
    feedback.user = current_user if current_user

    if feedback.save
      redirect_to feedback_path, notice: THANKS_MESSAGE
    else
      redirect_to feedback_path, inertia: { errors: feedback.errors.to_hash(true) }
    end
  rescue ArgumentError
    # select を経由しない改ざん POST 等で不正な category 値が来たケース
    redirect_to feedback_path, inertia: { errors: { category: [ "不正な値です" ] } }
  end

  private

  # user_id は許可しない（session から決めるため）
  def feedback_params
    params.permit(:category, :subject, :body, :email)
  end
end
