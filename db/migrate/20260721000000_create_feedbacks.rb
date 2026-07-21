class CreateFeedbacks < ActiveRecord::Migration[8.1]
  def change
    create_enum :feedback_category, %w[bug_report feature_request usage_question other]

    create_table :feedbacks do |t|
      # ゲストも送信できるため user は任意（ログイン時のみ紐付く）
      t.references :user, null: true, foreign_key: true
      t.enum :category, enum_type: :feedback_category, null: false
      t.text :body, null: false
      # 返信用の任意アドレス。ゲストは自由記入、ログイン時はアカウントのメールを既定表示
      t.string :email
      t.timestamps
    end
  end
end
