#!/usr/bin/env bash
# ============================================================================
# Production PostgreSQL Alembic 升级脚本 (172.21.0.15)
# 用途: 首次 / 例行 把 zhs_ai_project / zhs_center_project / zhs_educational_training
#       三个库升级到 alembic head.
#
# 安全:
#   1. 跑前先 --dry-run 校验脚本链
#   2. 默认逐库升级, 任一失败立即停, 不会跨库污染
#   3. --reversibility 模式会 head → -1 → head 验证回滚
#
# 用法:
#   ./scripts/alembic_production_upgrade.sh --dry-run
#   ./scripts/alembic_production_upgrade.sh --upgrade
#   ./scripts/alembic_production_upgrade.sh --reversibility
#   ./scripts/alembic_production_upgrade.sh --downgrade -1
# ============================================================================
set -euo pipefail

ENV_FILE=".env.production"
SCRIPT="scripts/ci/alembic_ci.py"

# 颜色
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

banner() {
    echo -e "${GREEN}============================================================${NC}"
    echo -e "${GREEN} ZHS Platform - Alembic Production Migration${NC}"
    echo -e "${GREEN} 目标: 172.21.0.15:5432 (3 库)${NC}"
    echo -e "${GREEN}============================================================${NC}"
}

# 依赖: python / pip / .env.production
preflight() {
    if [[ ! -f "$ENV_FILE" ]]; then
        echo -e "${RED}✗ $ENV_FILE 不存在${NC}"
        exit 2
    fi
    if ! command -v python >/dev/null; then
        echo -e "${RED}✗ python 不可用${NC}"
        exit 2
    fi
    if [[ ! -f "$SCRIPT" ]]; then
        echo -e "${RED}✗ $SCRIPT 不存在${NC}"
        exit 2
    fi
    echo -e "${YELLOW}ⓘ ENV: $ENV_FILE${NC}"
    echo -e "${YELLOW}ⓘ SCRIPT: $SCRIPT${NC}"
}

main() {
    banner
    preflight
    case "${1:-}" in
        --dry-run)
            echo -e "${YELLOW}>> DRY-RUN: 仅校验脚本链, 不连 DB${NC}"
            python "$SCRIPT" dry-run --env "$ENV_FILE"
            ;;
        --upgrade)
            echo -e "${YELLOW}>> UPGRADE 3 库到 head${NC}"
            # 1) 先 dry-run
            python "$SCRIPT" dry-run --env "$ENV_FILE" || { echo -e "${RED}✗ 脚本链校验失败, 升级中止${NC}"; exit 1; }
            # 2) 逐库升级
            python "$SCRIPT" upgrade --env "$ENV_FILE" --db ai
            python "$SCRIPT" upgrade --env "$ENV_FILE" --db center
            python "$SCRIPT" upgrade --env "$ENV_FILE" --db course
            echo -e "${GREEN}✓ 三个库全部升级到 head${NC}"
            # 3) 校验
            python "$SCRIPT" current --env "$ENV_FILE" --db all
            ;;
        --reversibility)
            echo -e "${YELLOW}>> REVERSIBILITY: 验证迁移可逆 (head → -1 → head)${NC}"
            python "$SCRIPT" reversibility --env "$ENV_FILE" --db ai
            python "$SCRIPT" reversibility --env "$ENV_FILE" --db center
            python "$SCRIPT" reversibility --env "$ENV_FILE" --db course
            echo -e "${GREEN}✓ 三个库迁移可逆性验证通过${NC}"
            ;;
        --downgrade)
            shift
            target="${1:-1}"
            echo -e "${YELLOW}>> DOWNGRADE 3 库, target=$target${NC}"
            python "$SCRIPT" downgrade --env "$ENV_FILE" --db ai "$target"
            python "$SCRIPT" downgrade --env "$ENV_FILE" --db center "$target"
            python "$SCRIPT" downgrade --env "$ENV_FILE" --db course "$target"
            ;;
        --history)
            python "$SCRIPT" history --env "$ENV_FILE" --db ai
            ;;
        --current)
            python "$SCRIPT" current --env "$ENV_FILE" --db all
            ;;
        -h|--help|*)
            cat <<EOF
用法:
  $0 --dry-run         仅校验迁移链
  $0 --upgrade         三个库升级到 head
  $0 --reversibility   验证 head → -1 → head
  $0 --downgrade [N]   三个库降级 N 步 (默认 1)
  $0 --history         查看迁移历史
  $0 --current         查看当前版本
EOF
            exit 0
            ;;
    esac
}

main "$@"
