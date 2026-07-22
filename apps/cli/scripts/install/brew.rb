# Homebrew Formula for IHUI CLI
# 安装方式:
#   brew install --HEAD --build-from-source ./brew.rb          (本地源码)
#   brew tap ihui/ai && brew install ihui-ai                     (tap 仓库)
# 重新编译发布前:用 `npm view @ihui/cli version` 获取最新版本,更新 url/sha256。
class IhuiAi < Formula
  desc "IHUI AI Coding Agent CLI — 对标 Claude Code / Codex"
  homepage "https://ihui.ai"
  url "https://registry.npmjs.org/@ihui/cli/-/cli-1.0.0.tgz"
  sha256 "0000000000000000000000000000000000000000000000000000000000000000"
  license "MIT"

  depends_on "node"

  def install
    # std_npm_args 封装 npm 全局安装到 libexec(Homebrew 内置 helper)
    system "npm", "install", *std_npm_args
    # ihui 入口链接到 PATH
    bin.install_symlink libexec/"bin/ihui" => "ihui"
  end

  test do
    assert_match "ihui", shell_output("#{bin}/ihui --version")
  end
end
