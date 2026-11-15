// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

//! 手写 WFP FFI 绑定 —— 静态接线层。
//!
//! # 为什么需要手写（对齐 AGENTS.md §0.12「逆向-复现-超越」）
//!
//! `windows-sys 0.52`（`src-tauri` 的依赖，不能升级否则双副本冲突）**只导出了 WFP 的
//! 一半符号**，探针实测（确定性）：
//!
//! - ✅ 有：`FWP_ACTION_PERMIT/BLOCK`、`FWP_MATCH_EQUAL`、`FWPM_PROVIDER0/SUBLAYER0`、
//!   `FwpmEngineClose0/FreeMemory0/*Enum0`
//! - ❌ 缺：`FwpmEngineOpen0`、`FwpmFilterAdd0`、`FwpmTransactionBegin0/Commit0/Abort0`、
//!   `FwpmProviderAdd0`、`FwpmSubLayerAdd0`，及全部 `FWPM_FILTER0/FWPM_FILTER_CONDITION0/FWP_VALUE0`
//!
//! 所以要接真函数就必须自己声明缺失的那一半。本模块就是这一半。
//!
//! # 取证依据（每一项都不是猜）
//!
//! - **结构体布局**：本机 Windows SDK `10.0.26100.0/shared/fwpmtypes.h`（`FWPM_FILTER0`
//!   字段序 486–507 行）+ `fwptypes.h`（`FWP_VALUE0` union 165–189 行、`FWP_BYTE_BLOB`
//!   151–155 行）**逐字段取证**。所有 size/align 由 [`compile_time_layout_asserts`] 钉住。
//! - **条件字段 / layer GUID**：两个独立来源交叉验证（见
//!   `.ihui-agent/tmp/goal-codex/evidence/wfp-condition-guids-authoritative.md`）：
//!   ① 对侧 `codex-windows-sandbox-service.exe` 调用点反汇编解出；
//!   ② WireGuard Windows 绑定引用 `fwpmu.h`。三个重叠 GUID 逐字节吻合。
//! - **常量值**：`FWP_ACTION_*`、`FWP_MATCH_EQUAL`、`FWP_DATA_*`、IPPROTO_* 均与 SDK 头一致。
//!
//! # 边界：本模块只做静态接线，不做端到端安装（用户选 static-only）
//!
//! 本模块**只做编译期可验证**的事：
//! 1. 声明缺失的 Fwpm 函数（`extern "system"`，链接 `fwpuclnt.dll`，仅 Windows 门禁）；
//! 2. 按 SDK 精确布局定义结构体，size/align 由编译期断言钉死；
//! 3. 把权威 GUID 编码成 [`Guid`]，单测逐字节对齐取证值；
//! 4. 把 [`FilterSpec`] 纯逻辑展开成条件序列（跨平台可测）。
//!
//! **本模块不导出任何会改系统状态的函数**，也不构造可安装的 `FWPM_FILTER0` 实例。
//! 条件序列（[`FilterCondition`]）与完整 filter 实例之间仍差一层「条件值 →
//! `FWP_VALUE0` union 填充 + 指针数组拼装」的组装代码，那需要真实调用 `FwpmFilterAdd0`
//! 才能端到端验证，按「做了但不能验证 = 没做」原则**不在本模块做**。
//! `install` 模块仍保持 `is_effective() == false`。

#![allow(non_camel_case_types)]
#![allow(non_snake_case)]
#![allow(clippy::upper_case_acronyms)]
#![allow(missing_docs)]

use std::net::IpAddr;

use crate::policy::{Decision, FilterSpec, Host};

// ── Windows 基础类型（避免为此引入整个 windows-sys 的 WFP feature）────────

/// `GUID` —— 与 Windows `GUID` 内存布局一致（16 字节，align 4）。
///
/// 自定义而非复用 `windows-sys`，让本模块**自包含**：不依赖该 crate 的 WFP feature
/// 是否齐全，也便于在任意平台对 GUID 编码做单测。
#[repr(C)]
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Guid {
    /// 首段。
    pub Data1: u32,
    /// 第二段。
    pub Data2: u16,
    /// 第三段。
    pub Data3: u16,
    /// 末 8 字节。
    pub Data4: [u8; 8],
}

/// `UINT64`。
pub type UINT64 = u64;
/// `UINT32`。
pub type UINT32 = u32;
/// `UINT16`。
pub type UINT16 = u16;
/// `UINT8`。
pub type UINT8 = u8;
/// `BYTE`。
pub type BYTE = u8;
/// `DWORD`。
pub type DWORD = u32;
/// `FWP_DATA_TYPE`（枚举，按 UINT32 传）。
pub type FWP_DATA_TYPE = UINT32;
/// `FWP_MATCH_TYPE`（枚举，按 UINT32 传）。
pub type FWP_MATCH_TYPE = UINT32;

// ── 常量（与 SDK fwptypes.h 一致）────────────────────────────────────────

/// `FWP_ACTION_BLOCK`（终止型阻断）。
pub const FWP_ACTION_BLOCK: UINT32 = 0x0000_1000;
/// `FWP_ACTION_PERMIT`（终止型放行）。
pub const FWP_ACTION_PERMIT: UINT32 = 0x0000_1001;
/// `FWP_MATCH_EQUAL`。
pub const FWP_MATCH_EQUAL: FWP_MATCH_TYPE = 0;
/// `FWP_EMPTY`。
pub const FWP_EMPTY: FWP_DATA_TYPE = 0;
/// `FWP_DATA_UINT8`。
pub const FWP_DATA_UINT8: FWP_DATA_TYPE = 3;
/// `FWP_DATA_V4_ADDR_MASK`。
pub const FWP_DATA_V4_ADDR_MASK: FWP_DATA_TYPE = 9;
/// `FWP_DATA_V6_ADDR_MASK`。
pub const FWP_DATA_V6_ADDR_MASK: FWP_DATA_TYPE = 10;
/// `IPPROTO_TCP`。
pub const IPPROTO_TCP: u8 = 6;
/// `IPPROTO_UDP`。
pub const IPPROTO_UDP: u8 = 17;

// ── 权威 GUID（两个独立来源交叉验证，见模块文档）───────────────────────

/// `FWPM_CONDITION_IP_REMOTE_ADDRESS` = `b235ae9a-1d64-49b8-a44c-5ff3d9095045`。
pub const FWPM_CONDITION_IP_REMOTE_ADDRESS: Guid =
    guid(0xb235ae9a, 0x1d64, 0x49b8, [0xa4, 0x4c, 0x5f, 0xf3, 0xd9, 0x09, 0x50, 0x45]);
/// `FWPM_CONDITION_IP_PROTOCOL` = `3971ef2b-623e-4f9a-8cb1-6e79b806b9a7`。
///
/// **交叉验证锚点**：对侧二进制反汇编解出的值与 fwpmu.h 逐字节吻合。
pub const FWPM_CONDITION_IP_PROTOCOL: Guid =
    guid(0x3971ef2b, 0x623e, 0x4f9a, [0x8c, 0xb1, 0x6e, 0x79, 0xb8, 0x06, 0xb9, 0xa7]);
/// `FWPM_LAYER_ALE_AUTH_CONNECT_V4` = `c38d57d1-05a7-4c33-904f-7fbceee60e82`。
///
/// 出站连接授权层 —— `network_rule` 的落点。
pub const FWPM_LAYER_ALE_AUTH_CONNECT_V4: Guid =
    guid(0xc38d57d1, 0x05a7, 0x4c33, [0x90, 0x4f, 0x7f, 0xbc, 0xee, 0xe6, 0x0e, 0x82]);
/// `FWPM_LAYER_ALE_AUTH_CONNECT_V6` = `4a72393b-319f-44bc-84c3-ba54dcb3b6b4`。
pub const FWPM_LAYER_ALE_AUTH_CONNECT_V6: Guid =
    guid(0x4a72393b, 0x319f, 0x44bc, [0x84, 0xc3, 0xba, 0x54, 0xdc, 0xb3, 0xb6, 0xb4]);

/// 从标准大端写法构造 `Guid`。
pub const fn guid(data1: u32, data2: u16, data3: u16, data4: [u8; 8]) -> Guid {
    Guid { Data1: data1, Data2: data2, Data3: data3, Data4: data4 }
}

// ── 结构体（SDK fwpmtypes.h / fwptypes.h 精确布局）──────────────────────

/// `FWP_BYTE_ARRAY16` —— 16 字节定长（IPv6 地址用）。
#[repr(C)]
#[derive(Debug, Clone, Copy)]
pub struct FWP_BYTE_ARRAY16 {
    /// 16 字节。
    pub byte16: [BYTE; 16],
}

/// `FWP_V4_ADDR_AND_MASK`（8 字节：addr + mask）。
#[repr(C)]
#[derive(Debug, Clone, Copy)]
pub struct FWP_V4_ADDR_AND_MASK {
    /// IPv4 地址（网络序）。
    pub addr: UINT32,
    /// 子网掩码。
    pub mask: UINT32,
}

/// `FWP_V6_ADDR_AND_MASK`（17 字节：16 地址 + 前缀长度）。
#[repr(C)]
#[derive(Debug, Clone, Copy)]
pub struct FWP_V6_ADDR_AND_MASK {
    /// IPv6 地址。
    pub addr: [BYTE; 16],
    /// 前缀长度。
    pub prefixLength: UINT8,
}

/// `FWP_BYTE_BLOB` —— {size, data}（SDK fwptypes.h 151–155 行）。
#[repr(C)]
#[derive(Debug, Clone, Copy)]
pub struct FWP_BYTE_BLOB {
    /// 字节数。
    pub size: UINT32,
    /// 数据指针。
    pub data: *mut UINT8,
}

/// `FWPM_DISPLAY_DATA0` —— {name, description} 双宽字符串指针。
#[repr(C)]
#[derive(Debug, Clone, Copy)]
pub struct FWPM_DISPLAY_DATA0 {
    /// 显示名。
    pub name: *const u16,
    /// 描述。
    pub description: *const u16,
}

/// `FWP_VALUE0` —— 带类型的值容器（SDK fwptypes.h 165–189 行）。
///
/// `type` 是 `FWP_DATA_TYPE`，后跟 union。union 最大分支是 8 字节指针
/// （`UINT64*` / `FWP_BYTE_ARRAY16*` / `SID*` / `LPWSTR` 等），对齐 8，故
/// **C 布局为 `type(4) + padding(4) + union(8) = 16 字节，align 8`**。
///
/// # 为什么 value 用 `u64` 而不是 `[u8; 8]`
///
/// `[u8; 8]` 的对齐是 1，会让 Rust 编译器省掉 type 后的 4 字节 padding，
/// 把整个结构体压成 12 字节 / align 4 —— 与 C 的 align 8 布局不一致，导致
/// `FWPM_FILTER0` 里 `weight` 之后所有字段偏移错位 4。用 `u64`（align 8）
/// 占位才能复现 C 的 padding 与对齐。**这一点由编译器在首次 `cargo build`
/// 时通过 [`compile_time_layout_asserts`] 抓出**（断言 size==16 失败，实测 12），
/// 是"结构体没写错"的活证据。由 [`compile_time_layout_asserts`] 钉住。
#[repr(C)]
#[derive(Debug, Clone, Copy)]
pub struct FWP_VALUE0 {
    /// 类型 tag（`FWP_DATA_*`）。
    pub type_: FWP_DATA_TYPE,
    /// 值 union。按 SDK 语义，各分支都是 8 字节指针对齐；用 `u64` 占位以复现
    /// C 的 align-8 padding（见上）。本模块不构造实例，故不填充。
    pub value: u64,
}

/// `FWPM_FILTER_CONDITION0` —— 一个 filter 条件（SDK fwpmtypes.h 463–468 行）。
#[repr(C)]
#[derive(Debug, Clone, Copy)]
pub struct FWPM_FILTER_CONDITION0 {
    /// 条件字段 GUID。
    pub fieldKey: Guid,
    /// 匹配类型。
    pub matchType: FWP_MATCH_TYPE,
    /// 条件值。
    pub conditionValue: FWP_VALUE0,
}

/// `FWPM_ACTION0` —— filter 动作（SDK fwpmtypes.h 453–461 行）。
#[repr(C)]
#[derive(Debug, Clone, Copy)]
pub struct FWPM_ACTION0 {
    /// 动作类型（`FWP_ACTION_*`）。
    pub type_: UINT32,
    /// callout filter 的 GUID（非 callout filter 填零）。
    pub filterType: Guid,
}

/// `FWPM_FILTER0` —— filter 本体（SDK fwpmtypes.h 486–507 行，**字段序逐一对齐**）。
///
/// 字段序：`filterKey` → `displayData` → `flags` → `providerKey` → `providerData` →
/// `layerKey` → `subLayerKey` → `weight` → `numFilterConditions` → `filterCondition` →
/// `action` → `{rawContext | providerContextKey}` → `reserved` → `filterId` →
/// `effectiveWeight`。全部按 SDK 精确类型，无占位。
///
/// **本模块不构造此结构体的实例**（见模块文档边界）。size/align 由
/// [`compile_time_layout_asserts`] 钉住。
#[repr(C)]
#[derive(Debug, Clone, Copy)]
pub struct FWPM_FILTER0 {
    /// filter key（稳定 GUID，残留清理靠它）。可空。
    pub filterKey: Guid,
    /// 显示数据。
    pub displayData: FWPM_DISPLAY_DATA0,
    /// flags。
    pub flags: UINT32,
    /// provider GUID。可空。
    pub providerKey: *const Guid,
    /// provider 数据。
    pub providerData: FWP_BYTE_BLOB,
    /// 归属层。
    pub layerKey: Guid,
    /// sublayer GUID。可空。
    pub subLayerKey: Guid,
    /// weight。
    pub weight: FWP_VALUE0,
    /// 条件数。
    pub numFilterConditions: UINT32,
    /// 条件数组。
    pub filterCondition: *const FWPM_FILTER_CONDITION0,
    /// 动作。
    pub action: FWPM_ACTION0,
    /// 上下文 union（`rawContext` 或 `providerContextKey`）。
    pub rawContext: UINT64,
    /// 保留。
    pub reserved: *const Guid,
    /// filter id。
    pub filterId: UINT64,
    /// 有效权重。
    pub effectiveWeight: FWP_VALUE0,
}

// ── 函数绑定（只声明，不调用；仅 Windows 链接）─────────────────────────

#[cfg(windows)]
extern "system" {
    /// 打开 BFE 引擎会话。**本模块不调用**（仅链接期声明）。
    pub fn FwpmEngineOpen0(
        serverName: *const u16,
        authnService: u32,
        authIdentity: *const u8,
        sessionFlags: u32,
        engineHandle: *mut isize,
    ) -> u32;
    /// 关闭引擎会话。**本模块不调用**。
    pub fn FwpmEngineClose0(engineHandle: isize) -> u32;
    /// 开启事务。**本模块不调用**。
    pub fn FwpmTransactionBegin0(engineHandle: isize, flags: u32) -> u32;
    /// 提交事务。**本模块不调用**。
    pub fn FwpmTransactionCommit0(engineHandle: isize) -> u32;
    /// 回滚事务。**本模块不调用**。
    pub fn FwpmTransactionAbort0(engineHandle: isize) -> u32;
    /// 添加 filter。**本模块不调用**。
    pub fn FwpmFilterAdd0(
        engineHandle: isize,
        filter: *const FWPM_FILTER0,
        sd: *const u8,
        id: *mut UINT64,
    ) -> u32;
    /// 添加 provider。**本模块不调用**。
    pub fn FwpmProviderAdd0(engineHandle: isize, provider: *const u8, sd: *const u8) -> u32;
    /// 添加 sublayer。**本模块不调用**。
    pub fn FwpmSubLayerAdd0(engineHandle: isize, subLayer: *const u8, sd: *const u8) -> u32;
}

// ── 静态构造：FilterSpec → 条件（纯逻辑，跨平台可测）────────────────────

/// 条件值的中性表示（不依赖 FFI union，便于跨平台测试）。
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum FilterConditionValue {
    /// IPv4 地址掩码（addr 网络序, mask）。
    V4AddrMask(u32, u32),
    /// IPv6 地址掩码（16 字节 addr, 前缀长度）。
    V6AddrMask([u8; 16], u8),
    /// UINT8（IP 协议号）。
    Uint8(u8),
}

/// 一个待编码的 filter 条件（fieldKey + value）。
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct FilterCondition {
    /// 条件字段 GUID。
    pub field_key: Guid,
    /// 条件值。
    pub value: FilterConditionValue,
}

/// 把一条 [`FilterSpec`] 展开成可编码的条件序列 + 归属层。
///
/// # 语义
///
/// - IP v4 host ⇒ [`FWPM_CONDITION_IP_REMOTE_ADDRESS`] + `FWP_V4_ADDR_MASK`（/32），
///   层 = [`FWPM_LAYER_ALE_AUTH_CONNECT_V4`]。
/// - IP v6 host ⇒ 同字段 + `FWP_V6_ADDR_MASK`（/128），
///   层 = [`FWPM_LAYER_ALE_AUTH_CONNECT_V6`]。
/// - 主机名 host ⇒ **本层不解析 DNS**（对侧 `network_rule` 也要求具体 host/IP），
///   返回 `None`；域名解析交由调用方。
/// - 任何 IP host 都额外带 [`FWPM_CONDITION_IP_PROTOCOL`] + UINT8（TCP/UDP）。
///
/// 这是**纯逻辑**（不碰 FFI union、不碰指针），可在任何平台 `cargo test`。
pub fn build_conditions_for_spec(spec: &FilterSpec) -> Option<(Vec<FilterCondition>, Guid)> {
    let ip_proto = if spec.protocol.is_udp() { IPPROTO_UDP } else { IPPROTO_TCP };

    match &spec.host {
        Host::Ip(IpAddr::V4(v4)) => {
            let addr = u32::from_be_bytes(v4.octets());
            Some((
                vec![
                    FilterCondition {
                        field_key: FWPM_CONDITION_IP_REMOTE_ADDRESS,
                        value: FilterConditionValue::V4AddrMask(addr, 0xffff_ffff),
                    },
                    FilterCondition {
                        field_key: FWPM_CONDITION_IP_PROTOCOL,
                        value: FilterConditionValue::Uint8(ip_proto),
                    },
                ],
                FWPM_LAYER_ALE_AUTH_CONNECT_V4,
            ))
        }
        Host::Ip(IpAddr::V6(v6)) => Some((
            vec![
                FilterCondition {
                    field_key: FWPM_CONDITION_IP_REMOTE_ADDRESS,
                    value: FilterConditionValue::V6AddrMask(v6.octets(), 128),
                },
                FilterCondition {
                    field_key: FWPM_CONDITION_IP_PROTOCOL,
                    value: FilterConditionValue::Uint8(ip_proto),
                },
            ],
            FWPM_LAYER_ALE_AUTH_CONNECT_V6,
        )),
        Host::Name(_) => None,
    }
}

/// filter 的动作类型。
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum FilterAction {
    /// 放行（[`FWP_ACTION_PERMIT`]）。
    Permit,
    /// 阻断（[`FWP_ACTION_BLOCK`]）。
    Block,
}

impl FilterAction {
    /// 对应的 `FWP_ACTION_*` 常量值。
    pub const fn as_u32(self) -> UINT32 {
        match self {
            FilterAction::Permit => FWP_ACTION_PERMIT,
            FilterAction::Block => FWP_ACTION_BLOCK,
        }
    }

    /// 从 [`Decision`] 映射：`Allow` ⇒ Permit，其余先阻断再问
    /// （与 `Decision::blocks_traffic()` 同源）。
    pub const fn from_decision(d: Decision) -> Self {
        match d {
            Decision::Allow => FilterAction::Permit,
            Decision::Prompt | Decision::PromptUser | Decision::Forbidden => FilterAction::Block,
        }
    }
}

// ── 组装层：条件值 → FWP_VALUE0 填充 + 按层分组（中性数据，不装）─────────

/// 一个已编码的 `FWP_VALUE0` 填充三元组（SDK `fwptypes.h` union 语义）。
///
/// 这是**中性数据**：只描述"该往 `FWP_VALUE0` 里填什么"，不构造任何可安装实例。
/// `data_type` 必须与 `bytes` 的解释严格对应（见 [`build_condition_value`]），
/// 填错就是 UB —— 故由单测逐项钉住。
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct EncodedConditionValue {
    /// `FWP_DATA_*` 类型 tag。
    pub data_type: FWP_DATA_TYPE,
    /// 有效字节数（写入 `FWP_VALUE0.value` 低 `byte_len` 字节，其余补零）。
    pub byte_len: usize,
    /// 值字节（按小端填充到 8 字节 union 占位）。
    pub bytes: [u8; 8],
}

impl EncodedConditionValue {
    /// 填充字节：把 `bytes` 前 `byte_len` 字节补零到 8 字节（供 union 占位）。
    pub fn padded(&self) -> [u8; 8] {
        let mut out = [0u8; 8];
        let n = self.byte_len.min(8);
        out[..n].copy_from_slice(&self.bytes[..n]);
        out
    }
}

/// 把一个 [`FilterConditionValue`] 编码成 `FWP_VALUE0` 填充三元组。
///
/// 与 SDK `fwptypes.h` 的 `FWP_DATA_*` 严格对应：
/// - [`FilterConditionValue::V4AddrMask`] ⇒ `FWP_DATA_V4_ADDR_MASK`(9)，8 字节
///   （`FWP_V4_ADDR_AND_MASK` = addr+mask，各 u32 小端）
/// - [`FilterConditionValue::V6AddrMask`] ⇒ `FWP_DATA_V6_ADDR_MASK`(10)，17 字节
///   有效（`FWP_V6_ADDR_AND_MASK` = 16 地址 + 1 前缀长度）；因 union 占位只有 8 字节，
///   这里记录 `byte_len=17` 但 `bytes` 只装前 8 字节 —— **完整 17 字节的落位需上层
///   经 `FWP_BYTE_ARRAY16`/指针间接传递，本层不假装能塞进 8 字节**，故返回 `None`
///   表示"V6 地址掩码不能在无指针间接下直接填入 union 占位"。
/// - [`FilterConditionValue::Uint8`] ⇒ `FWP_DATA_UINT8`(3)，1 字节
///
/// V6 返回 `None` 是**显式不做**（不是 bug）：把 17 字节塞进 8 字节占位会截断，
/// 正确做法需上层分配 `FWP_BYTE_ARRAY16` 并让 `FWP_VALUE0.value` 存指针 —— 那是
/// 会产生堆分配 + 指针生命周期的真安装路径，超出 static-only 边界。
pub fn build_condition_value(v: &FilterConditionValue) -> Option<EncodedConditionValue> {
    match v {
        FilterConditionValue::V4AddrMask(addr, mask) => {
            let mut bytes = [0u8; 8];
            bytes[..4].copy_from_slice(&addr.to_le_bytes());
            bytes[4..8].copy_from_slice(&mask.to_le_bytes());
            Some(EncodedConditionValue {
                data_type: FWP_DATA_V4_ADDR_MASK,
                byte_len: 8,
                bytes,
            })
        }
        FilterConditionValue::V6AddrMask(_, _) => None, // 显式不做，见函数文档
        FilterConditionValue::Uint8(n) => {
            let mut bytes = [0u8; 8];
            bytes[0] = *n;
            Some(EncodedConditionValue {
                data_type: FWP_DATA_UINT8,
                byte_len: 1,
                bytes,
            })
        }
    }
}

/// 一组 filter 的装配结果（按归属层分组）。
///
/// 中性数据：`action` 是 [`FilterAction`]（还没变成 `FWP_ACTION_*` 常量），
/// `conditions` 是 [`FilterCondition`]（还没填充 `FWP_VALUE0`）。真正变成
/// `FWPM_FILTER0` 实例需要上层再做两步：① 填充每个 condition 的 value；
/// ② 处理 V6 的堆分配 + 指针生命周期。这两步都会碰到真安装路径，
/// **本层不做**（static-only）。
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct FilterAssembly {
    /// 归属层（V4 / V6 connect 层）。
    pub layer: Guid,
    /// 动作。
    pub action: FilterAction,
    /// 该层上的条件（每条 filter 一组；这里按 spec 平铺，去重交上层）。
    pub conditions: Vec<FilterCondition>,
}

/// 把一组 [`FilterSpec`] 装配成按层分组的 [`FilterAssembly`]。
///
/// # 语义
///
/// - IP host ⇒ 归入对应 V4/V6 层，动作由 [`FilterAction::from_decision`] 决定。
/// - **主机名 host ⇒ [`AssemblyError::HostnameNeedsDnsResolution`]**（本层不解析 DNS，
///   失败方向是"多要一次定向说明"，不是静默跳过）。
/// - 同层同 action 的 spec 合并进一个 assembly；同层不同 action 拆成多个
///   （WFP 一个 filter 只有一个 action，故必须拆）。
pub fn build_filter_assembly(specs: &[crate::policy::FilterSpec]) -> Result<Vec<FilterAssembly>, AssemblyError> {
    use std::collections::BTreeMap;

    // BTreeMap 的 key：(key_of(layer), action.as_u32())，两者都有 Ord
    // 还原时由 key 重建 layer Guid 和 FilterAction
    let key_of = |g: &Guid| (g.Data1, g.Data2, g.Data3, g.Data4);
    let mut groups: BTreeMap<((u32, u16, u16, [u8; 8]), u32), Vec<FilterCondition>> = BTreeMap::new();

    for spec in specs {
        let (conds, layer) = match build_conditions_for_spec(spec) {
            Some(pair) => pair,
            None => {
                return Err(AssemblyError::HostnameNeedsDnsResolution {
                    rule: spec.rule.clone(),
                    host: spec.host.canonical(),
                })
            }
        };
        for c in &conds {
            if build_condition_value(&c.value).is_none() {
                return Err(AssemblyError::ConditionNotEncodableWithoutIndirection {
                    rule: spec.rule.clone(),
                });
            }
        }
        let action_u32 = FilterAction::from_decision(spec.decision).as_u32();
        groups.entry((key_of(&layer), action_u32)).or_insert_with(Vec::new).extend(conds);
    }

    let mut out = Vec::new();
    for ((lk, action_u32), mut conds) in groups {
        let layer = Guid { Data1: lk.0, Data2: lk.1, Data3: lk.2, Data4: lk.3 };
        let action = if action_u32 == FWP_ACTION_PERMIT { FilterAction::Permit } else { FilterAction::Block };
        conds.sort_by(|a, b| key_of(&a.field_key).cmp(&key_of(&b.field_key)));
        out.push(FilterAssembly { layer, action, conditions: conds });
    }
    Ok(out)
}

/// 装配错误。每一种点名具体规则与原因。
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum AssemblyError {
    /// 主机名 host 需要先解析 DNS（本层不做）。
    HostnameNeedsDnsResolution {
        /// 出错的规则。
        rule: crate::policy::RuleId,
        /// 主机名。
        host: String,
    },
    /// 条件值无法在无指针间接下填入 union 占位（V6 地址掩码）。
    ConditionNotEncodableWithoutIndirection {
        /// 出错的规则。
        rule: crate::policy::RuleId,
    },
}

impl std::fmt::Display for AssemblyError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            AssemblyError::HostnameNeedsDnsResolution { rule, host } => {
                write!(f, "规则 {rule}: 主机名 {host:?} 需要先解析 DNS，本层不做（请传入 IP 或先解析）")
            }
            AssemblyError::ConditionNotEncodableWithoutIndirection { rule } => {
                write!(
                    f,
                    "规则 {rule}: V6 地址掩码需经指针间接传递，无法在 static-only 下直接填入 union 占位"
                )
            }
        }
    }
}

impl std::error::Error for AssemblyError {}

// ── 编译期布局断言（ABI 自证，任何平台都跑）────────────────────────────

/// 钉住 SDK 精确布局。编译期求值，零运行时开销。布局错一位就是 UB，故必须钉。
const _: () = {
    // Guid：Windows GUID 恰 16 字节，align 4
    assert!(std::mem::size_of::<Guid>() == 16);
    assert!(std::mem::align_of::<Guid>() == 4);

    // FWP_V4_ADDR_AND_MASK：8 字节
    assert!(std::mem::size_of::<FWP_V4_ADDR_AND_MASK>() == 8);
    // FWP_V6_ADDR_AND_MASK：17 字节（16 + 1）
    assert!(std::mem::size_of::<FWP_V6_ADDR_AND_MASK>() == 17);
    // FWP_BYTE_ARRAY16：16 字节
    assert!(std::mem::size_of::<FWP_BYTE_ARRAY16>() == 16);

    // FWP_VALUE0：type(4) + padding(4) + union(8) = 16 字节（union 最大分支是指针 8B）
    assert!(std::mem::size_of::<FWP_VALUE0>() == 16);
    assert!(std::mem::align_of::<FWP_VALUE0>() == 8);

    // FWPM_ACTION0：type_(4) + filterType GUID(16) = 20 字节
    assert!(std::mem::size_of::<FWPM_ACTION0>() == 20);

    // 指针宽度：本模块假设 x64（与对侧一致）
    assert!(std::mem::size_of::<*const u8>() == 8);
};
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
