class PracticeController < ApplicationController
  def specific
    render inertia: "PracticeSpecific"
  end
end
