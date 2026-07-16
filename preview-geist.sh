#!/bin/zsh
# Geist 视觉预览：构建前端 + 本地隔离环境（本地 D1 + fixture 数据，不碰生产）
set -e
cd "$(dirname "$0")"

PERSIST="${TMPDIR:-/tmp}/geist-preview-d1"
mkdir -p "$PERSIST"

npm run build

# 首次运行时初始化本地数据库
if [ ! -f "$PERSIST/.seeded" ]; then
  npx wrangler d1 execute giverny-agent-eval --local --config agent-evals/wrangler.eval.toml --persist-to "$PERSIST" --file db/schema.sql
  npx wrangler d1 execute giverny-agent-eval --local --config agent-evals/wrangler.eval.toml --persist-to "$PERSIST" --file agent-evals/fixture.sql
  touch "$PERSIST/.seeded"
fi

echo ""
echo "预览地址: http://127.0.0.1:8799"
echo "管理员登录: bh141425@gmail.com / eval-admin-key"
echo "主题切换: 页面右下角 ◐ 按钮"
echo ""
npx wrangler dev --local --config agent-evals/wrangler.eval.toml --persist-to "$PERSIST" --port 8799
