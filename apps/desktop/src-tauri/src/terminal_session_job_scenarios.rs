// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

//! L02 Job Object 执行器三场景验收（真实进程，不 mock）。
//!
//! 判据来自对标落地 RP-2：**子进程退出后 Job 内进程数为 0，CTRL+C／超时／崩溃三场景不留孤儿**。
//! 这里的三个用例就是那三场景的可复现版本：
//!  1. 正常退出：子进程自己退出 → 作业内活跃数读回 0（不是"大概没了"，是内核计数）；
//!  2. 超时：长命令挂住 → `TerminateJobObject` 整树终止 → 子进程被回收、活跃数 0；
//!  3. 崩溃/退出：父进程异常退出等价于**作业句柄关闭** → `KILL_ON_JOB_CLOSE` 由内核终止整组，
//!     子进程在 3 秒内消失（这条不依赖任何枚举，正是机制本身的卖点）。
//!
//! 只在 Windows + 测试配置下编译：作业对象是 Windows 内核概念，别的平台没有对应语义。

use super::{assign_to_job, JobObject};
use std::process::{Child, Command, Stdio};
use std::time::{Duration, Instant};

fn spawn_quiet(program: &str, args: &[&str]) -> Child {
    Command::new(program)
        .args(args)
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn()
        .unwrap_or_else(|e| panic!("spawn {program} {args:?} 失败: {e}"))
}

fn wait_active_zero(job: &JobObject, timeout: Duration) -> u32 {
    let start = Instant::now();
    loop {
        match job.active_processes() {
            Some(0) => return 0,
            Some(n) => {
                if start.elapsed() > timeout {
                    return n;
                }
            }
            None => panic!("QueryInformationJobObject 失败：验收不许把“读不到”当 0"),
        }
        std::thread::sleep(Duration::from_millis(50));
    }
}

#[test]
fn scenario_1_normal_exit_leaves_no_process_in_job() {
    let job = JobObject::create_kill_on_close().expect("建 kill-on-close 作业失败");
    // 2 秒后自然退出的子进程：给它足够时间先被挂进作业，再自己结束。
    let mut child = spawn_quiet("cmd", &["/c", "ping", "-n", "2", "127.0.0.1"]);
    assert!(assign_to_job(&job, &child), "挂入作业失败，验收前置不成立");
    assert_eq!(
        child.wait().expect("等子进程退出失败").code(),
        Some(0),
        "子进程应正常退出"
    );
    assert_eq!(
        wait_active_zero(&job, Duration::from_secs(5)),
        0,
        "子进程退出后作业内活跃进程数必须为 0"
    );
}

#[test]
fn scenario_2_timeout_kills_whole_tree() {
    let job = JobObject::create_kill_on_close().expect("建 kill-on-close 作业失败");
    let mut child = spawn_quiet("cmd", &["/c", "ping", "-n", "30", "127.0.0.1"]);
    assert!(assign_to_job(&job, &child), "挂入作业失败，验收前置不成立");
    assert!(
        job.active_processes().unwrap_or(0) >= 1,
        "挂入后作业内至少应有 1 个进程"
    );
    assert!(job.terminate(1), "TerminateJobObject 下发失败");
    let _ = child.wait();
    assert_eq!(
        wait_active_zero(&job, Duration::from_secs(5)),
        0,
        "超时终止后作业内活跃进程数必须为 0"
    );
}

#[test]
fn scenario_3_handle_close_terminates_group_like_crash() {
    let job = JobObject::create_kill_on_close().expect("建 kill-on-close 作业失败");
    let mut child = spawn_quiet("cmd", &["/c", "ping", "-n", "30", "127.0.0.1"]);
    assert!(assign_to_job(&job, &child), "挂入作业失败，验收前置不成立");
    let started = Instant::now();
    // 父进程异常退出 ⇒ 内核关闭作业句柄 ⇒ KILL_ON_JOB_CLOSE 终止整组。
    drop(job);
    let waited = child.wait().expect("等子进程被内核终止失败");
    assert!(
        started.elapsed() < Duration::from_secs(3),
        "句柄关闭后子进程应在 3 秒内被终止，实际 {:?}",
        started.elapsed()
    );
    assert!(
        waited.code().is_some() || waited.success(),
        "子进程应已有退出状态（被终止也满足“不留孤儿”）"
    );
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
