# Nix flake for IHUI CLI
# 用法:
#   nix run github:ihui/ai#ihui                              (临时运行)
#   nix profile install github:ihui/ai#ihui                   (全局安装)
#   nix develop github:ihui/ai                                 (开发 shell)
#
# 注意:npmDepsHash 需用 `nix run nixpkgs#prefetch-npm-deps -- <package-lock.json>` 生成,
#      首次构建会提示正确 hash,替换 fakeSha256 后重新构建。
{
  description = "IHUI AI Coding Agent CLI — 对标 Claude Code / Codex";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = { self, nixpkgs, flake-utils }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = nixpkgs.legacyPackages.${system};
      in
      {
        packages.ihui = pkgs.buildNpmPackage rec {
          pname = "ihui-ai";
          version = "1.0.0";
          src = ./.;
          npmDepsHash = pkgs.lib.fakeSha256;
          dontNpmBuild = true;
          meta = with pkgs.lib; {
            description = "IHUI AI Coding Agent CLI";
            homepage = "https://ihui.ai";
            license = licenses.mit;
            mainProgram = "ihui";
            platforms = platforms.unix ++ platforms.windows;
          };
        };

        defaultPackage = self.packages.${system}.ihui;

        apps.ihui = flake-utils.lib.mkApp {
          drv = self.packages.${system}.ihui;
        };

        devShells.default = pkgs.mkShell {
          buildInputs = with pkgs; [ nodejs_20 ];
        };
      });
}
