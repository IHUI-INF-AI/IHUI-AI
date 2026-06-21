#!/usr/bin/env bash
# Helm chart OCI 打包 + 推送脚本
# 用途: 本地或 CI 中打包 chart 并推送到 OCI registry (Harbor / GHCR / ACR)
# 用法:
#   ./scripts/ci/helm_oci_publish.sh <chart-path> <version> [oci-registry]
#
# 示例:
#   ./scripts/ci/helm_oci_publish.sh deploy/helm/zhs-platform 1.0.0 harbor.zhs.local

set -euo pipefail

CHART_PATH="${1:-deploy/helm/zhs-platform}"
VERSION="${2:-$(grep '^version:' "$CHART_PATH/Chart.yaml" | awk '{print $2}')}"
OCI_REGISTRY="${3:-${OCI_REGISTRY:-harbor.zhs.local}}"
NAMESPACE="${NAMESPACE:-charts}"
APP_VERSION="${APP_VERSION:-$VERSION}"

echo "==> 准备打包 Helm chart"
echo "    chart  : $CHART_PATH"
echo "    version: $VERSION"
echo "    app    : $APP_VERSION"
echo "    oci    : oci://$OCI_REGISTRY/$NAMESPACE"

# 1. Lint
echo "==> helm lint"
helm lint "$CHART_PATH" --strict

# 2. Package
echo "==> helm package"
mkdir -p /tmp/charts
helm package "$CHART_PATH" \
  --version "$VERSION" \
  --app-version "$APP_VERSION" \
  -d /tmp/charts

TGZ="/tmp/charts/$(basename "$CHART_PATH")-$VERSION.tgz"
ls -lh "$TGZ"

# 3. 推送到 OCI (可选, 当 OCI_REGISTRY_USER 设置时)
if [ -n "${OCI_REGISTRY_USER:-}" ]; then
  echo "==> helm registry login"
  echo "$OCI_REGISTRY_PASSWORD" | helm registry login "$OCI_REGISTRY" \
    -u "$OCI_REGISTRY_USER" --password-stdin

  echo "==> helm push"
  helm push "$TGZ" "oci://$OCI_REGISTRY/$NAMESPACE"

  echo "==> 推送完成: oci://$OCI_REGISTRY/$NAMESPACE/$(basename "$CHART_PATH"):$VERSION"
else
  echo "==> OCI_REGISTRY_USER 未设置, 跳过推送, 仅打包到 $TGZ"
fi

# 4. 同步到本地 chart repo (可选)
if [ -n "${LOCAL_CHART_REPO:-}" ]; then
  echo "==> 同步到本地 chart repo: $LOCAL_CHART_REPO"
  cp "$TGZ" "$LOCAL_CHART_REPO/"
  helm repo index "$LOCAL_CHART_REPO" --merge "$LOCAL_CHART_REPO/index.yaml" || true
fi

echo "==> 完成"
