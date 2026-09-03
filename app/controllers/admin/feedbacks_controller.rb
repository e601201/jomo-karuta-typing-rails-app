module Admin
  class FeedbacksController < ApplicationController
    before_action :require_admin

    PER_PAGE = 50

    def index
      # 未知の値・未指定は「すべて」。enum のキー由来でホワイトリストし、生値を SQL に通さない
      category = Feedback.categories.key?(params[:category]) ? params[:category] : nil
      page = [ params[:page].to_i, 1 ].max

      scope = Feedback.includes(:user).order(created_at: :desc, id: :desc)
      scope = scope.where(category: category) if category
      total = scope.count

      response.headers["Cache-Control"] = "no-store"

      render inertia: "admin/Feedbacks", props: {
        feedbacks: scope.offset((page - 1) * PER_PAGE).limit(PER_PAGE).as_json(
          only: %i[id category subject body email created_at],
          include: { user: { only: %i[id nickname email] } }
        ),
        # カテゴリの列挙はフロントにハードコードしない（#21 の Badge::CATEGORIES と同じ方針）
        categories: Feedback.categories.keys,
        category: category,
        page: page,
        perPage: PER_PAGE,
        total: total
      }
    end
  end
end
