-- R70: sys_role_menu_menu_idx 索引(加速按 menu_id 查询角色关联)
-- 对应 schema: packages/database/src/schema/admin-sys.ts sysRoleMenu.menuIdx
-- 用途: 加速 DELETE /menu 级联清理及 findMenuIdsByRole 反向查询

CREATE INDEX IF NOT EXISTS "sys_role_menu_menu_idx" ON "sys_role_menu" ("menu_id");
