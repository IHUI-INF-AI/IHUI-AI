// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// AUTO-GENERATED — 发布源快照,由 CI 生成的 latest.json 1:1 烘焙(详见发布流程)
// 用途:/desktop-feed.json 路由在生产机本地直读,绕开国内直连 GitHub 资产 CDN 超时。
// 每次桌面发版后,须重新生成本文件并提交(发布清单步骤)。
// 注意:本文件是**静态烘焙**,无法像运行期解析那样做 Gitee 字节对账。Windows 主包此处
// 直接写 Gitee 镜像直链(已与 GitHub 原件按 Content-Length 对账=10142082 字节,签名对包体
// 字节签,同一份字节放任意 host 均验得过)。动因:GitHub 资产 CDN 国内常直连超时,而 Gitee
// 镜像国内可达;这与 desktop-feed-live.ts 的 preferGiteeWindows 判据一致 —— 仅 Windows 走 Gitee,
// Linux/macOS 维持 GitHub 原生产物(同运行期解析行为)。
import type { DesktopFeedPayload } from './desktop-feed-payload'

export const DESKTOP_LATEST: DesktopFeedPayload = {
  "version": "0.1.76",
  "notes": "桌面端安装包(Tauri 2 + Rust + React)。详见 CHANGELOG。",
  "pub_date": "2026-10-18T02:26:46.730Z",
  "platforms": {
    "windows-x86_64": {
      "signature": "dW50cnVzdGVkIGNvbW1lbnQ6IHNpZ25hdHVyZSBmcm9tIHRhdXJpIHNlY3JldCBrZXkKUlVRSTI3R2lmdWJYdFNncWFMN3hSNlAvZU5SV1NqbW9MZGRjRkk5cDV2eUdiWTJUMXpkNVBDQTdTMHY1R3BQWEtyZS8wWE1waTBrT00rS21ZS2xneFNzVW9WMmtrVktmQ2dvPQp0cnVzdGVkIGNvbW1lbnQ6IHRpbWVzdGFtcDoxNzkyMjkwMzI2CWZpbGU65pm65rGHQUlfMC4xLjc2X3g2NC1zZXR1cC5leGUKVGJYcVh4cnFxVTI5NHRicXg3K1pBTE5hb1R0Wmd1QThxZEdWSTJmSmNXVXN2Q2FpYmxWdVBHZW1sd3Z3aXlyK09STnM1dWNoV0MxcWk2cGhoNXNzQ2c9PQo=",
      "url": "https://gitee.com/JLSLSSZWHYXGS_0/IHUI-AI/releases/download/desktop-v0.1.76/AI_0.1.76_x64-setup.exe"
    },
    "linux-x86_64": {
      "signature": "dW50cnVzdGVkIGNvbW1lbnQ6IHNpZ25hdHVyZSBmcm9tIHRhdXJpIHNlY3JldCBrZXkKUlVRSTI3R2lmdWJYdFc1K3N6dzlvcW91WENwMlhoYytBSndKdjlhSitJUFFXcFhzeWZyMHh4aU9hWmdYbHBFOWRicFJ5UWQ4M1BJdy9TSkZ5OGZTYWdDTVhCV3dGS0xMclFzPQp0cnVzdGVkIGNvbW1lbnQ6IHRpbWVzdGFtcDoxNzkyMjkwMjI2CWZpbGU65pm65rGHQUlfMC4xLjc2X2FtZDY0LkFwcEltYWdlCkMwaytneHQxOFA5MnJ2RU05M25PbEMzaWtQMkpXNmVBZSs4cFFRMmljem9PTUhzTnJoSEZnekhQV3pYN2JtRDVycGJ6cmNsR0VDSTVYZFc4eDg2aUN3PT0K",
      "url": "https://github.com/IHUI-INF-AI/IHUI-AI/releases/download/desktop-v0.1.76/AI_0.1.76_amd64.AppImage"
    },
    "darwin-x86_64": {
      "signature": "dW50cnVzdGVkIGNvbW1lbnQ6IHNpZ25hdHVyZSBmcm9tIHRhdXJpIHNlY3JldCBrZXkKUlVRSTI3R2lmdWJYdFVzQkVEZ1QzLzhEWWdET3lPMFJ0Q2V0ZklqVWlmKzduOGpsUEZ3MjNkRWJpeW5RR0Y3aXhTUGpJS3ZMSytrMjl3UUhiQW5uRHQ0di9QYmU3RFByY3dNPQp0cnVzdGVkIGNvbW1lbnQ6IHRpbWVzdGFtcDoxNzkyMjkwMjA0CWZpbGU65pm65rGHQUkuYXBwLnRhci5negpzVStUUjlITmdVMmFRZHR5a2dUMXNBOFkzTk5IWkhPeDJLaDYyRkdwSVBxc2Q5cmV4QjVFVkN4OHBKWlpndlVOTlRTNTlnVDEyMjZlYUc0eWh5SDREUT09Cg==",
      "url": "https://github.com/IHUI-INF-AI/IHUI-AI/releases/download/desktop-v0.1.76/AI_universal.app.tar.gz"
    },
    "darwin-aarch64": {
      "signature": "dW50cnVzdGVkIGNvbW1lbnQ6IHNpZ25hdHVyZSBmcm9tIHRhdXJpIHNlY3JldCBrZXkKUlVRSTI3R2lmdWJYdFVzQkVEZ1QzLzhEWWdET3lPMFJ0Q2V0ZklqVWlmKzduOGpsUEZ3MjNkRWJpeW5RR0Y3aXhTUGpJS3ZMSytrMjl3UUhiQW5uRHQ0di9QYmU3RFByY3dNPQp0cnVzdGVkIGNvbW1lbnQ6IHRpbWVzdGFtcDoxNzkyMjkwMjA0CWZpbGU65pm65rGHQUkuYXBwLnRhci5negpzVStUUjlITmdVMmFRZHR5a2dUMXNBOFkzTk5IWkhPeDJLaDYyRkdwSVBxc2Q5cmV4QjVFVkN4OHBKWlpndlVOTlRTNTlnVDEyMjZlYUc0eWh5SDREUT09Cg==",
      "url": "https://github.com/IHUI-INF-AI/IHUI-AI/releases/download/desktop-v0.1.76/AI_universal.app.tar.gz"
    }
  }
}
