require "rails_helper"

# バッジは解除テーブルを持たず game_results から毎回導出する（ADR 0007）。
# 公開シームは User#badges のみ。カタログ（Badge）は内部実装として扱う。
RSpec.describe "User#badges" do
  include ActiveSupport::Testing::TimeHelpers

  JST = ActiveSupport::TimeZone["Asia/Tokyo"]

  def play_at(user, jst_time, **attrs)
    create(:game_result, :random_result, user: user, created_at: JST.parse(jst_time), **attrs)
  end

  def badge(user, id)
    user.badges.find { |b| b[:id] == id } or raise "badge not found: #{id}"
  end

  describe "記録が無いユーザー" do
    it "カタログ全17個を未解除で返す" do
      user = create(:user)

      badges = user.badges

      expect(badges.size).to eq(17)
      expect(badges).to all(include(unlocked: false, unlocked_at: nil))
      expect(badges.first).to include(
        id: "first_play",
        name: "初陣",
        category: "初級"
      )
      # カテゴリはカタログ定義順（タブ表示もこの順に従う）
      expect(badges.map { |b| b[:category] }.uniq).to eq(%w[初級 精度 スピード 継続 特別])
      # 初陣は積算進捗を持つ（進捗なしは複合条件の完全無欠のみ）
      expect(badges.first[:progress]).to eq(current: "0", target: "1回")
    end
  end

  describe "解除と解除日時" do
    it "初陣は最初のプレイで解除され、解除日時はそのプレイの日時になる" do
      user = create(:user)
      first = create(:game_result, :random_result, user: user, accuracy: 80, created_at: 3.days.ago)
      create(:game_result, :random_result, user: user, accuracy: 80)

      expect(badge(user, "first_play")).to include(unlocked: true, unlocked_at: first.created_at)
    end

    it "閾値バッジは条件を初めて満たしたプレイの日時で解除され、後続のより良い記録では動かない" do
      user = create(:user)
      create(:game_result, :random_result, user: user, accuracy: 90, created_at: 3.days.ago)
      unlocking = create(:game_result, :random_result, user: user, accuracy: 96, created_at: 2.days.ago)
      create(:game_result, :random_result, user: user, accuracy: 100, created_at: 1.day.ago)

      expect(badge(user, "adept")).to include(unlocked: true, unlocked_at: unlocking.created_at)
    end

    it "完全無欠は正確率100%かつ44札の複合条件で、片方だけでは解除されない" do
      user = create(:user)
      create(:game_result, :random_result, user: user, accuracy: 100, correct_cards: 43)
      create(:game_result, :random_result, user: user, accuracy: 99, correct_cards: 44)
      expect(badge(user, "flawless")).to include(unlocked: false)

      create(:game_result, :random_result, user: user, accuracy: 100, correct_cards: 44)
      expect(badge(user, "flawless")).to include(unlocked: true)
    end
  end

  describe "進捗表示" do
    it "タイム系はベストタイムを mm:ss で表示する（1:52 / 1:30）" do
      user = create(:user)
      create(:game_result, :timeattack_result, user: user, time_ms: 145_000)
      create(:game_result, :timeattack_result, user: user, time_ms: 112_000)

      expect(badge(user, "godspeed")[:progress]).to eq(current: "1:52", target: "1:30")
      expect(badge(user, "lightning")).to include(unlocked: true) # 145s ≤ 2:30
    end

    it "最良値方式のバッジは該当する記録が無ければ進捗を持たない" do
      user = create(:user)
      create(:game_result, :random_result, user: user) # タイムアタック記録なし

      expect(badge(user, "godspeed")[:progress]).to be_nil
      expect(badge(user, "lightning")[:progress]).to be_nil
    end

    it "スコア系はベストスコアを桁区切りで表示する" do
      user = create(:user)
      create(:game_result, :random_result, user: user, score: 3200)
      create(:game_result, :random_result, user: user, score: 4100)

      expect(badge(user, "monument")[:progress]).to eq(current: "4,100", target: "5,000")
      expect(badge(user, "monument")).to include(unlocked: false)
    end

    it "タイム系・スコア系はモードも判定する（逆モードに値が紛れても解除・進捗に使わない）" do
      user = create(:user)
      # API はモードに関係なく score/time を permit しているため、逆モードに値が載った行を防げない。
      # バッジの条件は「タイムアタックのタイム」「ランダムのスコア」なのでモードで弾く
      create(:game_result, user: user, game_mode: "random", score: 1_000, time_ms: 80_000)
      create(:game_result, user: user, game_mode: "timeattack", score: 6_000, time_ms: 200_000)

      expect(badge(user, "lightning")).to include(unlocked: false)
      expect(badge(user, "godspeed")).to include(unlocked: false)
      expect(badge(user, "godspeed")[:progress]).to eq(current: "3:20", target: "1:30")
      expect(badge(user, "monument")).to include(unlocked: false)
      expect(badge(user, "monument")[:progress]).to eq(current: "1,000", target: "5,000")
    end

    it "国士無双の進捗は上級プレイの正確率だけを見る" do
      user = create(:user)
      create(:game_result, :random_result, user: user, difficulty: "standard", accuracy: 99)
      create(:game_result, :random_result, user: user, difficulty: "advanced", accuracy: 91)

      expect(badge(user, "kokushi")[:progress]).to eq(current: "91%", target: "95%")
      expect(badge(user, "kokushi")).to include(unlocked: false)
    end
  end

  describe "制覇系" do
    it "群馬の主は6通り目が埋まったプレイの日時で解除され、進捗は到達済みの通り数を返す" do
      user = create(:user)
      combos = %w[beginner standard advanced].product(%w[random timeattack])
      completing = nil
      combos.each_with_index do |(difficulty, mode), i|
        trait = mode == "random" ? :random_result : :timeattack_result
        completing = create(:game_result, trait, user: user, difficulty: difficulty,
                                                 created_at: (10 - i).days.ago)
      end

      expect(badge(user, "gunma_master")).to include(unlocked: true, unlocked_at: completing.created_at)
      expect(badge(user, "dual_wielder")).to include(unlocked: true)
      expect(badge(user, "all_difficulties")).to include(unlocked: true)
    end

    it "未制覇のときは到達済みの数を進捗として返す" do
      user = create(:user)
      create(:game_result, :random_result, user: user, difficulty: "beginner")
      create(:game_result, :random_result, user: user, difficulty: "standard")
      create(:game_result, :random_result, user: user, difficulty: "standard") # 重複は数えない

      expect(badge(user, "gunma_master")[:progress]).to eq(current: "2", target: "6通り")
      expect(badge(user, "dual_wielder")[:progress]).to eq(current: "1", target: "2モード")
      expect(badge(user, "all_difficulties")[:progress]).to eq(current: "2", target: "3難易度")
    end
  end

  describe "継続系（連続プレイ）" do
    it "7日連続の7日目最初のプレイで七日精進が解除される" do
      user = create(:user)
      (1..6).each { |d| play_at(user, "2026-07-0#{d} 12:00") }
      completing = play_at(user, "2026-07-07 09:00")
      play_at(user, "2026-07-07 21:00") # 同日2プレイ目は解除日時に影響しない

      expect(badge(user, "seven_days")).to include(unlocked: true, unlocked_at: completing.created_at)
    end

    it "連続が途切れた後も、史上最大の連続日数で解除は維持される" do
      user = create(:user)
      (1..7).each { |d| play_at(user, "2026-06-0#{d} 12:00") } # 過去に7日連続
      play_at(user, "2026-07-20 12:00")                        # 途切れて単発

      travel_to(JST.parse("2026-07-20 22:00")) do
        expect(badge(user, "seven_days")).to include(unlocked: true)
        expect(badge(user, "thirty_days")).to include(unlocked: false)
      end
    end

    it "6日連続では解除されない（同日の複数プレイは1日と数える）" do
      user = create(:user)
      (1..6).each do |d|
        play_at(user, "2026-07-0#{d} 10:00")
        play_at(user, "2026-07-0#{d} 20:00")
      end

      expect(badge(user, "seven_days")).to include(unlocked: false)
    end

    it "日の境界は JST の暦日で判定する（UTC では同日でも JST で日付が変われば2日）" do
      user = create(:user)
      play_at(user, "2026-07-01 23:30") # UTC 2026-07-01 14:30
      play_at(user, "2026-07-02 00:30") # UTC 2026-07-01 15:30 — UTC では同日

      travel_to(JST.parse("2026-07-02 01:00")) do
        expect(badge(user, "seven_days")[:progress]).to eq(current: "2", target: "7日")
      end
    end

    it "今日まだプレイしていなくても昨日までの連続は生きている" do
      user = create(:user)
      play_at(user, "2026-07-18 12:00")
      play_at(user, "2026-07-19 12:00")

      travel_to(JST.parse("2026-07-20 23:00")) do
        expect(badge(user, "seven_days")[:progress]).to eq(current: "2", target: "7日")
      end
    end

    it "昨日までにプレイが無ければ連続は 0 に戻る" do
      user = create(:user)
      play_at(user, "2026-07-18 12:00")

      travel_to(JST.parse("2026-07-20 12:00")) do
        expect(badge(user, "seven_days")[:progress]).to eq(current: "0", target: "7日")
      end
    end
  end
end
