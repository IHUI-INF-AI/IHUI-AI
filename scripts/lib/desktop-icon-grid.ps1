# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

#requires -Version 7
# Desktop icon grid reader: emits ONE json line, ASCII only, never throws.
# Everything it cannot measure comes back as null so the judging layer can say "undetermined"
# instead of guessing (repo rule: "not judged" must never be written as "judged").
$ErrorActionPreference = 'SilentlyContinue'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$out = [ordered]@{
  state        = 'undetermined'
  iconSize     = $null
  bagWrittenAt = $null
  pitchDy      = $null
  items        = $null
  explorerPid  = $null
  openFolderWindows = $null
  cxScreen     = $null
  cyScreen     = $null
  dpi          = $null
  topologyStamps = @()
  missing      = @()
}

$src = @'
using System;
using System.Text;
using System.Collections.Generic;
using System.Runtime.InteropServices;
using Microsoft.Win32;
using Microsoft.Win32.SafeHandles;

public static class GridReader {
  [DllImport("advapi32.dll", CharSet=CharSet.Unicode)]
  static extern int RegQueryInfoKey(SafeRegistryHandle k, IntPtr a, IntPtr b, IntPtr c, IntPtr d,
    IntPtr e, IntPtr f, IntPtr g, IntPtr h, IntPtr i, IntPtr j, out long ft);

  [DllImport("user32.dll", CharSet=CharSet.Unicode)] static extern IntPtr FindWindow(string a, string b);
  [DllImport("user32.dll", CharSet=CharSet.Unicode)] static extern IntPtr FindWindowEx(IntPtr p, IntPtr c, string cl, string w);
  delegate bool EnumProc(IntPtr h, IntPtr l);
  [DllImport("user32.dll")] static extern bool EnumWindows(EnumProc cb, IntPtr l);
  [DllImport("user32.dll", CharSet=CharSet.Unicode)] static extern int GetClassName(IntPtr h, StringBuilder s, int max);
  [DllImport("user32.dll")] static extern IntPtr SendMessage(IntPtr h, uint m, IntPtr w, IntPtr l);
  [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr h, out int pid);
  [DllImport("user32.dll")] static extern int GetSystemMetrics(int i);
  [DllImport("shcore.dll")] static extern int GetDpiForMonitor(IntPtr m, int t, out uint x, out uint y);
  [DllImport("user32.dll")] static extern IntPtr MonitorFromWindow(IntPtr h, int flag);
  [DllImport("user32.dll")] static extern IntPtr GetDesktopWindow();
  [DllImport("kernel32.dll")] static extern IntPtr OpenProcess(int a, bool i, int pid);
  [DllImport("kernel32.dll")] static extern IntPtr VirtualAllocEx(IntPtr p, IntPtr a, UIntPtr s, int t, int pr);
  [DllImport("kernel32.dll")] static extern bool VirtualFreeEx(IntPtr p, IntPtr a, UIntPtr s, int t);
  [DllImport("kernel32.dll")] static extern bool ReadProcessMemory(IntPtr p, IntPtr a, byte[] b, IntPtr s, out IntPtr rd);

  const uint LVM_GETITEMCOUNT = 0x1004;
  const uint LVM_GETITEMPOSITION = 0x1010;

  static IntPtr DefView() {
    IntPtr root = FindWindow("Progman", "Program Manager");
    IntPtr v = FindWindowEx(root, IntPtr.Zero, "SHELLDLL_DefView", null);
    if (v != IntPtr.Zero) return v;
    IntPtr found = IntPtr.Zero;
    EnumWindows((h, l) => {
      StringBuilder sb = new StringBuilder(256); GetClassName(h, sb, sb.Capacity);
      if (sb.ToString() == "WorkerW") {
        IntPtr c = FindWindowEx(h, IntPtr.Zero, "SHELLDLL_DefView", null);
        if (c != IntPtr.Zero) { found = c; return false; }
      }
      return true;
    }, IntPtr.Zero);
    return found;
  }

  public static string KeyLastWrite(RegistryKey key) {
    long ft;
    int rc = RegQueryInfoKey(key.Handle, IntPtr.Zero, IntPtr.Zero, IntPtr.Zero, IntPtr.Zero,
      IntPtr.Zero, IntPtr.Zero, IntPtr.Zero, IntPtr.Zero, IntPtr.Zero, IntPtr.Zero, out ft);
    if (rc != 0) return null;
    try { return DateTime.FromFileTime(ft).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ"); } catch { return null; }
  }

  public static string SubKeyStamps(string path, int limit) {
    List<string> list = new List<string>();
    using (RegistryKey root = Registry.LocalMachine.OpenSubKey(path)) {
      if (root == null) return "NULL";
      string[] names = root.GetSubKeyNames();
      for (int i = 0; i < names.Length && list.Count < limit; i++) {
        using (RegistryKey sk = root.OpenSubKey(names[i])) {
          if (sk == null) continue;
          string t = KeyLastWrite(sk);
          if (t != null) list.Add(t);
        }
      }
    }
    return string.Join(",", list.ToArray());
  }

  public static int[] Grid() {
    // [0]=items [1]=pitchDy (-1 unknown) [2]=explorerPid
    int[] r = new int[] { -1, -1, -1 };
    IntPtr dv = DefView();
    if (dv == IntPtr.Zero) return r;
    IntPtr lv = FindWindowEx(dv, IntPtr.Zero, "SysListView32", null);
    if (lv == IntPtr.Zero) return r;
    int pid = 0; GetWindowThreadProcessId(lv, out pid);
    r[2] = pid;
    IntPtr proc = OpenProcess(0x0008 | 0x0010 | 0x0020 | 0x0030, false, pid);
    if (proc == IntPtr.Zero) return r;
    IntPtr mem = VirtualAllocEx(proc, IntPtr.Zero, (UIntPtr)16, 0x3000, 0x04);
    if (mem == IntPtr.Zero) return r;
    try {
      int n = (int)SendMessage(lv, LVM_GETITEMCOUNT, IntPtr.Zero, IntPtr.Zero);
      r[0] = n;
      byte[] buf = new byte[8]; IntPtr rd;
      int prev = int.MinValue, best = -1;
      for (int i = 0; i < n; i++) {
        SendMessage(lv, LVM_GETITEMPOSITION, (IntPtr)i, mem);
        if (!ReadProcessMemory(proc, mem, buf, (IntPtr)8, out rd)) continue;
        int y = BitConverter.ToInt32(buf, 4);
        if (prev != int.MinValue) {
          int d = y - prev;
          if (d > 0 && (best < 0 || d < best)) best = d;
        }
        prev = y;
      }
      r[1] = best;
      return r;
    } finally { VirtualFreeEx(proc, mem, UIntPtr.Zero, 0x8000); }
  }

  public static int OpenFolderWindows() {
    // CabinetWClass = an Explorer folder window someone is reading. Restarting the shell would
    // close it, so the repair path must know the count before it is allowed to touch anything.
    int[] n = new int[] { 0 };
    EnumWindows((h, l) => {
      StringBuilder sb = new StringBuilder(256); GetClassName(h, sb, sb.Capacity);
      if (sb.ToString() == "CabinetWClass") n[0]++;
      return true;
    }, IntPtr.Zero);
    return n[0];
  }

  public static int[] Screen() {
    // [0]=cx [1]=cy [2]=dpi(-1 unjudged)
    int[] r = new int[] { GetSystemMetrics(0), GetSystemMetrics(1), -1 };
    IntPtr m = MonitorFromWindow(GetDesktopWindow(), 0);
    if (m != IntPtr.Zero) {
      uint dx, dy;
      if (GetDpiForMonitor(m, 0, out dx, out dy) == 0) r[2] = (int)dx;
    }
    return r;
  }
}
'@
try { Add-Type -TypeDefinition $src -Language CSharp } catch { $out.missing += 'add-type'; $out | ConvertTo-Json -Compress; exit 2 }

$bagPath = 'Software\Microsoft\Windows\Shell\Bags\1\Desktop'
$topoPath = 'SYSTEM\CurrentControlSet\Control\GraphicsDrivers\Configuration'

$bag = $null
try {
  $bag = [Microsoft.Win32.Registry]::CurrentUser.OpenSubKey($bagPath, $false)
  if ($bag) {
    $out.iconSize = $bag.GetValue('IconSize')
    $out.bagWrittenAt = [GridReader]::KeyLastWrite($bag)
    $out.topologyStamps = @(([GridReader]::SubKeyStamps($topoPath, 40) -split ',') | Where-Object { $_ } | ForEach-Object { Get-Date $_ })
    $out.state = 'ok'
  } else { $out.missing += 'bag-key' }
} catch { $out.missing += 'bag-read' } finally { if ($bag) { $bag.Close() } }

$g = [GridReader]::Grid()
$out.items = $g[0]; $out.pitchDy = $g[1]; $out.explorerPid = $g[2]
$out.openFolderWindows = [GridReader]::OpenFolderWindows()
$s = [GridReader]::Screen()
$out.cxScreen = $s[0]; $out.cyScreen = $s[1]; $out.dpi = $s[2]

if ($null -eq $out.iconSize -or $out.topologyStamps.Count -eq 0) { $out.state = 'undetermined' }
$out.missing = $out.missing -join ';'
ConvertTo-Json -InputObject $out -Compress
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
