// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

//! B2-07 常驻原生模块统一 ABI 加载面。
//!
//! 对照 WorkBuddy 的 `BP_GetInterface / BP_Initialize / BP_Shutdown` 三出口：
//! 动态库不把内部结构直接暴露给调用方，先按名字+版本取接口，再显式初始化/关闭。
//!
//! 本仓契约（v1）：
//!   - `BP_GetInterface(name: *const c_char, abi: u32) -> *mut BpInterfaceV1`
//!   - `BP_Initialize(*mut BpInterfaceV1) -> i32`（0 = 成功）
//!   - `BP_Shutdown(*mut BpInterfaceV1)`
//!   - 接口头 `magic == 'IHUI'`、`abi_version == 1`、`header_size >= size_of::<Header>()`；
//!     任一不符即拒，不把未知布局当 v1 用。
//!
//! 非 Windows 显式 `Unsupported`；不退回 `dlopen` 猜测。

use std::ffi::{c_char, c_void, CString};
use std::fmt;
use std::path::{Path, PathBuf};

const ABI_MAGIC: u32 = u32::from_le_bytes(*b"IHUI");
const ABI_VERSION: u32 = 1;
const INTERFACE_NAME: &str = "ihui.bp";

#[repr(C)]
#[derive(Debug, Clone, Copy)]
pub struct BpInterfaceHeader {
    pub magic: u32,
    pub abi_version: u32,
    pub header_size: u32,
    pub reserved: u32,
}

pub type BpGetInterface = unsafe extern "system" fn(*const c_char, u32) -> *mut c_void;
pub type BpInitialize = unsafe extern "system" fn(*mut c_void) -> i32;
pub type BpShutdown = unsafe extern "system" fn(*mut c_void);

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum NativeModuleError {
    InvalidPath(String),
    LoadFailed(String),
    MissingExport(&'static str),
    AbiMismatch(String),
    InitFailed(i32),
    Unsupported(&'static str),
}

impl fmt::Display for NativeModuleError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            NativeModuleError::InvalidPath(s) => write!(f, "invalid native module path: {s}"),
            NativeModuleError::LoadFailed(s) => write!(f, "load failed: {s}"),
            NativeModuleError::MissingExport(s) => write!(f, "missing export: {s}"),
            NativeModuleError::AbiMismatch(s) => write!(f, "abi mismatch: {s}"),
            NativeModuleError::InitFailed(code) => write!(f, "BP_Initialize returned {code}"),
            NativeModuleError::Unsupported(s) => write!(f, "unsupported: {s}"),
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct NativeModuleReport {
    pub ok: bool,
    pub path: String,
    pub abi_version: u32,
    pub reason: String,
}

/// 路径闸：绝对路径、`.dll` 后缀（Windows）、确实存在。
pub fn validate_module_path(raw: &str) -> Result<PathBuf, NativeModuleError> {
    if raw.trim().is_empty() || raw.contains('\0') {
        return Err(NativeModuleError::InvalidPath(raw.to_string()));
    }
    let path = Path::new(raw);
    if !path.is_absolute() {
        return Err(NativeModuleError::InvalidPath(raw.to_string()));
    }
    if cfg!(windows) && !raw.to_ascii_lowercase().ends_with(".dll") {
        return Err(NativeModuleError::InvalidPath(raw.to_string()));
    }
    if !path.exists() {
        return Err(NativeModuleError::InvalidPath(raw.to_string()));
    }
    Ok(path.to_path_buf())
}

/// 头校验：magic / abi / header_size 三样同时成立。
pub fn validate_interface_header(header: &BpInterfaceHeader) -> Result<(), NativeModuleError> {
    if header.magic != ABI_MAGIC {
        return Err(NativeModuleError::AbiMismatch(format!(
            "magic {:#x} != {:#x}",
            header.magic, ABI_MAGIC
        )));
    }
    if header.abi_version != ABI_VERSION {
        return Err(NativeModuleError::AbiMismatch(format!(
            "abi {} != {}",
            header.abi_version, ABI_VERSION
        )));
    }
    if header.header_size < std::mem::size_of::<BpInterfaceHeader>() as u32 {
        return Err(NativeModuleError::AbiMismatch(format!(
            "header_size {} < {}",
            header.header_size,
            std::mem::size_of::<BpInterfaceHeader>()
        )));
    }
    Ok(())
}

#[cfg(windows)]
mod win {
    use std::ffi::c_void;

    pub type Handle = *mut c_void;
    pub type Proc = *mut c_void;

    #[link(name = "kernel32")]
    extern "system" {
        pub fn LoadLibraryW(name: *const u16) -> Handle;
        pub fn GetProcAddress(module: Handle, name: *const u8) -> Proc;
        pub fn FreeLibrary(module: Handle) -> i32;
    }
}

#[cfg(windows)]
pub struct NativeModule {
    handle: win::Handle,
    interface: *mut c_void,
    initialize: BpInitialize,
    shutdown: BpShutdown,
}

#[cfg(windows)]
impl Drop for NativeModule {
    fn drop(&mut self) {
        unsafe {
            (self.shutdown)(self.interface);
            win::FreeLibrary(self.handle);
        }
    }
}

#[cfg(windows)]
fn wide(value: &str) -> Vec<u16> {
    value.encode_utf16().chain(std::iter::once(0)).collect()
}

#[cfg(windows)]
unsafe fn symbol(handle: win::Handle, name: &str) -> Result<win::Proc, NativeModuleError> {
    let cname = CString::new(name).map_err(|_| NativeModuleError::MissingExport(name))?;
    let proc = win::GetProcAddress(handle, cname.as_ptr() as *const u8);
    if proc.is_null() {
        return Err(NativeModuleError::MissingExport(name));
    }
    Ok(proc)
}

#[cfg(windows)]
pub fn load_native_module(raw_path: &str) -> Result<NativeModule, NativeModuleError> {
    let path = validate_module_path(raw_path)?;
    let wide_path = wide(&path.to_string_lossy());
    unsafe {
        let handle = win::LoadLibraryW(wide_path.as_ptr());
        if handle.is_null() {
            return Err(NativeModuleError::LoadFailed(raw_path.to_string()));
        }

        let get_interface: BpGetInterface =
            std::mem::transmute(symbol(handle, "BP_GetInterface")?);
        let initialize: BpInitialize = std::mem::transmute(symbol(handle, "BP_Initialize")?);
        let shutdown: BpShutdown = std::mem::transmute(symbol(handle, "BP_Shutdown")?);

        let name = CString::new(INTERFACE_NAME).map_err(|_| {
            NativeModuleError::MissingExport("BP_GetInterface")
        })?;
        let interface = get_interface(name.as_ptr(), ABI_VERSION);
        if interface.is_null() {
            win::FreeLibrary(handle);
            return Err(NativeModuleError::AbiMismatch(
                "BP_GetInterface returned null".into(),
            ));
        }
        let header = &*(interface as *const BpInterfaceHeader);
        if let Err(err) = validate_interface_header(header) {
            win::FreeLibrary(handle);
            return Err(err);
        }
        let code = initialize(interface);
        if code != 0 {
            shutdown(interface);
            win::FreeLibrary(handle);
            return Err(NativeModuleError::InitFailed(code));
        }
        Ok(NativeModule {
            handle,
            interface,
            initialize,
            shutdown,
        })
    }
}

#[cfg(not(windows))]
pub struct NativeModule;

#[cfg(not(windows))]
pub fn load_native_module(_raw_path: &str) -> Result<NativeModule, NativeModuleError> {
    Err(NativeModuleError::Unsupported(
        "BP_* native module loading is Windows-only",
    ))
}

/// 探测一次：加载 → 初始化 → 立即关闭；失败返回具名原因，不假成功。
pub fn probe_native_module(raw_path: &str) -> NativeModuleReport {
    match load_native_module(raw_path) {
        Ok(module) => {
            drop(module);
            NativeModuleReport {
                ok: true,
                path: raw_path.to_string(),
                abi_version: ABI_VERSION,
                reason: "loaded-initialized-shutdown".into(),
            }
        }
        Err(err) => NativeModuleReport {
            ok: false,
            path: raw_path.to_string(),
            abi_version: ABI_VERSION,
            reason: err.to_string(),
        },
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn valid_header_passes() {
        let header = BpInterfaceHeader {
            magic: ABI_MAGIC,
            abi_version: ABI_VERSION,
            header_size: std::mem::size_of::<BpInterfaceHeader>() as u32,
            reserved: 0,
        };
        assert!(validate_interface_header(&header).is_ok());
    }

    #[test]
    fn wrong_magic_or_version_is_rejected() {
        let mut header = BpInterfaceHeader {
            magic: 0,
            abi_version: ABI_VERSION,
            header_size: std::mem::size_of::<BpInterfaceHeader>() as u32,
            reserved: 0,
        };
        assert!(validate_interface_header(&header).is_err());
        header.magic = ABI_MAGIC;
        header.abi_version = ABI_VERSION + 1;
        assert!(validate_interface_header(&header).is_err());
    }

    #[test]
    fn short_header_is_rejected() {
        let header = BpInterfaceHeader {
            magic: ABI_MAGIC,
            abi_version: ABI_VERSION,
            header_size: 8,
            reserved: 0,
        };
        assert!(validate_interface_header(&header).is_err());
    }

    #[test]
    fn relative_or_missing_path_is_rejected() {
        assert!(validate_module_path("ihui.dll").is_err());
        assert!(validate_module_path(r"C:\definitely-not-here\ihui.dll").is_err());
    }

    #[test]
    fn probe_missing_module_reports_reason() {
        let report = probe_native_module(r"C:\definitely-not-here\ihui.dll");
        assert!(!report.ok);
        assert!(report.reason.contains("invalid native module path"));
    }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
