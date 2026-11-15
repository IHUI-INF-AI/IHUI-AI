// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

//! `host_executable` 测试 —— 对标对侧六条校验 + 本模块三处超越。

use ihui_wfp_netfilter::host_executable::{
    compile_host_executables, HostExecutableClaim, HostExecutableError, HostExecutableId,
};

fn cid(s: &str) -> HostExecutableId {
    HostExecutableId(s.to_string())
}

fn claim(id: &str, name: &str, paths: &[&str]) -> HostExecutableClaim {
    HostExecutableClaim {
        id: cid(id),
        name: name.to_string(),
        paths: paths.iter().map(|s| s.to_string()).collect(),
        justification: "测试理由".to_string(),
    }
}

// ---------- 一、对侧六条校验 ----------

#[test]
fn empty_name_is_refused() {
    match compile_host_executables(&[claim("c1", "   ", &["C:\\a\\x.exe"])]) {
        Err(HostExecutableError::EmptyName { .. }) => {}
        other => panic!("期望 EmptyName，得到 {other:?}"),
    }
}

#[test]
fn non_bare_name_is_refused() {
    // 对侧：host_executable name must be a bare executable name
    for bad in ["C:\\tools\\git.exe", "dir/git", "a:b"] {
        match compile_host_executables(&[claim("c1", bad, &["C:\\tools\\git.exe"])]) {
            Err(HostExecutableError::NameNotBare { .. }) => {}
            other => panic!("{bad:?} 期望 NameNotBare，得到 {other:?}"),
        }
    }
}

#[test]
fn empty_paths_is_refused() {
    // 声明了名字却不给路径 = 无约束，必须拒绝
    match compile_host_executables(&[claim("c1", "git.exe", &[])]) {
        Err(HostExecutableError::NoPaths { .. }) => {}
        other => panic!("期望 NoPaths，得到 {other:?}"),
    }
}

#[test]
fn relative_path_is_refused() {
    for bad in ["tools\\git.exe", "./git.exe", "git.exe"] {
        match compile_host_executables(&[claim("c1", "git.exe", &[bad])]) {
            Err(HostExecutableError::PathNotAbsolute { .. }) => {}
            other => panic!("{bad:?} 期望 PathNotAbsolute，得到 {other:?}"),
        }
    }
}

#[test]
fn empty_justification_is_refused() {
    let mut c = claim("c1", "git.exe", &["C:\\tools\\git.exe"]);
    c.justification = "  ".to_string();
    match compile_host_executables(&[c]) {
        Err(HostExecutableError::EmptyJustification { .. }) => {}
        other => panic!("期望 EmptyJustification，得到 {other:?}"),
    }
}

#[test]
fn basename_mismatch_is_refused() {
    // 对侧核心约束：host_executable path `...` must have basename `...`
    match compile_host_executables(&[claim("c1", "git.exe", &["C:\\tools\\evil.exe"])]) {
        Err(HostExecutableError::BasenameMismatch { basename, name, .. }) => {
            assert_eq!(basename, "evil.exe");
            assert_eq!(name, "git.exe");
        }
        other => panic!("期望 BasenameMismatch，得到 {other:?}"),
    }
}

// ---------- 二、本模块超越：路径穿越 ----------

#[test]
fn path_traversal_is_refused() {
    // `C:\a\..\..\evil\git.exe` 是 absolute，但指向别处
    match compile_host_executables(&[claim(
        "c1",
        "git.exe",
        &["C:\\a\\..\\..\\evil\\git.exe"],
    )]) {
        Err(HostExecutableError::PathTraversal { .. }) => {}
        other => panic!("期望 PathTraversal，得到 {other:?}"),
    }
}

#[test]
fn forward_slash_traversal_also_refused() {
    match compile_host_executables(&[claim("c1", "git.exe", &["C:/a/../git.exe"])]) {
        Err(HostExecutableError::PathTraversal { .. }) => {}
        other => panic!("期望 PathTraversal，得到 {other:?}"),
    }
}

// ---------- 三、本模块超越：大小写与分隔符归一 ----------

#[test]
fn backslash_and_forward_slash_are_equivalent() {
    let a = compile_host_executables(&[claim("c1", "git.exe", &["C:\\Tools\\Git.exe"])]).unwrap();
    let b = compile_host_executables(&[claim("c1", "git.exe", &["c:/tools/git.exe"])]).unwrap();
    assert_eq!(a.bindings[0].paths, b.bindings[0].paths, "两种分隔符应归一为同一形态");
}

#[test]
fn name_is_case_insensitive_for_basename_check() {
    // name=Git.EXE，path basename=git.exe ⇒ 大小写不同但应通过
    let c = compile_host_executables(&[claim("c1", "Git.EXE", &["C:\\tools\\git.exe"])]).unwrap();
    assert_eq!(c.bindings[0].name, "git.exe");
}

// ---------- 四、去重与冲突 ----------

#[test]
fn identical_claims_are_deduped() {
    let cs = vec![
        claim("c1", "git.exe", &["C:\\tools\\git.exe"]),
        claim("c2", "GIT.EXE", &["c:/tools/git.exe"]), // 归一后同义
    ];
    let out = compile_host_executables(&cs).unwrap();
    assert_eq!(out.bindings.len(), 1);
    assert_eq!(out.deduped.len(), 1);
    assert_eq!(out.deduped[0].0, "c2");
}

#[test]
fn conflicting_path_sets_are_refused() {
    let cs = vec![
        claim("c1", "git.exe", &["C:\\tools\\git.exe"]),
        claim("c2", "git.exe", &["D:\\other\\git.exe"]),
    ];
    match compile_host_executables(&cs) {
        Err(HostExecutableError::ConflictingPaths { name, first, second }) => {
            assert_eq!(name, "git.exe");
            assert_ne!(first, second);
        }
        other => panic!("期望 ConflictingPaths，得到 {other:?}"),
    }
}

#[test]
fn same_name_different_case_is_same_binding() {
    let cs = vec![
        claim("c1", "Git.exe", &["C:\\a\\git.exe"]),
        claim("c2", "git.EXE", &["C:\\a\\git.exe"]),
    ];
    let out = compile_host_executables(&cs).unwrap();
    assert_eq!(out.bindings.len(), 1);
}

// ---------- 五、多路径与排序稳定 ----------

#[test]
fn multiple_paths_are_sorted_and_deduped() {
    let c = compile_host_executables(&[claim(
        "c1",
        "git.exe",
        &[
            "C:\\z\\git.exe",
            "C:\\a\\git.exe",
            "c:/a/GIT.EXE", // 与上一条归一同义
        ],
    )])
    .unwrap();
    let paths: Vec<&str> = c.bindings[0].paths.iter().map(|p| p.as_str()).collect();
    assert_eq!(paths, vec!["c:/a/git.exe", "c:/z/git.exe"]);
}

#[test]
fn unc_path_is_accepted() {
    let c = compile_host_executables(&[claim("c1", "git.exe", &["\\\\server\\share\\git.exe"])]);
    assert!(c.is_ok(), "UNC 绝对路径应被接受");
}

// ---------- 六、查表与失败方向 ----------

#[test]
fn lookup_is_case_insensitive() {
    let c = compile_host_executables(&[
        claim("c1", "git.exe", &["C:\\tools\\git.exe"]),
        claim("c2", "node.exe", &["C:\\nodejs\\node.exe"]),
    ])
    .unwrap();
    assert!(c.lookup("GIT.EXE").is_some());
    assert!(c.lookup("node.exe").is_some());
    assert!(c.lookup("missing.exe").is_none());
}

#[test]
fn is_locked_path_true_only_for_declared_pair() {
    let c = compile_host_executables(&[claim("c1", "git.exe", &["C:\\tools\\git.exe"])]).unwrap();
    assert!(c.is_locked_path("git.exe", "C:\\tools\\git.exe"));
    assert!(c.is_locked_path("GIT.EXE", "c:/tools/git.exe"));
    // 同名的别处路径
    assert!(!c.is_locked_path("git.exe", "C:\\evil\\git.exe"));
    // 未声明的名字
    assert!(!c.is_locked_path("other.exe", "C:\\tools\\git.exe"));
}

#[test]
fn undeclared_name_is_false_not_allow() {
    // 失败方向恒定：查不到 ≠ 放行
    let c = compile_host_executables(&[claim("c1", "git.exe", &["C:\\tools\\git.exe"])]).unwrap();
    assert!(
        !c.is_locked_path("never-declared.exe", "C:\\anything\\never-declared.exe"),
        "未声明的名字必须判 false，不得因「没约束」而放行"
    );
}

#[test]
fn empty_claim_set_yields_empty_compilation() {
    let out = compile_host_executables(&[]).unwrap();
    assert!(out.bindings.is_empty());
    assert!(out.deduped.is_empty());
}

// ---------- 七、失败方向：任一坏声明整体失败 ----------

#[test]
fn one_bad_claim_fails_the_whole_set() {
    let cs = vec![
        claim("good", "git.exe", &["C:\\tools\\git.exe"]),
        claim("bad", "node.exe", &["C:\\evil\\git.exe"]), // basename 不符
    ];
    assert!(
        compile_host_executables(&cs).is_err(),
        "有一条坏声明必须整体失败，不得跳过（跳过会让未授权路径静默消失）"
    );
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
