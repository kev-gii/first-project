#!/usr/bin/env bash
# 本地构建并把 dist/ 发布到 gh-pages 分支（手动发布，不使用 GitHub Actions）
#
# 用法：
#   bash tools/publish-gh-pages.sh            # 构建 + 提交 + push origin gh-pages
#   bash tools/publish-gh-pages.sh --dry-run  # 构建 + 提交（分支留在本地），跳过 push
#
# 行为：
#   npm run build → 在独立的 git worktree 中准备 gh-pages 内容
#   （首次自动创建 orphan 分支，无 main 历史）→ 提交 → 推送。
#   全程不改动 main 工作区；要求 main 工作区干净才运行。
set -euo pipefail

DRY_RUN=0
[ "${1:-}" = "--dry-run" ] && DRY_RUN=1

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

# main 工作区必须干净（脚本只在独立 worktree 中操作，避免与未提交内容混淆）
if ! git diff --quiet HEAD -- 2>/dev/null || ! git diff --cached --quiet -- 2>/dev/null; then
  echo "!! main 工作区存在未提交改动，请先 commit 或 stash 后再运行本脚本" >&2
  exit 1
fi

echo "==> 1/4 构建：npm run build"
npm run build

DEPLOY_WT="$(mktemp -d "${TMPDIR:-/tmp}/gp-deploy.XXXXXX")"
cleanup() {
  rm -rf "$DEPLOY_WT" 2>/dev/null || true
  git worktree remove "$DEPLOY_WT" --force 2>/dev/null || true
  git worktree prune 2>/dev/null || true
}
trap cleanup EXIT

git worktree add --detach "$DEPLOY_WT" HEAD >/dev/null
cd "$DEPLOY_WT"

MAIN_REV="$(git rev-parse --short HEAD)"

echo "==> 2/4 准备 gh-pages 内容"
if git show-ref --verify --quiet refs/heads/gh-pages; then
  git checkout gh-pages
  # 清空旧站点内容（worktree 里的 .git 是指针文件，需保留）
  find . -mindepth 1 -not -path './.git' -not -path './.git/*' -delete 2>/dev/null || true
else
  # 首次发布：创建 orphan 的 gh-pages 分支（不带 main 历史）
  git checkout --orphan gh-pages
  git rm -rf . 2>/dev/null || true
  find . -mindepth 1 -not -path './.git' -not -path './.git/*' -delete 2>/dev/null || true
fi

# 复制构建产物（vendor/ 为 Vite 产物，assets/ data/ 为 public 静态文件，二者不冲突）
cp -R "$REPO_ROOT/dist/." .

echo "==> 3/4 提交"
git add -A
if git diff --cached --quiet; then
  # 内容已是最新（main 自上次发布后未变）：无需新建提交，正常退出
  echo "本次构建内容与现有 gh-pages 完全一致（main @ $(git log -1 --format=%h) 未变），无需新提交。"
else
  git commit -q -m "publish: site build $(date '+%Y-%m-%d %H:%M') [main @ ${MAIN_REV}]"
fi

if [ "$DRY_RUN" = "1" ]; then
  echo "==> 4/4 dry-run：已提交到本地 gh-pages 分支，跳过 push（去掉 --dry-run 再跑即可发布）"
  exit 0
fi

echo "==> 4/4 推送 origin gh-pages"
git push origin gh-pages

echo "完成。请在 GitHub 仓库 Settings → Pages 确认 Source = Deploy from a branch（gh-pages，/ root）。"
echo "站点地址：https://<用户名>.github.io/<仓库名>/"
