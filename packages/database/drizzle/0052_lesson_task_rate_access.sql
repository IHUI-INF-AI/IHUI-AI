-- Migration 0052: 课程任务/评价/访问权限 (D盘审计缺口 P0-A2/A3/A4)
-- 创建时间: 2026-07-11
-- 描述: 迁移自旧架构 Java LearnService 的 LessonTask/LessonRate/LessonAccess 模块

-- ===== 课程任务表 =====
CREATE TABLE IF NOT EXISTS lesson_task (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id UUID NOT NULL,
  lesson_chapter_id UUID,
  lesson_chapter_section_id UUID,
  title VARCHAR(200) NOT NULL,
  content_type VARCHAR(50),
  conditions TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'enable',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS lesson_task_lesson_idx ON lesson_task(lesson_id);
CREATE INDEX IF NOT EXISTS lesson_task_chapter_idx ON lesson_task(lesson_chapter_id);

-- ===== 课程评价表 =====
CREATE TABLE IF NOT EXISTS lesson_rate (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id UUID NOT NULL,
  user_id UUID NOT NULL,
  sign_id UUID,
  content TEXT,
  content_utility_score INTEGER,
  teacher_score INTEGER,
  service_score INTEGER,
  is_anonymous BOOLEAN NOT NULL DEFAULT FALSE,
  status VARCHAR(20) NOT NULL DEFAULT 'published',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS lesson_rate_lesson_idx ON lesson_rate(lesson_id);
CREATE INDEX IF NOT EXISTS lesson_rate_user_idx ON lesson_rate(user_id);

-- ===== 课程访问权限表 =====
CREATE TABLE IF NOT EXISTS lesson_access (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id UUID NOT NULL,
  access_type VARCHAR(20) NOT NULL DEFAULT 'all',
  access_values TEXT NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS lesson_access_lesson_idx ON lesson_access(lesson_id);
