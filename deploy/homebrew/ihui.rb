# IHUI AI CLI — Homebrew Formula
# 用法: brew install ihui (需先 brew tap ihui/ihui)
# 手动测试: brew install --build-from-source ./deploy/homebrew/ihui.rb

class Ihui < Formula
  desc "IHUI AI Coding Agent CLI — 对标 Claude Code / Codex"
  homepage "https://github.com/IHUI-INF-AI/IHUI-AI"
  url "https://github.com/IHUI-INF-AI/IHUI-AI/releases/download/cli-v1.0.0/ihui-src-1.0.0.tar.gz"
  sha256 "0000000000000000000000000000000000000000000000000000000000000000"
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
