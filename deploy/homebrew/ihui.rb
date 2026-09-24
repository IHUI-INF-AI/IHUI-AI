# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

# IHUI AI CLI — Homebrew Formula
# 用法: brew install ihui (需先 brew tap ihui/ihui)
# 手动测试: brew install --build-from-source ./deploy/homebrew/ihui.rb
#
# ⚠️ 发布状态 2026-09-21 实测(O14):本 formula 当前**装不上**,三个独立原因,逐个说明:
#   1) url 里的 tag `cli-v1.0.0` 在 origin 不存在。`git ls-remote --tags origin` 只有
#      `desktop-v*` / `nightly-*` / `backup/*` / `lost-commit/*`,无 `cli-v*` → 下载 404。
#   2) 资产名 `ihui-src-1.0.0.tar.gz` **没有任何生产者**:`.github/workflows/release-cli.yml`
#      的 matrix 只产出 ihui-{linux,macos,windows}-{x64,arm64}.{tar.gz,zip};全仓 grep
#      `ihui-src` 只命中本文件与 .ihui-agent 归档副本 → CI 永远不会上传这个名字。
#   3) 即便补上同名资产,`git archive` 出的源码包也**不满足下方 install 块**:它只含
#      apps/cli 源码(无 dist/、无 node_modules),而公式要执行 libexec/dist/index.js。
#      → 必须挂"已构建的 bundle"(pnpm --filter @ihui/cli build + 生产依赖),不是源码 tar。
#
# sha256 填法(不得提前猜):对**最终上传到那个 release 的同一个文件**执行
#   `sha256sum ihui-src-1.0.0.tar.gz` 原样粘贴。本地产物名与 CI 产物名不重叠(CI 无此名),
#   所以由 `node scripts/release-assets.mjs` 产出的那份即为权威来源;但源码 tar 不满足 3),
#   在补齐"构建产物打包"步骤之前 sha 一律保持占位,禁止先填后补。
# 另需:tap 仓库布局(ihui/homebrew-ihui 的 Formula/ihui.rb 或 deploy/homebrew/ihui.rb +
#   `tokio` 风格 tap 声明),当前 deploy/homebrew 不在任何 tap 仓库中。

class Ihui < Formula
  desc "IHUI AI Coding Agent CLI — 对标 Claude Code / Codex"
  homepage "https://github.com/IHUI-INF-AI/IHUI-AI"
  # ⚠️ sha256 待发布后回填(不得提前猜)。回填只需一条命令(GitHub release 资产自带 digest 字段):
  #   gh api repos/IHUI-INF-AI/IHUI-AI/releases/latest --jq '.assets[] | select(.name == "ihui-src-1.0.0.tar.gz") | .digest'
  # 返回形如 "sha256:ab12…" → 把冒号后 64 位十六进制原样填入下行引号内即可。
  # 前提:release 里必须真有名为 ihui-src-1.0.0.tar.gz 的资产(生产者见文件头注释 2)/3,资产不存在的判定仍是 404/空结果)。
  url "https://github.com/IHUI-INF-AI/IHUI-AI/releases/latest/download/ihui-src-1.0.0.tar.gz"
  sha256 "0000000000000000000000000000000000000000000000000000000000000000" # TODO(release): 回填 gh api digest,见上方命令
  version "1.0.0"
  license "MIT"

  depends_on "node@22"

  def install
    # 安装 dist 产物到 libexec,node 运行时执行
    libexec.install Dir["*"]

    # 创建 wrapper 脚本,使用 node@22 运行
    (bin/"ihui").write <<~EOS
      #!/bin/bash
      export NODE_PATH="#{libexec}/node_modules"
      exec "#{Formula["node@22"].opt_bin}/node" "#{libexec}/dist/index.js" "$@"
    EOS
    chmod 0755, bin/"ihui"
  end

  test do
    # 验证版本号输出
    assert_match "1.0.0", shell_output("#{bin}/ihui --version")
    # 验证帮助信息
    assert_match "ihui", shell_output("#{bin}/ihui --help")
  end
end
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
