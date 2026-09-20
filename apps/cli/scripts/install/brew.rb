# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

# Homebrew Formula for IHUI CLI
# 安装方式:
#   brew install --HEAD --build-from-source ./brew.rb          (本地源码)
#   brew tap ihui/ai && brew install ihui-ai                     (tap 仓库)
#
# ⚠️ 当前不可安装 —— @ihui/cli 尚未发布到 npm(2026-09-20 实测
#    `curl -s https://registry.npmjs.org/@ihui%2Fcli` 返回 404 Not Found)。
#    根因:apps/cli 的 5 个 @ihui/* 依赖(api-client / context-compaction /
#    design-tokens / shared / types)在仓库里全是 private:true,发布即产生
#    装不上的包。详见 docs/RELEASE.md「发布状态(实测)」。
# 首次真正发布后:把下面的 PENDING_SHA256 换成真实摘要 ——
#   V=$(npm view @ihui/cli version --registry=https://registry.npmjs.org/)
#   curl -sL "https://registry.npmjs.org/@ihui/cli/-/cli-$V.tgz" | sha256sum
# 然后回填 url 里的版本号与 sha256,并删除 odie 守卫。**禁止手填猜测值。**
class IhuiAi < Formula
  desc "IHUI AI Coding Agent CLI — 对标 Claude Code / Codex"
  homepage "https://aizhs.top"
  url "https://registry.npmjs.org/@ihui/cli/-/cli-1.0.0.tgz"

  # 未发布 => 不存在可校验的真实摘要。Homebrew 的 DSL 只接受 64 位十六进制,
  # 所以这里用字面量生成的显式占位(而不是抄一串看起来像哈希的 0),
  # 并在 install 里主动 odie,避免把"未发布"误报成"校验失败"。
  PENDING_SHA256 = ("0" * 64).freeze
  sha256 PENDING_SHA256
  license "Apache-2.0"

  depends_on "node"

  def install
    odie "IHUI CLI 尚未发布到 npm(@ihui/cli 404),此 formula 的 sha256 仍是占位值;" \
         "请先完成 npm 发布并回填真实摘要,见 docs/RELEASE.md。" if sha256 == PENDING_SHA256
    # std_npm_args 封装 npm 全局安装到 libexec(Homebrew 内置 helper)
    system "npm", "install", *std_npm_args
    # ihui 入口链接到 PATH
    bin.install_symlink libexec/"bin/ihui" => "ihui"
  end

  test do
    assert_match "ihui", shell_output("#{bin}/ihui --version")
  end
end
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
