Rails.application.routes.draw do
  # Redirect to localhost from 127.0.0.1 to use same IP address with Vite server
  constraints(host: "127.0.0.1") do
    get "(*path)", to: redirect { |params, req| "#{req.protocol}localhost:#{req.port}/#{params[:path]}" }
  end

  root "pages#home"
  get "game",     to: "games#show"
  get "settings", to: "pages#settings"
  get "ranking",  to: "rankings#index"
  get "profile",  to: "profiles#show"

  # 認証 (OmniAuth)。request phase (POST /auth/:provider) は OmniAuth ミドルウェアが処理する
  get    "auth/login",              to: "sessions#new"
  get    "auth/error",              to: "sessions#error"
  get    "auth/:provider/callback", to: "sessions#create"
  delete "auth/logout",             to: "sessions#destroy"

  namespace :api do
    resources :scores, only: :create
    # プレイ記録の自動保存（ログインユーザーのみ・ゲーム自然完了時。#20 / ADR 0005）
    resources :game_results, only: :create
    resource :settings, only: :update
  end

  # Reveal health status on /up that returns 200 if the app boots with no exceptions, otherwise 500.
  # Can be used by load balancers and uptime monitors to verify that the app is live.
  get "up" => "rails/health#show", as: :rails_health_check
end
