-- R69: sys_role_menu 关联表(角色-菜单权限关联)
-- 对应 schema: packages/database/src/schema/admin-sys.ts sysRoleMenu
-- roleId 与 JWT payload.roleId(legacy 数值角色)一致; menuId 关联 sys_menu.id(uuid)
-- (role_id, menu_id) 联合唯一约束

CREATE TABLE IF NOT EXISTS "sys_role_menu" (
  "role_id" integer NOT NULL,
  "menu_id" uuid NOT NULL,
  CONSTRAINT "sys_role_menu_pk" UNIQUE ("role_id", "menu_id")
);
