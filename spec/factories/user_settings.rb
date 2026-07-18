FactoryBot.define do
  # 各カラムの値は DB のカラムデフォルト（= フロントの defaultSettings）に任せる
  factory :user_setting do
    user
  end
end
