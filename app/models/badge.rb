# バッジのカタログと導出（#21 / ADR 0007）。
# 解除テーブルは持たず、解除状態・解除日時・進捗をすべて game_results から毎回導出する。
# カタログの増減・閾値変更はこのファイルだけで完結させる（フロントは評価結果の汎用レンダラー）。
# 進捗はフロントに書式分岐を持たせないため、表示用の { current:, target: } 文字列ペアで返す。
class Badge
  CATEGORIES = %w[初級 精度 スピード 継続 特別].freeze

  # unlock:   Stats を受け取り、解除済みなら「条件を初めて満たしたプレイ」の created_at、未解除なら nil
  # progress: Stats を受け取り表示用ペア { current:, target: }、進捗表示を持たないバッジは nil
  Definition = Data.define(:id, :name, :description, :category, :unlock, :progress)

  # game_results（created_at 昇順の配列）に対する集計。バッジ評価で共有する
  class Stats
    JST = ActiveSupport::TimeZone["Asia/Tokyo"]

    attr_reader :results

    def initialize(results)
      @results = results
    end

    def total_plays = results.size

    def nth_play_at(n) = results[n - 1]&.created_at

    def first_at(&) = results.find(&)&.created_at

    def best_max(&) = results.filter_map(&).max

    def best_min(&) = results.filter_map(&).min

    # モード網羅（2種）: [到達種数, 全種が揃ったプレイの created_at | nil]
    def mode_coverage = @mode_coverage ||= coverage(2, &:game_mode)

    # 難易度網羅（3種）
    def difficulty_coverage = @difficulty_coverage ||= coverage(3, &:difficulty)

    # モード×難易度網羅（6通り）
    def combo_coverage = @combo_coverage ||= coverage(6) { |r| [r.game_mode, r.difficulty] }

    # n日連続を最初に達成した日の、その日最初のプレイの created_at（未達成なら nil）。
    # 判定は現在ではなく史上最大の連続に対して行う（CONTEXT.md「連続プレイ」）
    def streak_unlocked_at(n)
      run = 0
      prev = nil
      play_days.each do |day|
        run = prev && day == prev + 1 ? run + 1 : 1
        prev = day
        return first_play_on(day) if run >= n
      end
      nil
    end

    # 現在進行中の連続日数。今日プレイが無くても昨日までの連続は生きている
    def current_streak
      days = play_days.to_set
      today = Time.current.in_time_zone(JST).to_date
      anchor = [today, today - 1].find { |d| days.include?(d) }
      return 0 unless anchor

      run = 0
      run += 1 while days.include?(anchor - run)
      run
    end

    private

    # JST の暦日（昇順・重複なし）
    def play_days
      @play_days ||= results.map { |r| r.created_at.in_time_zone(JST).to_date }.uniq
    end

    def first_play_on(day)
      results.find { |r| r.created_at.in_time_zone(JST).to_date == day }&.created_at
    end

    def coverage(target_count, &key)
      seen = {}
      unlocked_at = nil
      results.each do |r|
        k = key.call(r)
        next if seen.key?(k)
        seen[k] = true
        unlocked_at = r.created_at if seen.size == target_count
      end
      [seen.size, unlocked_at]
    end
  end

  CATALOG = [
    Definition.new(
      id: "first_play", name: "初陣", category: "初級",
      description: "初めてゲームをプレイする",
      unlock: ->(s) { s.nth_play_at(1) },
      progress: ->(s) { nil }
    ),
    Definition.new(
      id: "dual_wielder", name: "両刀使い", category: "初級",
      description: "ランダムとタイムアタックの両モードをプレイする",
      unlock: ->(s) { s.mode_coverage.last },
      progress: ->(s) { { current: s.mode_coverage.first.to_s, target: "2モード" } }
    ),
    Definition.new(
      id: "all_difficulties", name: "三段構え", category: "初級",
      description: "3つの難易度すべてでプレイする",
      unlock: ->(s) { s.difficulty_coverage.last },
      progress: ->(s) { { current: s.difficulty_coverage.first.to_s, target: "3難易度" } }
    ),
    Definition.new(
      id: "perfect_accuracy", name: "百発百中", category: "精度",
      description: "1プレイで正確率100%を達成する",
      unlock: ->(s) { s.first_at { |r| r.accuracy >= 100 } },
      progress: ->(s) { (best = s.best_max(&:accuracy)) && { current: "#{best}%", target: "100%" } }
    ),
    Definition.new(
      id: "flawless", name: "完全無欠", category: "精度",
      description: "ランダムモードで全44札を正確率100%で取りきる",
      unlock: ->(s) { s.first_at { |r| r.game_mode == "random" && r.accuracy >= 100 && r.correct_cards >= 44 } },
      progress: ->(s) { nil } # 2軸の複合条件は1つの分数に潰せないため進捗表示なし
    ),
    Definition.new(
      id: "adept", name: "手練", category: "精度",
      description: "正確率95%以上を達成する",
      unlock: ->(s) { s.first_at { |r| r.accuracy >= 95 } },
      progress: ->(s) { (best = s.best_max(&:accuracy)) && { current: "#{best}%", target: "95%" } }
    ),
    Definition.new(
      id: "immovable", name: "不動明王", category: "精度",
      description: "最大コンボ100以上を達成する",
      unlock: ->(s) { s.first_at { |r| r.max_combo >= 100 } },
      progress: ->(s) { (best = s.best_max(&:max_combo)) && { current: best.to_s, target: "100" } }
    ),
    Definition.new(
      id: "lightning", name: "電光石火", category: "スピード",
      description: "タイムアタックを2分30秒以内で完走する",
      unlock: ->(s) { s.first_at { |r| r.time_ms && r.time_ms <= 150_000 } },
      progress: ->(s) { (best = s.best_min(&:time_ms)) && { current: Badge.format_time(best), target: "2:30" } }
    ),
    Definition.new(
      id: "godspeed", name: "神速", category: "スピード",
      description: "タイムアタックを1分30秒以内で完走する",
      unlock: ->(s) { s.first_at { |r| r.time_ms && r.time_ms <= 90_000 } },
      progress: ->(s) { (best = s.best_min(&:time_ms)) && { current: Badge.format_time(best), target: "1:30" } }
    ),
    Definition.new(
      id: "gale", name: "疾風", category: "スピード",
      description: "WPM 60以上を達成する",
      unlock: ->(s) { s.first_at { |r| r.wpm >= 60 } },
      progress: ->(s) { (best = s.best_max(&:wpm)) && { current: best.to_s, target: "60" } }
    ),
    Definition.new(
      id: "idaten", name: "韋駄天", category: "スピード",
      description: "WPM 80以上を達成する",
      unlock: ->(s) { s.first_at { |r| r.wpm >= 80 } },
      progress: ->(s) { (best = s.best_max(&:wpm)) && { current: best.to_s, target: "80" } }
    ),
    Definition.new(
      id: "seven_days", name: "七日精進", category: "継続",
      description: "7日連続でプレイする",
      unlock: ->(s) { s.streak_unlocked_at(7) },
      progress: ->(s) { { current: s.current_streak.to_s, target: "7日" } }
    ),
    Definition.new(
      id: "thirty_days", name: "三十日行", category: "継続",
      description: "30日連続でプレイする",
      unlock: ->(s) { s.streak_unlocked_at(30) },
      progress: ->(s) { { current: s.current_streak.to_s, target: "30日" } }
    ),
    Definition.new(
      id: "hundred_plays", name: "千里の道", category: "継続",
      description: "通算100回プレイする",
      unlock: ->(s) { s.nth_play_at(100) },
      progress: ->(s) { { current: s.total_plays.to_s, target: "100回" } }
    ),
    Definition.new(
      id: "monument", name: "金字塔", category: "特別",
      description: "ランダムモードでスコア5,000以上を達成する",
      unlock: ->(s) { s.first_at { |r| r.score && r.score >= 5_000 } },
      progress: ->(s) { (best = s.best_max(&:score)) && { current: Badge.delimit(best), target: "5,000" } }
    ),
    Definition.new(
      id: "kokushi", name: "国士無双", category: "特別",
      description: "上級難易度で正確率95%以上を達成する",
      unlock: ->(s) { s.first_at { |r| r.difficulty == "advanced" && r.accuracy >= 95 } },
      progress: ->(s) {
        best = s.best_max { |r| r.accuracy if r.difficulty == "advanced" }
        best && { current: "#{best}%", target: "95%" }
      }
    ),
    Definition.new(
      id: "gunma_master", name: "群馬の主", category: "特別",
      description: "全モード×全難易度の6通りを制覇する",
      unlock: ->(s) { s.combo_coverage.last },
      progress: ->(s) { { current: s.combo_coverage.first.to_s, target: "6通り" } }
    )
  ].freeze

  def self.evaluate(results)
    stats = Stats.new(results)
    CATALOG.map do |d|
      unlocked_at = d.unlock.call(stats)
      {
        id: d.id,
        name: d.name,
        description: d.description,
        category: d.category,
        unlocked: !unlocked_at.nil?,
        unlocked_at: unlocked_at,
        progress: d.progress.call(stats)
      }
    end
  end

  def self.format_time(ms)
    sec = ms / 1000
    format("%d:%02d", sec / 60, sec % 60)
  end

  def self.delimit(n) = ActiveSupport::NumberHelper.number_to_delimited(n)
end
