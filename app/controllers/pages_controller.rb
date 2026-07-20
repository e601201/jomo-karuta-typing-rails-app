class PagesController < ApplicationController
  def home
    render inertia: "Home"
  end

  def settings
    render inertia: "Settings"
  end

  # 遊び方はゲストにも読ませる（ヘッダーのゲスト用メニューからも辿れる）ため require_login を付けない
  def how_to_play
    render inertia: "HowToPlay"
  end
end
