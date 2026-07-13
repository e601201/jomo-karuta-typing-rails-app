class ProfilesController < ApplicationController
  before_action :require_login

  # ユーザー情報は inertia_share の auth props で渡る
  def show
    render inertia: "Profile"
  end
end
