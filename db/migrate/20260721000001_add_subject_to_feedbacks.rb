class AddSubjectToFeedbacks < ActiveRecord::Migration[8.1]
  def change
    # 件名（任意）。デザイン wNwWp のフォームに合わせて追加
    add_column :feedbacks, :subject, :string
  end
end
