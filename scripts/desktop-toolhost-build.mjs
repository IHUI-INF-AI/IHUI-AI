// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 构建 tool-host sidecar，放到开发态资源目录 `resources/tool-host/`。
// 安装包里的根 `ihui-tool-host.exe` 由 Tauri 对同 crate 的 bin target 自动生成
// （`target/release/ihui-tool-host.exe`）；如果同时写 `externalBin` + resources，
// 安装脚本会出现两条 `File` 命令、重复约 2MB。因此这里**只**维护开发态副本，
// `bundle.resources` 也不再收 tool-host，安装包只保留根一份。
// 用法：node scripts/desktop-toolhost-build.mjs
// `tauri build` 前必须跑；否则 Tauri 没有 root 宿主可打包，构建直接失败。

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const crateDir = path.join(root, "apps", "desktop", "src-tauri");
const outDir = path.join(crateDir, "resources", "tool-host");
const cargo = process.env.CARGO || "cargo";

function run(args, cwd) {
  const result = spawnSync(cargo, args, {
    cwd,
    stdio: "inherit",
    shell: false,
    // 后台静默:无控制台父进程(GUI/IDE/计划任务)派生 cargo 时不留可见黑窗
    windowsHide: true,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`cargo ${args.join(" ")} exited ${result.status}`);
}

function targetTriple() {
  const explicit = process.env.TAURI_ENV_TARGET_TRIPLE || process.env.CARGO_BUILD_TARGET;
  if (explicit) return explicit;
  const rustc = spawnSync("rustc", ["-vV"], { encoding: "utf8", shell: false, windowsHide: true });
  if (rustc.status === 0) {
    const host = rustc.stdout.match(/^host:\s*(\S+)$/m);
    if (host) return host[1];
  }
  return "x86_64-pc-windows-msvc";
}

const metadata = spawnSync(cargo, ["metadata", "--format-version=1", "--no-deps"], {
  cwd: crateDir,
  encoding: "utf8",
  shell: false,
  windowsHide: true,
});
if (metadata.error) throw metadata.error;
if (metadata.status !== 0) throw new Error(`cargo metadata exited ${metadata.status}`);
const targetDirectory = JSON.parse(metadata.stdout).target_directory;

const triple = targetTriple();
// macOS Universal 不是真实 rustc target:tauri 传下来的是伪三元组
// universal-apple-darwin,直接交给 cargo 会报 "could not find specification"(实测
// 2026-11-28 CI:Build Desktop(macos-universal) 因此连续失败)。这里拆成两枚真实
// 架构分别编译,再用 lipo 合成一份 Universal 二进制,供 Tauri resources 使用。
const triples =
  triple === "universal-apple-darwin"
    ? ["aarch64-apple-darwin", "x86_64-apple-darwin"]
    : [triple];
const exe = process.platform === "win32" ? "ihui-tool-host.exe" : "ihui-tool-host";
const outFile = path.join(outDir, exe);
fs.mkdirSync(outDir, { recursive: true });
// tauri-build 在编译本 crate 的 build script 阶段会读 `bundle.resources`;宿主本身
// 还没编译出来时先放 0 字节占位，真正的产物在 cargo build 之后立刻覆盖。
// 占位文件不会被发布，因为本脚本失败会直接抛错。
if (!fs.existsSync(outFile) || fs.statSync(outFile).size === 0) {
  fs.writeFileSync(outFile, "");
}

const artifacts = triples.map((t) => {
  run(["build", "--release", "--bin", "ihui-tool-host", "--target", t], crateDir);
  const artifact = path.join(targetDirectory, t, "release", exe);
  if (!fs.existsSync(artifact)) throw new Error(`tool-host artifact missing: ${artifact}`);
  return artifact;
});

if (triples.length > 1) {
  const lipo = process.env.LIPO || "lipo";
  const lipoResult = spawnSync(lipo, ["-create", ...artifacts, "-output", outFile], {
    stdio: "inherit",
    shell: false,
    windowsHide: true,
  });
  if (lipoResult.error) throw lipoResult.error;
  if (lipoResult.status !== 0) {
    throw new Error(`lipo universal tool-host exited ${lipoResult.status}`);
  }
} else {
  fs.copyFileSync(artifacts[0], outFile);
}
// Tauri 的 NSIS 安装脚本从 `target/release/ihui-tool-host.exe` 取根副本；这里保证
// 它和 resources 里是同一份本次编译产物，避免拿上一次 cargo 产物打包。
const rootArtifact = path.join(targetDirectory, "release", exe);
if (path.resolve(rootArtifact) !== path.resolve(outFile)) {
  fs.copyFileSync(outFile, rootArtifact);
}
const size = fs.statSync(outFile).size;
if (size > 32 * 1024 * 1024) {
  throw new Error(`tool-host too large: ${size} bytes (expected <= 32MB)`);
}
console.log(`[tool-host] ${outFile} (${(size / 1024).toFixed(1)} KiB), triple=${triples.join("+")}`);
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
