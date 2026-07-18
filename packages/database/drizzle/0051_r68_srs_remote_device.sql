-- Migration 0051: SRS 媒体服务器 + 远程设备任务管理 (M-85 + M-87)
-- 创建时间: 2026-07-11
-- 描述: 等价自旧架构 services/srs_manager.py + Java RemoteDeviceByTaskController

-- ===== SRS 直播流管理 =====
CREATE TABLE IF NOT EXISTS srs_streams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stream_key VARCHAR(128) NOT NULL UNIQUE,
  channel_id UUID,
  title VARCHAR(200) NOT NULL,
  push_url VARCHAR(500),
  play_url VARCHAR(500),
  webrtc_url VARCHAR(500),
  hls_url VARCHAR(500),
  flv_url VARCHAR(500),
  status VARCHAR(20) NOT NULL DEFAULT 'inactive',
  publisher_ip VARCHAR(45),
  client_id VARCHAR(128),
  video_codec VARCHAR(32),
  audio_codec VARCHAR(32),
  video_bitrate INTEGER,
  audio_bitrate INTEGER,
  video_width INTEGER,
  video_height INTEGER,
  video_fps INTEGER,
  start_time TIMESTAMPTZ,
  end_time TIMESTAMPTZ,
  duration INTEGER DEFAULT 0,
  recv_bytes INTEGER DEFAULT 0,
  send_bytes INTEGER DEFAULT 0,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS srs_streams_key_idx ON srs_streams(stream_key);
CREATE INDEX IF NOT EXISTS srs_streams_channel_idx ON srs_streams(channel_id);
CREATE INDEX IF NOT EXISTS srs_streams_status_idx ON srs_streams(status);

-- ===== SRS 服务器配置 =====
CREATE TABLE IF NOT EXISTS srs_servers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  host VARCHAR(255) NOT NULL,
  rtmp_port INTEGER NOT NULL DEFAULT 1935,
  http_port INTEGER NOT NULL DEFAULT 8080,
  webrtc_port INTEGER NOT NULL DEFAULT 1985,
  api_port INTEGER NOT NULL DEFAULT 1985,
  api_secret VARCHAR(256),
  max_streams INTEGER NOT NULL DEFAULT 100,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  health_check_url VARCHAR(500),
  last_health_check TIMESTAMPTZ,
  status VARCHAR(20) NOT NULL DEFAULT 'online',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS srs_servers_active_idx ON srs_servers(is_active);

-- ===== 远程设备管理 =====
CREATE TABLE IF NOT EXISTS remote_devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_no VARCHAR(100) NOT NULL UNIQUE,
  device_name VARCHAR(200),
  device_type VARCHAR(50),
  model VARCHAR(100),
  manufacturer VARCHAR(100),
  firmware_version VARCHAR(50),
  ip_address VARCHAR(45),
  mac_address VARCHAR(17),
  location VARCHAR(255),
  longitude VARCHAR(20),
  latitude VARCHAR(20),
  status VARCHAR(20) NOT NULL DEFAULT 'offline',
  battery_level INTEGER,
  signal_strength INTEGER,
  user_id UUID,
  last_online_at TIMESTAMPTZ,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS remote_devices_no_idx ON remote_devices(device_no);
CREATE INDEX IF NOT EXISTS remote_devices_status_idx ON remote_devices(status);
CREATE INDEX IF NOT EXISTS remote_devices_user_idx ON remote_devices(user_id);

-- ===== 远程设备任务 =====
CREATE TABLE IF NOT EXISTS remote_device_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id UUID NOT NULL REFERENCES remote_devices(id) ON DELETE CASCADE,
  task_type VARCHAR(50) NOT NULL,
  title VARCHAR(200) NOT NULL,
  description TEXT,
  payload JSONB,
  priority INTEGER NOT NULL DEFAULT 0,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  dispatched_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  result JSONB,
  error_message TEXT,
  retry_count INTEGER NOT NULL DEFAULT 0,
  max_retries INTEGER NOT NULL DEFAULT 3,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS remote_device_tasks_device_idx ON remote_device_tasks(device_id);
CREATE INDEX IF NOT EXISTS remote_device_tasks_status_idx ON remote_device_tasks(status);
CREATE INDEX IF NOT EXISTS remote_device_tasks_type_idx ON remote_device_tasks(task_type);
