class GamesController < ApplicationController
  # mode / difficulty / cards は素通しし、検証と札解決はクライアント側の
  # resolve-game-params が担う（旧 SvelteKit +page.ts の URL 契約を維持）
  def show
    render inertia: "Game", props: {
      mode: params[:mode],
      difficulty: params[:difficulty],
      cards: params[:cards]
    }
  end
end
