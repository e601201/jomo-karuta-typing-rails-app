class PagesController < ApplicationController
  def home
    render inertia: "Home"
  end

  def settings
    render inertia: "Settings"
  end
end
