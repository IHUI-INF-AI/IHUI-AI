// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 隧道腿健康尺的三组离线样本(2026-11-03 立案,回归用,不联网)。
 * 形状照本机真实读数抄写:metrics 片段取 `http://127.0.0.1:20241/metrics`(cloudflared 自带端点),
 * netstat 行取 `netstat -ano` 里本 pid 的真实列。只钉"怎么读",不伪造任何阈值。
 *
 * - QUIC_HEALTHY:2026-11-03 00:34(+08)实况 —— 服务 ImagePath 带 `--protocol quic`,QUIC 走 UDP,
 *   TCP 7843/7844 上 **0 条 ESTABLISHED**,4 个 UDP 端口,metrics gauge 同样是 4。
 *   这就是那封假红的现场:旧判据只数 TCP ⇒ 判"腿数 0 ⇒ 隧道断了"。
 * - HTTP2_HEALTHY:旧协议常态 —— 4 条 TCP 腿、没有 `quic_client_*` 指标族、gauge 同为 4。
 * - QUIC_DROPPED:真掉腿 —— 只剩 1 条 QUIC 连接(1 个 UDP 端口),TCP 仍为 0,gauge 掉到 1。
 *   这组专门证明修假红没修成假绿。
 */

const CLOUDFLARED_PID = '45956'

export const QUIC_HEALTHY = {
  metrics: [
    '# HELP cloudflared_tunnel_ha_connections Number of active ha connections',
    '# TYPE cloudflared_tunnel_ha_connections gauge',
    'cloudflared_tunnel_ha_connections 4',
    '# HELP cloudflared_tunnel_server_locations Where the instance is connected',
    '# TYPE cloudflared_tunnel_server_locations gauge',
    'cloudflared_tunnel_server_locations{connection_id="0",edge_location="lax08"} 1',
    'cloudflared_tunnel_server_locations{connection_id="1",edge_location="lax13"} 1',
    'cloudflared_tunnel_server_locations{connection_id="2",edge_location="lax09"} 1',
    'cloudflared_tunnel_server_locations{connection_id="3",edge_location="lax13"} 1',
    'quic_client_smoothed_rtt{conn_index="0"} 61.2',
    'quic_client_smoothed_rtt{conn_index="1"} 63.4',
    'quic_client_smoothed_rtt{conn_index="2"} 58.9',
    'quic_client_smoothed_rtt{conn_index="3"} 60.1',
    'quic_client_packets_lost{conn_index="0"} 0',
  ].join('\n'),
  netstat: [
    `  TCP    127.0.0.1:20241        0.0.0.0:0              LISTENING       ${CLOUDFLARED_PID}`,
    `  TCP    127.0.0.1:49990        127.0.0.1:8801         ESTABLISHED     ${CLOUDFLARED_PID}`,
    `  UDP    0.0.0.0:49996          *:*                                     ${CLOUDFLARED_PID}`,
    `  UDP    [::]:49996             *:*                                     ${CLOUDFLARED_PID}`,
    `  UDP    0.0.0.0:50020          *:*                                     ${CLOUDFLARED_PID}`,
    `  UDP    [::]:50020             *:*                                     ${CLOUDFLARED_PID}`,
    `  UDP    0.0.0.0:50021          *:*                                     ${CLOUDFLARED_PID}`,
    `  UDP    [::]:50021             *:*                                     ${CLOUDFLARED_PID}`,
    `  UDP    0.0.0.0:62106          *:*                                     ${CLOUDFLARED_PID}`,
    `  UDP    [::]:62106             *:*                                     ${CLOUDFLARED_PID}`,
    '  UDP    0.0.0.0:53             *:*                                    1484',
  ].join('\n'),
  serviceCmdline:
    'BINARY_PATH_NAME   : "C:\\Program Files (x86)\\cloudflared\\cloudflared.exe" --loglevel info tunnel --no-autoupdate run --protocol quic --token-file C:\\ProgramData\\Cloudflared\\token.txt',
  pids: [CLOUDFLARED_PID],
}

export const HTTP2_HEALTHY = {
  metrics: [
    '# HELP cloudflared_tunnel_ha_connections Number of active ha connections',
    '# TYPE cloudflared_tunnel_ha_connections gauge',
    'cloudflared_tunnel_ha_connections 4',
    'cloudflared_tunnel_server_locations{connection_id="0",edge_location="lax08"} 1',
    'cloudflared_tunnel_server_locations{connection_id="1",edge_location="lax13"} 1',
    'cloudflared_tunnel_server_locations{connection_id="2",edge_location="lax09"} 1',
    'cloudflared_tunnel_server_locations{connection_id="3",edge_location="lax13"} 1',
  ].join('\n'),
  netstat: [
    `  TCP    127.0.0.1:20241        0.0.0.0:0              LISTENING       ${CLOUDFLARED_PID}`,
    `  TCP    [2408:8234:c16:1f44:187:718f:be39:60a3]:49167  [2606:4700:a0::6]:7844  ESTABLISHED     ${CLOUDFLARED_PID}`,
    `  TCP    [2408:8234:c16:1f44:187:718f:be39:60a3]:49175  [2606:4700:a8::10]:7844  ESTABLISHED     ${CLOUDFLARED_PID}`,
    `  TCP    [2408:8234:c16:1f44:187:718f:be39:60a3]:49177  [2606:4700:a0::1]:7843   ESTABLISHED     ${CLOUDFLARED_PID}`,
    `  TCP    [2408:8234:c16:1f44:187:718f:be39:60a3]:49178  [2606:4700:a8::9]:7844   ESTABLISHED     ${CLOUDFLARED_PID}`,
  ].join('\n'),
  serviceCmdline:
    'BINARY_PATH_NAME   : "C:\\Program Files (x86)\\cloudflared\\cloudflared.exe" --loglevel info tunnel --no-autoupdate run --protocol http2 --token-file C:\\ProgramData\\Cloudflared\\token.txt',
  pids: [CLOUDFLARED_PID],
}

export const QUIC_DROPPED = {
  metrics: [
    '# HELP cloudflared_tunnel_ha_connections Number of active ha connections',
    '# TYPE cloudflared_tunnel_ha_connections gauge',
    'cloudflared_tunnel_ha_connections 1',
    'cloudflared_tunnel_server_locations{connection_id="0",edge_location="lax08"} 1',
    'quic_client_smoothed_rtt{conn_index="0"} 61.2',
  ].join('\n'),
  netstat: [
    `  TCP    127.0.0.1:20241        0.0.0.0:0              LISTENING       ${CLOUDFLARED_PID}`,
    `  UDP    0.0.0.0:49996          *:*                                     ${CLOUDFLARED_PID}`,
    `  UDP    [::]:49996             *:*                                     ${CLOUDFLARED_PID}`,
  ].join('\n'),
  serviceCmdline:
    'BINARY_PATH_NAME   : "C:\\Program Files (x86)\\cloudflared\\cloudflared.exe" --loglevel info tunnel --no-autoupdate run --protocol quic --token-file C:\\ProgramData\\Cloudflared\\token.txt',
  pids: [CLOUDFLARED_PID],
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
