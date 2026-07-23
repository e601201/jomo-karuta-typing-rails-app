---
name: update-dependencies
description: Update Ruby gems and Node (bun) packages to their latest versions for the jomo-karuta-typing-rails-app. Use whenever the user says "依存関係を更新して", "依存関係をアップデート", asks to run bundle update / ncu, or asks to update gems or Node packages. Runs bundle update --all and npx npm-check-updates -u, validates gems with rubocop / brakeman / rails test and Node with bun run check / lint / test, holds back known-incompatible majors (TypeScript 7, @types/node ahead of the Node runtime), rolls back on failure, and creates a single combined commit matching the project convention (依存関係を…更新する).
---

# 依存関係更新スキル

This skill updates the Ruby gems and Node packages of the **jomo-karuta-typing-rails-app** to their latest versions. Both package managers land in **one combined commit** (`依存関係を…更新する`), mirroring the existing project convention (`ead7097`, `783c082`). On any validation failure, the working tree is rolled back so the repository is never left in a broken intermediate state.

**このリポジトリは Node パッケージに bun を使う** (`bun.lock`、`package-lock.json` は無い)。`npm install` / `npm run` は使わない — `bun install` / `bun run` を使う。

## 前提条件

Before doing anything, verify the working tree is clean:

```bash
git status --porcelain
```

If output is non-empty, stop and tell the user to commit or stash their changes first. Rollback assumes a clean baseline — running on top of dirty state would `git checkout --` the user's in-progress work. (未追跡ファイル、例えばこのスキル自身の `.claude/skills/update-dependencies/` は `git checkout --` の対象外なので、残っていても続行して構わない。)

Do **not** create a feature branch. The recent project convention is to land these directly on the current branch.

## ステップ 1 — gem の更新

### 1.1 更新前のスナップショット

Save the pre-update gem versions so the commit message can list what actually changed:

```bash
cp Gemfile.lock /tmp/Gemfile.lock.before
```

### 1.2 bundle update を実行

```bash
bundle update --all
```

`--all` is required: without it Bundler emits a deprecation warning, and Bundler 3 will refuse to update everything unless the flag is passed.

If `Gemfile.lock` is unchanged after this (compare with `/tmp/Gemfile.lock.before`), nothing was outdated — skip the rest of step 1 and move to step 2. Tell the user "gem は最新でした".

### 1.3 検証

Run the checks in this order — fail fast on cheap checks before paying for the test suite:

1. `bin/rubocop`
2. `bin/brakeman -q --no-pager`
3. `bin/rails test`

Any non-zero exit is a failure. Capture the failing command's output for the report.

### 1.4 失敗時のロールバック

If any check failed:

```bash
git checkout -- Gemfile.lock
```

Then report to the user: which validation failed, the relevant tail of its output, and the gem(s) most likely responsible (cross-reference the failing test/file with the diff captured earlier). **Stop the skill** — do not proceed to Node. The user needs to decide whether to pin a gem, fix code, or skip this update.

### 1.5 成功時

**コミットはまだしない。** gem の変更は作業ツリーに残したまま、ステップ 2 に進む。gem と Node をステップ 3 でまとめて1つのコミットにする。

## ステップ 2 — Node (bun) の更新

### 2.1 ncu でバージョン引き上げ

`npx npm-check-updates -u` rewrites `package.json` to the latest versions, **including major bumps**, and prints the diff. ncu はこのリポジトリの bun を自動検出する (`Using bun` と表示され、書き換えるのは `package.json` のみ)。Capture stdout — it's the source of truth for the commit message body:

```bash
npx npm-check-updates -u | tee /tmp/ncu.out
```

If ncu reports "All dependencies match the latest package versions", skip to the final report — there is nothing to update on the Node side.

### 2.2 lockfile と node_modules を更新

```bash
bun install
```

### 2.3 検証

**3つすべてを実行する。`check`（型チェック）だけでは不十分。**

1. `bun run check` — tsc の型チェック（app / node 両 config）
2. `bun run lint`  — prettier --check + eslint（typescript-eslint 経由）
3. `bun run test`  — vitest

Any non-zero exit is a failure.

**`check` は通るのに `lint` が落ちる典型が TypeScript の major 更新。** typescript-eslint は TS7 に未対応で、`tsc` は通るのに eslint がロード時にクラッシュする (`typescript-eslint does not support TS 7.0`)。この破壊は `check` だけでは検出できない — スキルが以前この検証を `check` のみにしていたため見逃した。だから lint と test を必ず併せて回す。

### 2.4 既知の据え置き（ncu が上げてくるが採用しない major）

以下は ncu が最新へ引き上げるが、検証を壊す/実行環境と乖離するため採用しない。`package.json` の該当行を元のレンジに戻し、再度 `bun install` → 2.3 の検証をやり直す。**他のパッケージの更新はそのまま残す。**

- **typescript**: TS7 は typescript-eslint 未対応で lint がクラッシュする（`tsc`＝`check` は通る）。typescript-eslint が TS>=7.1 に対応するまで元の `~6` 系に据え置き（追跡: typescript-eslint#10940）。
- **@types/node**: ランタイムの Node major に合わせる。`node --version` が v24 なら元の `^24` 系に据え置き（26 に上げるとランタイムに無い API の型が入り、実行時エラーを型で隠す）。`engines` / `.node-version` の固定は無いので `node --version` が正。

据え置いた major は、コミット本文の「意図的に見送り」節に理由付きで列挙する。ここに挙げていない major（例: `@testing-library/jest-dom` の 6→7）は、2.3 の検証（check / lint / test）がすべて通るなら採用してよい。

### 2.5 失敗時のロールバック

2.3 の検証が（2.4 の据え置き対応後も）通らない場合、Node 側だけを戻す:

```bash
git checkout -- package.json bun.lock
bun install
```

The second `bun install` re-syncs `node_modules` to the restored lockfile. Report the failing output to the user along with which packages bumped majors (parse `/tmp/ncu.out`) — those are the prime suspects.

ステップ 1 の gem 変更は作業ツリーに残っている。Node 側が完全に失敗して戻した場合は、**gem 変更だけでステップ 3 のコミットを作る**（本文の Node 節は省く）。

## ステップ 3 — まとめてコミット

gem と Node の変更を **1つのコミット**にする。`-a` は使わず、変更したファイルだけを明示的にステージする:

```bash
git add Gemfile.lock package.json bun.lock
```

（変更がなかった側のファイルは省く。gem 変更なしなら `Gemfile.lock` を外す等。）

### 本文の組み立て

gem 側は lockfile 差分から列挙する。`Gemfile.lock` の `    gemname (1.2.3)` 行が resolved version。`<` と `>` の行をペアにする:

```bash
diff /tmp/Gemfile.lock.before Gemfile.lock \
  | awk '/^[<>] {5}[a-z0-9_-]+ \(/ { gsub(/[()]/, ""); print $1, $2, $3 }'
```

The space count is exactly 5 — `diff`'s own separator space, plus the 4-space indent that marks a resolved version under `GEM specs`. That exactness is the filter: checksum lines (2-space indent) and dependency constraint lines (6-space indent) name the same gems, so loosening this to ` +` yields duplicates and bogus versions like `loofah ~>`. If this ever prints nothing, suspect the pattern before concluding no gems changed — a mismatch here exits 0 silently, looking exactly like "nothing to update".

Node 側は `/tmp/ncu.out` の `pkgname  ^X.Y.Z  →  ^A.B.C` 行から取るが、**2.4 で据え置いたパッケージは除外する**（実際に変わっていないため）。念のため `git diff --cached package.json` と突き合わせて、ステージされた差分と一致することを確認する。

各行は `- pkgname OLD → NEW` に整形する（全角矢印 `→`、`^` / `~` プレフィックスは落とす。既存コミットの体裁に合わせる）。

### コミットメッセージの形式

`783c082` に倣う。変更のない側の節は省く:

```
依存関係を更新する

gem（Gemfile.lock）:
- gemA X.Y.Z → A.B.C

Node / bun（package.json / bun.lock）:
- pkgA X.Y.Z → A.B.C

以下の major 更新は意図的に見送り:
- typescript 7.x — typescript-eslint 未対応で lint がクラッシュ（tsc は通る、#10940）
- @types/node 26 — ランタイムの Node v24 に合わせて据え置き

検証: bin/rubocop / brakeman / rails test、bun run check / lint / test すべて green。
```

コミット末尾には、このリポジトリの他コミット（`ead7097` / `783c082` 等）と同じく `Co-Authored-By:` と `Claude-Session:` トレーラーを付ける。`git commit` を直接実行してよい。

## 最終報告

End with a short summary in Japanese:

- gem: 更新あり / 変更なし / 失敗 (理由)
- Node (bun): 更新あり / 変更なし / 失敗 (理由)
- 据え置いた major があればその一覧と理由
- コミット: `<short-sha>`（作成した場合）

Do **not** push. The user reviews the diffs locally and pushes themselves — that's the convention here, and it gives them a chance to catch a major bump that passed validation but might still be risky in the browser.

## 重要な制約

**gem と Node は1つのコミットにまとめる。** 既存の履歴（`依存関係を…更新する` が gem と Node の両変更を1コミットに含む — `ead7097` / `783c082`）がこの慣例。片側だけの変更でもタイトルは同じ。

**ステップ 1 が失敗したらステップ 2 に進まない。** A broken Ruby side means tests can't validate anything downstream — running Node updates on top would just compound the problem. （Node 側だけが失敗した場合は、検証済みの gem 変更だけをコミットしてよい。）

**ロールバックは `git checkout --` で行う。** Never `git reset --hard` or `git stash drop` — those can wipe unrelated state. The precondition check at the top guarantees only the lockfiles / package.json are dirty, so a targeted checkout is sufficient and safe. Node 側の対象は `package.json` と `bun.lock`（`package-lock.json` ではない）。

**`bundle install` を `bundle update --all` の代わりに使わない。** `bundle install` only resolves missing gems against the existing lockfile; it does not bump versions. The user's intent ("依存関係を更新して") requires `bundle update --all`.

**`npm` を使わない。** Node 側は bun。`bun install` / `bun run check|lint|test`、lockfile は `bun.lock`。`npm install` は `package-lock.json` を生成して bun ワークフローと競合するので使わない。
