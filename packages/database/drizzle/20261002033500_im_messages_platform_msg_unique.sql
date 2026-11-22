-- © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
-- Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
-- [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/*
G-815927:给 im_messages 加库级去重兜底 —— 唯一索引 (user_id, platform, direction, platform_message_id)。

为什么键里带 user_id 与 direction(不得照台账标题里那句 "(platform, platform_message_id)" 简化):
 · 一条平台消息的**出站回执**与**入站镜像**共用同一个平台 id 空间,只按 (platform, pid) 建索引
   会把这两条合法行判成重复 ⇒ 入站 webhook 当场失败,表现为"消息收到了但库里没有";
 · 同一租户里两个我方用户各自绑定同一机器人时,平台推来的同一条消息对**两个用户**都是合法行。

为什么迁移里先做重复体检、且体检失败就 RAISE EXCEPTION:
 · 本机不是生产机,生产库此刻不可达 ⇒ "存量有没有重复"这件事在这里**量不到**(实测开发库
   im_messages 行数为 0,那是一个空样本,不是"没有重复"的证据);
 · 若生产库里真有重复,CREATE UNIQUE INDEX 会当场失败,而失败信息只说 "could not create unique index",
   不告诉操作者该做什么。本 DO 块把同一件事提前判出来,并把**处置顺序**写在异常文本里:
   先量重复、再人工裁决保留哪一条、最后才加索引(AGENTS §7 禁止为了过迁移而无声删行)。
 · 这条守卫不删任何数据、不静默降级:有脏就停,没脏才建索引。
*/

DO $$
DECLARE
  dup_groups integer;
  diag text;
BEGIN
  SELECT count(*)
    INTO dup_groups
    FROM (
      SELECT user_id, platform, direction, platform_message_id
        FROM im_messages
       WHERE platform_message_id IS NOT NULL
         AND platform_message_id <> ''
       GROUP BY user_id, platform, direction, platform_message_id
      HAVING count(*) > 1
    ) q;

  IF dup_groups > 0 THEN
    -- RAISE 的格式位不接受 '...' || '...' 这种拼接(实测报 syntax error at or near "||"),
    -- 所以先把消息拼进变量,再用一个 % 占位抛出。
    diag := 'G-815927 前置体检未通过: im_messages 存在 '
      || dup_groups
      || ' 组重复的 (user_id, platform, direction, platform_message_id)。'
      || ' 加唯一索引前必须先逐组人工裁决保留哪一条(AGENTS §7 禁止无声删行)。'
      || ' 取清单: SELECT user_id, platform, direction, platform_message_id, count(*) c'
      || ' FROM im_messages WHERE platform_message_id IS NOT NULL AND platform_message_id <> '''''
      || ' GROUP BY 1,2,3,4 HAVING count(*) > 1 ORDER BY c DESC;';
    RAISE EXCEPTION '%', diag;
  END IF;
END $$;

--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "im_messages_user_platform_direction_msg_key"
  ON "im_messages" ("user_id", "platform", "direction", "platform_message_id");
-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
