// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

//! tool-host 进程级集成测试：真拉子进程、真握手、真执行、真幂等、真写盘边界。

#![cfg(windows)]

use std::io::{BufRead, BufReader, Write};
use std::net::TcpStream;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

use ihui_desktop_lib::tool_host::{ToolHostClient, ToolHostManager};
use serde_json::Value;

#[test]
fn spawn_from_installed_layout_finds_resource_sidecar() {
    let stamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis())
        .unwrap_or(0);
    let root = std::env::temp_dir().join(format!("ihui-toolhost-layout-{}-{stamp}", std::process::id()));
    let resource_dir = root.join("tool-host");
    std::fs::create_dir_all(&resource_dir).expect("create layout dir");
    std::fs::copy(env!("CARGO_BIN_EXE_ihui-tool-host"), resource_dir.join("ihui-tool-host.exe"))
        .expect("copy sidecar into resource layout");

    let mut client = ToolHostClient::spawn_from_dir(&root).expect("安装布局应能找到宿主");
    let ping = client.ping().expect("ping");
    assert!(ping["hostPid"].as_u64().unwrap_or(0) > 0, "ping: {ping}");
    client.shutdown().expect("shutdown");
    let _ = std::fs::remove_dir_all(&root);
}

#[test]
fn spawn_from_installed_root_layout_finds_host_beside_app() {
    let stamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis())
        .unwrap_or(0);
    let root = std::env::temp_dir().join(format!(
        "ihui-toolhost-root-layout-{}-{stamp}",
        std::process::id()
    ));
    std::fs::create_dir_all(&root).expect("create root layout dir");
    // 0.1.94 NSIS 的真实布局：宿主和 app 同在 `versions\<ver>\`，没有 `tool-host/` 子目录。
    std::fs::copy(env!("CARGO_BIN_EXE_ihui-tool-host"), root.join("ihui-tool-host.exe"))
        .expect("copy sidecar beside app");
    assert!(!root.join("tool-host").exists());

    let mut client = ToolHostClient::spawn_from_dir(&root).expect("根目录布局应能找到宿主");
    let ping = client.ping().expect("ping");
    assert!(ping["hostPid"].as_u64().unwrap_or(0) > 0, "ping: {ping}");
    client.shutdown().expect("shutdown");
    let _ = std::fs::remove_dir_all(&root);
}

#[test]
fn tool_host_process_roundtrip_is_idempotent_and_sandboxed() {
    let exe = env!("CARGO_BIN_EXE_ihui-tool-host");
    let mut client = ToolHostClient::spawn_with_exe(Path::new(exe)).expect("tool-host 应能拉起并握手");

    let ping = client.ping().expect("ping");
    assert_eq!(ping["sandboxSupported"].as_bool(), Some(true), "低完整性应可用: {ping}");
    assert_eq!(ping["sandboxTier"].as_str(), Some("appcontainer-job"));
    let root = ping["writableRoot"].as_str().expect("writableRoot").to_string();
    assert!(Path::new(&root).is_dir(), "可写根不存在: {root}");

    let first = client
        .execute("turn-1", "call-1", "cmd.exe", &["/c", "echo host-ok"], None, Some(5_000))
        .expect("execute#1");
    assert_eq!(first["exitCode"].as_i64(), Some(0), "execute#1: {first}");
    assert!(first["stdout"].as_str().unwrap_or("").contains("host-ok"));
    assert_eq!(first["replayed"].as_bool(), Some(false));

    // 同一双键再发一次：必须重放，不能执行第二次
    let second = client
        .execute("turn-1", "call-1", "cmd.exe", &["/c", "echo host-ok"], None, Some(5_000))
        .expect("execute#2");
    assert_eq!(second["replayed"].as_bool(), Some(true), "第二次应命中幂等缓存: {second}");
    assert_eq!(second["stdout"], first["stdout"]);

    // 中文 Windows 的 cmd 输出 GBK；tool-host 要按 GBK 回解，不能把中文变成替换符。
    let chinese = client
        .execute("turn-cn", "call-cn", "cmd.exe", &["/c", "echo 中文输出"], None, Some(5_000))
        .expect("execute chinese");
    assert!(
        chinese["stdout"].as_str().unwrap_or("").contains("中文输出"),
        "中文输出被解码坏了: {chinese}"
    );

    // 低完整性进程能写自己的可写根（AppContainer 的 AC 目录）
    let third = client
        .execute("turn-1", "call-2", "cmd.exe", &["/c", "echo low>w.txt"], None, Some(5_000))
        .expect("execute#3");
    assert_eq!(third["exitCode"].as_i64(), Some(0), "写可写根应成功: {third}");
    let written = Path::new(&root).join("w.txt");
    assert!(written.is_file(), "可写根里的 w.txt 不存在");
    assert!(std::fs::read_to_string(&written).unwrap_or_default().contains("low"));

    // 写中完整性工作区必须被 MIC 拒
    let target = Path::new(r"C:\IHUI-AI\toolhost-escape-test.txt");
    let _ = std::fs::remove_file(target);
    let script = format!("echo escape> {}", target.display());
    let denied = client
        .execute("turn-1", "call-3", "cmd.exe", &["/c", script.as_str()], None, Some(5_000))
        .expect("execute#4");
    assert!(!target.exists(), "低完整性进程不应写进工作区: {denied}");

    // 默认 low 档现在落 AppContainer：宿主真实 RPC 也要证明子进程拿不到网络。
    let net = client
        .execute("turn-net", "call-net", "cmd.exe", &["/c", "ping -n 1 8.8.8.8"], None, Some(5_000))
        .expect("execute net");
    assert!(
        net["exitCode"].as_i64().unwrap_or(0) != 0
            && !net["stdout"].as_str().unwrap_or("").contains("TTL="),
        "宿主 low 档仍能出网: {net}"
    );

    // 显式 inherit 档：只做 Job 限额，允许写工作区（给需要写盘的长任务用）
    let inherit_target = Path::new(r"C:\IHUI-AI")
        .join(format!("toolhost-inherit-test-{}.txt", std::process::id()));
    let _ = std::fs::remove_file(&inherit_target);
    let inherit_script = format!("echo inherit-ok> {}", inherit_target.display());
    let inherited = client
        .execute_with_integrity(
            "turn-3",
            "call-5",
            "cmd.exe",
            &["/c", inherit_script.as_str()],
            None,
            Some(5_000),
            "inherit",
        )
        .expect("execute inherit");
    assert_eq!(inherited["exitCode"].as_i64(), Some(0), "inherit 执行: {inherited}");
    assert_eq!(inherited["integrityMode"].as_str(), Some("inherit"));
    assert_eq!(inherited["sandboxed"].as_bool(), Some(false));
    assert!(inherit_target.is_file(), "inherit 档应能写工作区: {inherited}");
    assert!(std::fs::read_to_string(&inherit_target)
        .unwrap_or_default()
        .contains("inherit-ok"));
    let _ = std::fs::remove_file(&inherit_target);

    // 未知 integrity 必须报错，不能静默回落
    let bad_mode = client
        .execute_with_integrity("turn-4", "call-6", "cmd.exe", &["/c", "echo x"], None, Some(5_000), "root")
        .expect_err("未知 integrity 应拒绝");
    assert!(bad_mode.contains("integrity"), "错误={bad_mode}");

    // 超时必须收口，不能把超时当成功。AppContainer 下不能用 ping（无网络会立即失败），
    // 改用纯 CPU 的 for 循环等宿主超时杀进程。
    let timed = client
        .execute(
            "turn-2",
            "call-4",
            "cmd.exe",
            &["/c", "for /l %i in (1,1,10000000) do @rem"],
            None,
            Some(150),
        )
        .expect("execute#5");
    assert_eq!(timed["timedOut"].as_bool(), Some(true), "超时应标记: {timed}");
    assert_eq!(timed["exitCode"].is_null(), true);

    client.shutdown().expect("shutdown");
}

#[test]
fn manager_dedupes_same_dual_key_across_two_hosts() {
    use std::sync::{Arc, Barrier};
    use std::thread;

    let exe = env!("CARGO_BIN_EXE_ihui-tool-host");
    let manager = Arc::new(ToolHostManager::new_with_max(
        Some(Path::new(exe).to_path_buf()),
        2,
    ));
    let target = PathBuf::from(format!(r"C:\IHUI-AI\manager-idem-{}.txt", std::process::id()));
    let _ = std::fs::remove_file(&target);
    let command = format!("echo tick> {}", target.display());
    let barrier = Arc::new(Barrier::new(2));
    let mut handles = Vec::new();
    for _ in 0..2 {
        let manager = Arc::clone(&manager);
        let barrier = Arc::clone(&barrier);
        let command = command.clone();
        handles.push(thread::spawn(move || {
            barrier.wait();
            manager
                .execute_with_integrity(
                    "dedupe-turn",
                    "dedupe-call",
                    "cmd.exe",
                    &["/c", &command],
                    Some(Path::new(r"C:\IHUI-AI")),
                    Some(10_000),
                    "inherit",
                )
                .expect("dedupe execute")
        }));
    }
    let results: Vec<_> = handles.into_iter().map(|h| h.join().expect("join")).collect();
    for result in &results {
        assert_eq!(
            result["exitCode"].as_i64(),
            Some(0),
            "dedupe command failed: {result}"
        );
    }
    let replay_count = results
        .iter()
        .filter(|r| r["replayed"].as_bool() == Some(true))
        .count();
    assert_eq!(replay_count, 1, "跨两个宿主也只能有一次非重放: {results:?}");
    let body = std::fs::read_to_string(&target).unwrap_or_default();
    assert_eq!(body.lines().count(), 1, "同一双键只能产生一次副作用: {body}");
    let _ = std::fs::remove_file(&target);
}

#[test]
fn manager_restarts_host_and_cache_is_session_scoped() {
    let exe = env!("CARGO_BIN_EXE_ihui-tool-host");
    let manager = ToolHostManager::new(Some(Path::new(exe).to_path_buf()));

    let first = manager.ping().expect("首次 ping 应拉起宿主");
    let first_pid = first["hostPid"].as_u64().expect("hostPid");

    let run = manager
        .execute("manager-turn", "manager-call", "cmd.exe", &["/c", "echo manager-ok"], None, Some(5_000))
        .expect("manager execute");
    assert_eq!(run["exitCode"].as_i64(), Some(0));
    assert_eq!(run["replayed"].as_bool(), Some(false));

    let replay = manager
        .execute("manager-turn", "manager-call", "cmd.exe", &["/c", "echo manager-ok"], None, Some(5_000))
        .expect("manager replay");
    assert_eq!(replay["replayed"].as_bool(), Some(true));

    let restarted = manager.restart().expect("restart");
    let new_pid = restarted["hostPid"].as_u64().expect("new hostPid");
    assert_ne!(first_pid, new_pid, "restart 后应是新宿主进程");

    // 幂等缓存随宿主重启清空：同一双键在新宿主上是第一次执行。
    let after = manager
        .execute("manager-turn", "manager-call", "cmd.exe", &["/c", "echo manager-ok"], None, Some(5_000))
        .expect("after restart");
    assert_eq!(
        after["replayed"].as_bool(),
        Some(false),
        "跨重启不应把旧缓存当保证: {after}"
    );
}

#[test]
fn manager_pool_serves_concurrent_calls_and_discards_broken_clients() {
    use std::sync::{Arc, Barrier};
    use std::thread;

    let exe = env!("CARGO_BIN_EXE_ihui-tool-host");
    let manager = Arc::new(ToolHostManager::new_with_max(
        Some(Path::new(exe).to_path_buf()),
        2,
    ));
    assert_eq!(manager.pool_size(), 2);
    assert_eq!(
        ToolHostManager::new_with_max(Some(Path::new(exe).to_path_buf()), 99).pool_size(),
        8,
        "池上限必须夹在 1..8"
    );

    let barrier = Arc::new(Barrier::new(2));
    let mut handles = Vec::new();
    for index in 0..2 {
        let manager = Arc::clone(&manager);
        let barrier = Arc::clone(&barrier);
        handles.push(thread::spawn(move || {
            barrier.wait();
            manager
                .execute(
                    "pool-turn",
                    &format!("pool-call-{index}"),
                    "cmd.exe",
                    &["/c", "for /l %i in (1,1,10000000) do @rem"],
                    None,
                    Some(10_000),
                )
                .expect("并发 execute")
        }));
    }
    let mut host_pids = Vec::new();
    for handle in handles {
        let result = handle.join().expect("thread join");
        assert_eq!(result["exitCode"].as_i64(), Some(0), "并发结果: {result}");
        host_pids.push(result["hostPid"].as_u64().expect("hostPid"));
    }
    host_pids.sort_unstable();
    host_pids.dedup();
    assert_eq!(host_pids.len(), 2, "两个并发调用应落在两个不同宿主进程");

    // 正常调用把客户端归还池；后续调用应复用，而不是每次重建宿主。
    let before_bad = manager
        .execute("pool-turn", "pool-call-reuse", "cmd.exe", &["/c", "echo reuse"], None, Some(5_000))
        .expect("reuse execute");
    let before_pid = before_bad["hostPid"].as_u64().expect("hostPid");
    assert!(
        host_pids.contains(&before_pid),
        "复用调用应命中池内宿主: {before_pid} vs {host_pids:?}"
    );

    // 单独用一个只允许 1 个客户端的池验证：坏 RPC 必须丢弃客户端，下一次换新宿主。
    let one = ToolHostManager::new_with_max(Some(Path::new(exe).to_path_buf()), 1);
    let before_error = one
        .execute("pool-turn", "pool-call-before-error", "cmd.exe", &["/c", "echo ok"], None, Some(5_000))
        .expect("before error");
    let before_error_pid = before_error["hostPid"].as_u64().expect("hostPid");
    let bad = one
        .execute_with_integrity(
            "pool-turn",
            "pool-call-bad",
            "cmd.exe",
            &["/c", "echo bad"],
            None,
            Some(5_000),
            "root",
        )
        .expect_err("未知 integrity 应拒绝");
    assert!(bad.contains("integrity"), "错误={bad}");
    let after_error = one
        .execute("pool-turn", "pool-call-after-error", "cmd.exe", &["/c", "echo ok"], None, Some(5_000))
        .expect("坏客户端丢弃后应能重建");
    assert_ne!(
        before_error_pid,
        after_error["hostPid"].as_u64().expect("hostPid"),
        "坏 RPC 后应换新宿主进程"
    );
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

#[test]
fn mcp_relay_preserves_raw_frames_and_is_owned_by_host() {
    let stamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis())
        .unwrap_or(0);
    let root = std::env::temp_dir().join(format!("ihui-toolhost-mcp-{}-{stamp}", std::process::id()));
    std::fs::create_dir_all(&root).expect("create mcp test dir");
    let script = root.join("mcp-echo.cjs");
    std::fs::write(
        &script,
        r#"
process.stdin.setEncoding('utf8');
process.stderr.write('mcp-stderr-ok\n');
let buf = '';
process.stdin.on('data', (chunk) => {
  buf += chunk;
  let index;
  while ((index = buf.indexOf('\n')) >= 0) {
    const line = buf.slice(0, index);
    buf = buf.slice(index + 1);
    if (!line.trim()) continue;
    const msg = JSON.parse(line);
    const result = msg.method === 'initialize'
      ? { protocolVersion: '2024-11-05', capabilities: {}, serverInfo: { name: 'echo', version: '0' } }
      : { ok: true, method: msg.method };
    process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id: msg.id, result }) + '\n');
  }
});
"#,
    )
    .expect("write mcp echo script");

    let exe = env!("CARGO_BIN_EXE_ihui-tool-host");
    let mut client = ToolHostClient::spawn_with_exe(Path::new(exe)).expect("tool-host 应能拉起并握手");
    let open = client
        .mcp_open("mcp-relay", "node", &[script.to_string_lossy().as_ref()], None, None)
        .expect("MCP relay 应启动");
    let host = open["host"].as_str().expect("host");
    let port = open["port"].as_u64().expect("port") as u16;
    let token = open["token"].as_str().expect("token");
    assert!(open["pid"].as_u64().unwrap_or(0) > 0, "relay child pid: {open}");

    let mut stream = TcpStream::connect((host, port)).expect("连接 MCP relay");
    stream
        .write_all(format!("{token}\n").as_bytes())
        .expect("写 relay token");
    stream
        .write_all(b"{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"ping\"}\n")
        .expect("写 MCP 请求");
    let mut reader = BufReader::new(stream.try_clone().expect("clone stream"));
    let mut line = String::new();
    reader.read_line(&mut line).expect("读 MCP 响应");
    let response: Value = serde_json::from_str(line.trim()).expect("解析 MCP 响应");
    assert_eq!(response["id"], 1, "response: {response}");
    assert_eq!(response["result"]["ok"], true, "response: {response}");

    let stderr_port = open["stderrPort"].as_u64().expect("stderrPort") as u16;
    let mut stderr_stream = TcpStream::connect((host, stderr_port)).expect("连接 MCP stderr relay");
    stderr_stream
        .write_all(format!("{token}\n").as_bytes())
        .expect("写 stderr relay token");
    let mut stderr_reader = BufReader::new(stderr_stream);
    let mut stderr_line = String::new();
    stderr_reader.read_line(&mut stderr_line).expect("读 MCP stderr");
    assert_eq!(stderr_line.trim(), "mcp-stderr-ok", "stderr: {stderr_line}");

    client.mcp_close("mcp-relay").expect("关闭 relay");
    client.shutdown().expect("shutdown");
    let _ = std::fs::remove_dir_all(&root);
}
