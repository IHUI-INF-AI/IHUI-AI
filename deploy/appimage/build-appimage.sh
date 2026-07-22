#!/bin/bash
# IHUI AI CLI — AppImage 构建脚本
# 用法: ./deploy/appimage/build-appimage.sh
# 依赖: linuxdeploy, Node.js SEA (Single Executable Application)
# 产物: IHUI-x86_64.AppImage

set -eu

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
BUILD_DIR="${PROJECT_ROOT}/.appimage-build"
OUTPUT_DIR="${PROJECT_ROOT}/dist-appimage"
APP_NAME="IHUI"
APP_VERSION="${IHUI_VERSION:-1.0.0}"
ARCH="x86_64"

log() {
    printf '\033[36m[appimage]\033[0m %s\n' "$*"
}

err() {
    printf '\033[31m[appimage]\033[0m %s\n' "$*" >&2
    exit 1
}

# ---------- 前置检查 ----------
check_deps() {
    log "检查依赖..."
    command -v node >/dev/null 2>&1 || err "未安装 Node.js"
    command -v npm >/dev/null 2>&1 || err "未安装 npm"

    # 检查 linuxdeploy
    if ! command -v linuxdeploy >/dev/null 2>&1; then
        if [ ! -f "${PROJECT_ROOT}/.tools/linuxdeploy" ]; then
            log "下载 linuxdeploy..."
            mkdir -p "${PROJECT_ROOT}/.tools"
            curl -fsSL "https://github.com/linuxdeploy/linuxdeploy/releases/latest/download/linuxdeploy-x86_64.AppImage" \
                -o "${PROJECT_ROOT}/.tools/linuxdeploy"
            chmod +x "${PROJECT_ROOT}/.tools/linuxdeploy"
        fi
        LINUXDEPLOY="${PROJECT_ROOT}/.tools/linuxdeploy"
    else
        LINUXDEPLOY="linuxdeploy"
    fi

    log "依赖检查通过"
}

# ---------- 构建 CLI ----------
build_cli() {
    log "构建 CLI dist..."
    cd "$PROJECT_ROOT"
    pnpm install --frozen-lockfile --filter @ihui/cli...
    pnpm --filter @ihui/cli build

    if [ ! -f "apps/cli/dist/index.js" ]; then
        err "CLI 构建失败: dist/index.js 不存在"
    fi
}

# ---------- 创建 Node.js SEA 二进制 ----------
build_sea_binary() {
    log "创建 Node.js SEA (Single Executable Application) 二进制..."

    local SEA_DIR="${BUILD_DIR}/sea"
    rm -rf "$SEA_DIR"
    mkdir -p "$SEA_DIR"

    # 1. 创建入口 bundle (用 esbuild 打包所有依赖为单文件)
    cd "$PROJECT_ROOT/apps/cli"
    npx esbuild dist/index.js \
        --bundle \
        --platform=node \
        --format=esm \
        --outfile="${SEA_DIR}/ihui-bundle.js" \
        --external:vscode-jsonrpc \
        --external:vscode-languageclient \
        --external:vscode-languageserver-protocol \
        --external:fsevents \
        --minify || {
            err "esbuild 打包失败"
        }

    # 2. 生成 SEA 配置
    cat > "${SEA_DIR}/sea-config.json" <<EOF
{
  "main": "ihui-bundle.js",
  "output": "sea-prep.blob",
  "disableExperimentalSEAWarning": true,
  "useSnapshot": false,
  "useCodeCache": true
}
EOF

    # 3. 生成 blob
    node --experimental-sea-config "${SEA_DIR}/sea-config.json" || {
        err "SEA blob 生成失败"
    }

    # 4. 复制 node 二进制并注入 SEA blob
    cp "$(command -v node)" "${SEA_DIR}/ihui"

    # 5. 移除签名(macOS 需要,Linux 可选)
    if command -v codesign >/dev/null 2>&1; then
        codesign --remove-signature "${SEA_DIR}/ihui" 2>/dev/null || true
    fi

    # 6. 注入 blob
    npx postject "${SEA_DIR}/ihui" NODE_SEA_BLOB "${SEA_DIR}/sea-prep.blob" \
        --sentinel-fuse NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2 \
        --overwrite || {
        err "postject 注入失败"
    }

    chmod +x "${SEA_DIR}/ihui"
    log "SEA 二进制构建完成: ${SEA_DIR}/ihui"
}

# ---------- 组装 AppDir ----------
build_appdir() {
    log "组装 AppDir..."
    local APPDIR="${BUILD_DIR}/AppDir"
    rm -rf "$APPDIR"
    mkdir -p "$APPDIR/usr/bin"
    mkdir -p "$APPDIR/usr/share/applications"
    mkdir -p "$APPDIR/usr/share/icons/hicolor/256x256/apps"

    # 复制 SEA 二进制
    cp "${BUILD_DIR}/sea/ihui" "${APPDIR}/usr/bin/ihui"
    chmod +x "${APPDIR}/usr/bin/ihui"

    # 创建 .desktop 文件
    cat > "${APPDIR}/usr/share/applications/${APP_NAME}.desktop" <<EOF
[Desktop Entry]
Name=IHUI AI CLI
Comment=IHUI AI Coding Agent CLI
Exec=ihui
Icon=ihui
Terminal=true
Type=Application
Categories=Development;Utility;
EOF

    # 生成简单图标(如果没有现成图标)
    if [ -f "${PROJECT_ROOT}/apps/cli/assets/icon.png" ]; then
        cp "${PROJECT_ROOT}/apps/cli/assets/icon.png" \
           "${APPDIR}/usr/share/icons/hicolor/256x256/apps/ihui.png"
    else
        # 用 ImageMagick 生成占位图标
        if command -v convert >/dev/null 2>&1; then
            convert -size 256x256 xc:'#0ea5e9' -gravity center \
                -pointsize 72 -fill white -annotate +0+0 "IHUI" \
                "${APPDIR}/usr/share/icons/hicolor/256x256/apps/ihui.png"
        else
            log "提示: 未找到图标,且 ImageMagick 未安装,使用空图标"
            touch "${APPDIR}/usr/share/icons/hicolor/256x256/apps/ihui.png"
        fi
    fi

    # AppRun 脚本
    cat > "${APPDIR}/AppRun" <<'EOF'
#!/bin/bash
SELF="$(readlink -f "$0")"
HERE="$(dirname "$SELF")"
exec "${HERE}/usr/bin/ihui" "$@"
EOF
    chmod +x "${APPDIR}/AppRun"
}

# ---------- 打包 AppImage ----------
build_appimage() {
    log "打包 AppImage..."
    mkdir -p "$OUTPUT_DIR"

    OUTPUT="${OUTPUT_DIR}/${APP_NAME}-${ARCH}.AppImage"

    # 用 linuxdeploy 生成 AppImage
    "$LINUXDEPLOY" \
        --appdir "${BUILD_DIR}/AppDir" \
        --output appimage \
        --desktop-file "${BUILD_DIR}/AppDir/usr/share/applications/${APP_NAME}.desktop" \
        --icon-file "${BUILD_DIR}/AppDir/usr/share/icons/hicolor/256x256/apps/ihui.png" || {
        err "linuxdeploy 打包失败"
    }

    # linuxdeploy 输出到当前目录,移动到输出目录
    local generated="${APP_NAME}-${ARCH}.AppImage"
    if [ -f "$generated" ]; then
        mv "$generated" "$OUTPUT"
    fi

    if [ ! -f "$OUTPUT" ]; then
        err "AppImage 生成失败: $OUTPUT 不存在"
    fi

    log "AppImage 构建完成: $OUTPUT"
    ls -lh "$OUTPUT"
}

# ---------- 清理 ----------
cleanup() {
    log "清理临时目录..."
    rm -rf "$BUILD_DIR"
}

# ---------- 主流程 ----------
main() {
    log "IHUI AI CLI AppImage 构建器"
    log "版本: ${APP_VERSION} / 架构: ${ARCH}"
    echo ""

    check_deps
    build_cli
    build_sea_binary
    build_appdir
    build_appimage
    cleanup

    echo ""
    log "完成! 使用方式:"
    log "  chmod +x ${OUTPUT_DIR}/${APP_NAME}-${ARCH}.AppImage"
    log "  ./${APP_NAME}-${ARCH}.AppImage --help"
}

main "$@"
