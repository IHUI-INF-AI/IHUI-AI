// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

//! B3-01 本机常驻桥 host（Chrome Native Messaging stdio 协议）。
//!
//! 帧格式 = `u32` 小端长度 + UTF-8 JSON 正文；Windows 与 Chrome 的原生字节序一致，
//! 显式小端是为了跨架构抓帧回放不错位（与 `native-messaging-protocol.ts` 同口径）。
//!
//! 支持 op：`ping` / `capabilities` / `shutdown`。未识别 op 返回 `ok:false`，
//! 不把未知请求当成功；`shutdown` 回包后退出，供安装器做连通性自检。
//!
//! 这是真正由 Chrome 拉起的可执行文件入口，不依赖 Node 运行时；manifest 指向
//! 本 bin 构建出的 `ihui_native_host.exe`（安装器 `scripts/install-extension-native-host.mjs`）。

use std::io::{self, Read, Write};

fn main() {
    let mut stdin = io::stdin();
    let mut stdout = io::stdout();
    loop {
        let mut header = [0u8; 4];
        if stdin.read_exact(&mut header).is_err() {
            break;
        }
        let len = u32::from_le_bytes(header) as usize;
        if len == 0 || len > 1024 * 1024 {
            let _ = write_frame(
                &mut stdout,
                &serde_json::json!({"ok": false, "error": "invalid_frame_length"}),
            );
            break;
        }
        let mut body = vec![0u8; len];
        if stdin.read_exact(&mut body).is_err() {
            break;
        }
        let parsed: serde_json::Value = match serde_json::from_slice(&body) {
            Ok(v) => v,
            Err(_) => {
                let _ = write_frame(
                    &mut stdout,
                    &serde_json::json!({"ok": false, "error": "invalid_json"}),
                );
                continue;
            }
        };
        let request_id = parsed
            .get("requestId")
            .and_then(|v| v.as_str())
            .unwrap_or("unknown")
            .to_string();
        let op = parsed.get("op").and_then(|v| v.as_str()).unwrap_or("unknown");
        let reply = match op {
            "ping" => serde_json::json!({
                "requestId": request_id,
                "ok": true,
                "op": "ping",
                "pid": std::process::id(),
                "version": env!("CARGO_PKG_VERSION"),
            }),
            "capabilities" => serde_json::json!({
                "requestId": request_id,
                "ok": true,
                "op": "capabilities",
                "data": {"ops": ["ping", "capabilities", "shutdown"]},
            }),
            "shutdown" => serde_json::json!({
                "requestId": request_id,
                "ok": true,
                "op": "shutdown",
            }),
            _ => serde_json::json!({
                "requestId": request_id,
                "ok": false,
                "op": op,
                "error": "unsupported_op",
            }),
        };
        if write_frame(&mut stdout, &reply).is_err() {
            break;
        }
        if op == "shutdown" {
            break;
        }
    }
}

fn write_frame(stdout: &mut io::Stdout, value: &serde_json::Value) -> io::Result<()> {
    let body = serde_json::to_vec(value)?;
    let header = (body.len() as u32).to_le_bytes();
    stdout.write_all(&header)?;
    stdout.write_all(&body)?;
    stdout.flush()
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
