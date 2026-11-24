// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

//! feed v2 解析与灰度判定（纯逻辑，不联网）。
//!
//! 兼容两种输入：
//! - v2：`schema:2`，顶层 `payload`（zip + sha256 + minisign 签名），支持 rollout/revoked/rollbackTo。
//! - legacy：Tauri updater 的 `platforms` 映射，迁移期不把老 feed 打挂。
//!
//! 灰度必须是客户端确定性判定：`hash(MachineGuid|version|salt) % 100 < percent`，
//! 同一台机器同一版本永远落在同一桶；服务端不需要维护名单，也不会因为重试漂移。

use serde::Deserialize;
use std::cmp::Ordering;
use std::collections::HashMap;

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Feed {
    #[serde(default = "default_schema")]
    pub schema: u32,
    pub version: String,
    #[serde(default)]
    pub channel: Option<String>,
    #[serde(default)]
    pub min_supported: Option<String>,
    #[serde(default)]
    pub rollout: Option<Rollout>,
    #[serde(default)]
    pub revoked: Vec<String>,
    #[serde(default)]
    pub rollback_to: Option<String>,
    #[serde(default)]
    pub notes: Option<String>,
    #[serde(default)]
    pub payload: Option<Payload>,
    #[serde(default)]
    pub platforms: Option<HashMap<String, Payload>>,
    #[serde(default, alias = "pub_date", alias = "pubDate")]
    pub published_at: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(untagged)]
pub enum Rollout {
    Percent(u8),
    Config(RolloutConfig),
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RolloutConfig {
    pub percent: u8,
    #[serde(default)]
    pub salt: Option<String>,
}

impl Rollout {
    pub fn percent(&self) -> u8 {
        match self {
            Self::Percent(value) => *value,
            Self::Config(config) => config.percent,
        }
    }
    pub fn salt(&self) -> Option<&str> {
        match self {
            Self::Percent(_) => None,
            Self::Config(config) => config.salt.as_deref(),
        }
    }
}

#[derive(Debug, Clone, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct Payload {
    pub url: String,
    pub size: u64,
    pub sha256: String,
    #[serde(default)]
    pub signature: String,
    #[serde(default = "default_format")]
    pub format: String,
    #[serde(default)]
    pub platform: Option<String>,
    #[serde(default)]
    pub min_launcher: Option<String>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Verdict {
    UpToDate,
    Offer,
    Rollback,
    Revoked,
    Excluded,
    NoPayload,
    Invalid,
}

impl Verdict {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::UpToDate => "up-to-date",
            Self::Offer => "offer",
            Self::Rollback => "rollback",
            Self::Revoked => "revoked",
            Self::Excluded => "excluded",
            Self::NoPayload => "no-payload",
            Self::Invalid => "invalid",
        }
    }
}

#[derive(Debug, Clone)]
pub struct Evaluation {
    pub verdict: Verdict,
    /// 目标版本；UpToDate 时等于 current。
    pub version: String,
    /// 低于 minSupported：UI 必须显示安全更新，但不自动退出。
    pub mandatory: bool,
    /// 需要先换 Launcher（zip 更新无法自举启动器）。
    pub requires_bootstrap: bool,
    pub notes: Option<String>,
    pub payload: Option<Payload>,
    pub reason: String,
}

impl Evaluation {
    pub fn is_offer(&self) -> bool {
        matches!(self.verdict, Verdict::Offer | Verdict::Rollback)
    }

    pub fn up_to_date(current: &str) -> Self {
        Self {
            verdict: Verdict::UpToDate,
            version: current.to_string(),
            mandatory: false,
            requires_bootstrap: false,
            notes: None,
            payload: None,
            reason: "current".into(),
        }
    }
}

impl Feed {
    pub fn from_json(text: &str) -> Result<Self, String> {
        let feed: Feed = serde_json::from_str(text).map_err(|err| format!("feed json: {err}"))?;
        if feed.schema != 1 && feed.schema != 2 {
            return Err(format!("unsupported feed schema: {}", feed.schema));
        }
        if !is_valid_version(&feed.version) {
            return Err(format!("illegal feed version: {}", feed.version));
        }
        Ok(feed)
    }

    pub fn payload_for(&self, platform: &str) -> Option<&Payload> {
        if let Some(payload) = &self.payload {
            if payload.platform.as_deref().map_or(true, |p| p == platform) {
                return Some(payload);
            }
        }
        self.platforms
            .as_ref()
            .and_then(|map| map.get(platform).or_else(|| map.get("windows-x86_64")))
    }

    /// 某个版本是否在服务端 revoked 清单里（支持带 v 前缀）。
    pub fn is_revoked(&self, version: &str) -> bool {
        let normalized = version.trim_start_matches('v');
        self.revoked
            .iter()
            .any(|v| v.trim_start_matches('v') == normalized)
    }

    pub fn rollout_percent(&self) -> u8 {
        self.rollout
            .as_ref()
            .map(Rollout::percent)
            .unwrap_or(100)
            .min(100)
    }

    fn rollout_salt(&self) -> &str {
        self.rollout
            .as_ref()
            .and_then(Rollout::salt)
            .unwrap_or("ihui-feed-v2")
    }

    /// 判定是否给这台机器发更新。`machine_id` 是匿名安装标识（不是硬件指纹），
    /// 只用于灰度分桶；`launcher_version` 用于判断是否需要先升级 Launcher。
    pub fn evaluate(
        &self,
        current: &str,
        launcher_version: &str,
        machine_id: &str,
        platform: &str,
    ) -> Evaluation {
        let target = self.version.trim_start_matches('v').to_string();
        if !is_valid_version(current) || !is_valid_version(&target) {
            return Evaluation {
                verdict: Verdict::Invalid,
                version: current.to_string(),
                mandatory: false,
                requires_bootstrap: false,
                notes: self.notes.clone(),
                payload: None,
                reason: "illegal version".into(),
            };
        }

        // 服务端撤版优先：当前版本在 revoked 里，且给了本地可退回的目标。
        if self
            .revoked
            .iter()
            .any(|v| v.trim_start_matches('v') == current)
        {
            if let Some(rollback) = self
                .rollback_to
                .as_deref()
                .map(|v| v.trim_start_matches('v'))
                .filter(|v| *v != current && is_valid_version(v))
            {
                return Evaluation {
                    verdict: Verdict::Rollback,
                    version: rollback.to_string(),
                    mandatory: false,
                    requires_bootstrap: false,
                    notes: self.notes.clone(),
                    payload: None,
                    reason: format!("{current} revoked; rollbackTo={rollback}"),
                };
            }
            return Evaluation {
                verdict: Verdict::Revoked,
                version: target,
                mandatory: false,
                requires_bootstrap: false,
                notes: self.notes.clone(),
                payload: None,
                reason: format!("{current} revoked without rollbackTo"),
            };
        }

        if cmp_versions(current, &target) != Ordering::Less {
            return Evaluation::up_to_date(current);
        }

        if self
            .revoked
            .iter()
            .any(|v| v.trim_start_matches('v') == target)
        {
            return Evaluation {
                verdict: Verdict::Revoked,
                version: target,
                mandatory: false,
                requires_bootstrap: false,
                notes: self.notes.clone(),
                payload: None,
                reason: "target revoked".into(),
            };
        }

        let percent = self.rollout_percent();
        if percent < 100
            && rollout_bucket(machine_id, &target, self.rollout_salt()) >= u32::from(percent)
        {
            return Evaluation {
                verdict: Verdict::Excluded,
                version: target,
                mandatory: false,
                requires_bootstrap: false,
                notes: self.notes.clone(),
                payload: None,
                reason: format!("bucket outside {percent}% rollout"),
            };
        }

        let Some(payload) = self.payload_for(platform) else {
            return Evaluation {
                verdict: Verdict::NoPayload,
                version: target,
                mandatory: false,
                requires_bootstrap: false,
                notes: self.notes.clone(),
                payload: None,
                reason: format!("no payload for {platform}"),
            };
        };
        if let Err(err) = payload.validate() {
            return Evaluation {
                verdict: Verdict::Invalid,
                version: target,
                mandatory: false,
                requires_bootstrap: false,
                notes: self.notes.clone(),
                payload: None,
                reason: err,
            };
        }

        let mandatory = self
            .min_supported
            .as_deref()
            .filter(|v| is_valid_version(v))
            .map(|v| cmp_versions(current, v) == Ordering::Less)
            .unwrap_or(false);
        let requires_bootstrap = payload
            .min_launcher
            .as_deref()
            .filter(|v| is_valid_version(v))
            .map(|v| cmp_versions(launcher_version, v) == Ordering::Less)
            .unwrap_or(false);

        Evaluation {
            verdict: Verdict::Offer,
            version: target,
            mandatory,
            requires_bootstrap,
            notes: self.notes.clone(),
            payload: Some(payload.clone()),
            reason: "newer version in rollout".into(),
        }
    }
}

impl Payload {
    pub fn validate(&self) -> Result<(), String> {
        if !self.url.starts_with("https://") {
            return Err("payload url must be https".into());
        }
        if self.size == 0 {
            return Err("payload size must be > 0".into());
        }
        if !is_sha256(&self.sha256) {
            return Err("payload sha256 must be 64 hex chars".into());
        }
        if self.signature.trim().is_empty() {
            return Err("payload signature is empty".into());
        }
        if self.format != "zip" {
            return Err(format!("unsupported payload format: {}", self.format));
        }
        Ok(())
    }
}

/// 灰度分桶：FNV-1a 64 位，取模 100。`machine_id` 统一小写，重装/升级不会变。
pub fn rollout_bucket(machine_id: &str, version: &str, salt: &str) -> u32 {
    let input = format!("{}|{}|{}", machine_id.to_lowercase(), version, salt);
    let mut hash = 0xcbf2_9ce4_8422_2325u64;
    for byte in input.as_bytes() {
        hash ^= u64::from(*byte);
        hash = hash.wrapping_mul(0x0000_0100_0000_01B3);
    }
    (hash % 100) as u32
}

/// 近似 semver 比较：忽略 build metadata；prerelease 低于 release。
/// 缺失段小于存在段（1.0 < 1.0.1）；数字段按数值比，其余按字典序。
pub fn cmp_versions(a: &str, b: &str) -> Ordering {
    let a = a.trim_start_matches('v');
    let b = b.trim_start_matches('v');
    let (a_core, a_pre) = split_version(a);
    let (b_core, b_pre) = split_version(b);

    let mut ai = a_core.split('.');
    let mut bi = b_core.split('.');
    loop {
        match (ai.next(), bi.next()) {
            (None, None) => break,
            (None, Some(_)) => return Ordering::Less,
            (Some(_), None) => return Ordering::Greater,
            (Some(x), Some(y)) => {
                let ord = match (x.parse::<u64>(), y.parse::<u64>()) {
                    (Ok(nx), Ok(ny)) => nx.cmp(&ny),
                    _ => x.cmp(y),
                };
                if ord != Ordering::Equal {
                    return ord;
                }
            }
        }
    }

    match (a_pre, b_pre) {
        (None, None) => Ordering::Equal,
        (None, Some(_)) => Ordering::Greater,
        (Some(_), None) => Ordering::Less,
        (Some(x), Some(y)) => {
            let mut xi = x.split('.');
            let mut yi = y.split('.');
            loop {
                match (xi.next(), yi.next()) {
                    (None, None) => return Ordering::Equal,
                    (None, Some(_)) => return Ordering::Less,
                    (Some(_), None) => return Ordering::Greater,
                    (Some(x), Some(y)) => {
                        let ord = match (x.parse::<u64>(), y.parse::<u64>()) {
                            (Ok(nx), Ok(ny)) => nx.cmp(&ny),
                            _ => x.cmp(y),
                        };
                        if ord != Ordering::Equal {
                            return ord;
                        }
                    }
                }
            }
        }
    }
}

fn split_version(value: &str) -> (&str, Option<&str>) {
    let core = value.split('+').next().unwrap_or(value);
    match core.split_once('-') {
        Some((core, pre)) if !pre.is_empty() => (core, Some(pre)),
        _ => (core, None),
    }
}

pub fn is_valid_version(value: &str) -> bool {
    let value = value.trim_start_matches('v');
    !value.is_empty()
        && value.len() <= 64
        && value
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || c == '.' || c == '-')
        && value != "."
        && value != ".."
        && !value.starts_with('.')
}

pub fn is_sha256(value: &str) -> bool {
    value.len() == 64 && value.chars().all(|c| c.is_ascii_hexdigit())
}

fn default_schema() -> u32 {
    1
}

fn default_format() -> String {
    "zip".into()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn v2_feed(percent: u8, revoked: Vec<&str>) -> String {
        format!(
            r#"{{
              "schema": 2,
              "version": "0.1.94",
              "minSupported": "0.1.80",
              "rollout": {{"percent": {percent}, "salt": "phase-1"}},
              "revoked": [{}],
              "rollbackTo": "0.1.93",
              "notes": "test",
              "payload": {{
                "url": "https://aizhs.top/releases/0.1.94.zip",
                "size": 123456,
                "sha256": "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
                "signature": "untrusted comment: signature\\nRWQ...",
                "format": "zip",
                "platform": "windows-x86_64",
                "minLauncher": "0.1.0"
              }}
            }}"#,
            revoked
                .iter()
                .map(|v| format!("\"{v}\""))
                .collect::<Vec<_>>()
                .join(",")
        )
    }

    #[test]
    fn v2_feed_offers_when_newer() {
        let feed = Feed::from_json(&v2_feed(100, vec![])).unwrap();
        let eval = feed.evaluate("0.1.93", "0.1.0", "machine-a", "windows-x86_64");
        assert_eq!(eval.verdict, Verdict::Offer);
        assert_eq!(eval.version, "0.1.94");
        assert!(eval.payload.is_some());
        assert!(!eval.mandatory);
        assert!(!eval.requires_bootstrap);
    }

    #[test]
    fn release_script_fixture_parses() {
        let feed = Feed::from_json(include_str!("../tests/fixtures/feed-v2.json")).unwrap();
        let eval = feed.evaluate("0.1.98", "0.1.0", "machine-1", "windows-x86_64");
        assert_eq!(eval.verdict, Verdict::Offer);
        assert_eq!(eval.version, "0.1.99");
        assert!(eval.payload.is_some());
    }

    #[test]
    fn current_is_up_to_date() {
        let feed = Feed::from_json(&v2_feed(100, vec![])).unwrap();
        let eval = feed.evaluate("0.1.94", "0.1.0", "machine-a", "windows-x86_64");
        assert_eq!(eval.verdict, Verdict::UpToDate);
    }

    #[test]
    fn rollout_excludes_by_bucket() {
        let feed = Feed::from_json(&v2_feed(1, vec![])).unwrap();
        let mut offered = 0;
        for i in 0..1000 {
            let eval = feed.evaluate("0.1.93", "0.1.0", &format!("machine-{i}"), "windows-x86_64");
            if eval.verdict == Verdict::Offer {
                offered += 1;
            }
        }
        // 1% 灰度：1000 台里应在 1 附近，允许 0..=10 的稀疏波动。
        assert!(offered <= 10, "offered {offered}");
    }

    #[test]
    fn revoked_current_without_other_target_is_revoked() {
        let feed = Feed::from_json(&v2_feed(100, vec!["0.1.93"])).unwrap();
        let eval = feed.evaluate("0.1.93", "0.1.0", "machine-a", "windows-x86_64");
        assert_eq!(eval.verdict, Verdict::Revoked);
    }

    #[test]
    fn revoked_current_with_other_target_rolls_back() {
        let feed = Feed::from_json(&v2_feed(100, vec!["0.1.94"])).unwrap();
        let eval = feed.evaluate("0.1.94", "0.1.0", "machine-a", "windows-x86_64");
        // 当前就是被撤的版本，rollbackTo=0.1.93
        assert_eq!(eval.verdict, Verdict::Rollback);
        assert_eq!(eval.version, "0.1.93");
    }

    #[test]
    fn min_supported_marks_mandatory() {
        let feed = Feed::from_json(&v2_feed(100, vec![])).unwrap();
        let eval = feed.evaluate("0.1.79", "0.1.0", "machine-a", "windows-x86_64");
        assert_eq!(eval.verdict, Verdict::Offer);
        assert!(eval.mandatory);
    }

    #[test]
    fn old_launcher_requires_bootstrap() {
        let feed = Feed::from_json(&v2_feed(100, vec![])).unwrap();
        let eval = feed.evaluate("0.1.90", "0.0.9", "machine-a", "windows-x86_64");
        assert!(eval.requires_bootstrap);
    }

    #[test]
    fn bad_sha_is_invalid() {
        let json = v2_feed(100, vec![]).replace(
            "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
            "not-a-sha",
        );
        let feed = Feed::from_json(&json).unwrap();
        let eval = feed.evaluate("0.1.93", "0.1.0", "machine-a", "windows-x86_64");
        assert_eq!(eval.verdict, Verdict::Invalid);
    }

    #[test]
    fn legacy_platforms_feed_is_accepted() {
        let json = r#"{
          "version": "0.1.94",
          "notes": "legacy",
          "pub_date": "2026-11-24T00:00:00Z",
          "platforms": {
            "windows-x86_64": {
              "url": "https://aizhs.top/releases/0.1.94.zip",
              "size": 123,
              "sha256": "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
              "signature": "sig"
            }
          }
        }"#;
        let feed = Feed::from_json(json).unwrap();
        assert_eq!(feed.schema, 1);
        let eval = feed.evaluate("0.1.93", "0.1.0", "machine-a", "windows-x86_64");
        assert_eq!(eval.verdict, Verdict::Offer);
    }

    #[test]
    fn semver_ordering() {
        assert_eq!(cmp_versions("0.1.93", "0.1.94"), Ordering::Less);
        assert_eq!(cmp_versions("0.1.9", "0.1.10"), Ordering::Less);
        assert_eq!(cmp_versions("0.1.94", "0.1.94"), Ordering::Equal);
        assert_eq!(cmp_versions("0.1.94-beta.1", "0.1.94"), Ordering::Less);
        assert_eq!(cmp_versions("0.1.94", "0.1.94-beta.1"), Ordering::Greater);
        assert_eq!(cmp_versions("v0.1.94", "0.1.94"), Ordering::Equal);
    }

    #[test]
    fn bucket_is_stable() {
        let first = rollout_bucket("machine-a", "0.1.94", "phase-1");
        let second = rollout_bucket("machine-a", "0.1.94", "phase-1");
        assert_eq!(first, second);
        assert!(first < 100);
    }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
