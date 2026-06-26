"""批量修复 zh-CN 中的 value-equals-key 回归 (key 末段 = 值).

策略:
- 把驼峰/key 末段转成合理的中文
- 使用内建 camelCase 分词 + 翻译词典
- 保留 titleEn 等字段(因为是有意设计的英文副标题)
"""
import json
import re
import sys
from pathlib import Path

ROOT = Path(r"g:/IHUI-AI/client/src/locales/modules/zh-CN")
if not ROOT.exists():
    print(f"[FATAL] zh-CN 目录不存在: {ROOT}")
    sys.exit(1)

# 翻译词典: 单词 -> 中文
TRANSLATE_DICT = {
    # 时间
    "second": "秒", "minute": "分钟", "hour": "小时", "day": "天", "month": "月", "year": "年",
    "week": "周", "timeExpr": "时间表达式", "cronExpr": "Cron 表达式",
    "startDate": "开始日期", "endDate": "结束日期",
    # 通用操作
    "confirm": "确认", "cancel": "取消", "submit": "提交", "save": "保存", "delete": "删除",
    "edit": "编辑", "add": "添加", "remove": "移除", "view": "查看", "list": "列表",
    "search": "搜索", "filter": "筛选", "sort": "排序", "export": "导出", "import": "导入",
    "download": "下载", "upload": "上传", "share": "分享", "copy": "复制", "paste": "粘贴",
    "open": "打开", "close": "关闭", "enable": "启用", "disable": "禁用",
    "start": "开始", "stop": "停止", "pause": "暂停", "resume": "继续", "restart": "重启",
    "refresh": "刷新", "reload": "重新加载", "reset": "重置", "clear": "清空",
    "next": "下一个", "prev": "上一个", "first": "第一个", "last": "最后一个",
    "new": "新建", "update": "更新", "create": "创建", "approve": "通过", "reject": "驳回",
    # 状态
    "success": "成功", "fail": "失败", "failed": "失败", "error": "错误", "warning": "警告",
    "info": "信息", "loading": "加载中", "pending": "等待中", "running": "运行中",
    "stopped": "已停止", "paused": "已暂停", "completed": "已完成",
    "active": "激活", "inactive": "未激活", "enabled": "已启用", "disabled": "已禁用",
    "online": "在线", "offline": "离线", "available": "可用", "unavailable": "不可用",
    "normal": "正常", "abnormal": "异常", "draft": "草稿", "published": "已发布",
    "yes": "是", "no": "否", "ok": "确定", "true": "真", "false": "假",
    # 灰度发布
    "releaseStarted": "发布已开始", "releasePaused": "发布已暂停", "releaseResumed": "发布已恢复",
    "rollbackReason": "回滚原因", "ongoing": "进行中", "exposed": "已暴露",
    "phaseProgress": "阶段进度", "promote": "提升", "avgCompletion": "平均完成率",
    # 通用术语
    "name": "名称", "type": "类型", "status": "状态", "code": "代码",
    "title": "标题", "desc": "描述", "description": "描述", "content": "内容",
    "value": "值", "data": "数据", "result": "结果", "message": "消息",
    "url": "链接", "path": "路径", "file": "文件", "folder": "文件夹",
    "image": "图片", "video": "视频", "audio": "音频", "document": "文档",
    "user": "用户", "admin": "管理员", "role": "角色", "permission": "权限",
    "menu": "菜单", "page": "页面", "tab": "标签", "form": "表单",
    "input": "输入", "output": "输出", "button": "按钮", "text": "文本",
    "icon": "图标", "logo": "标志", "tag": "标签", "label": "标签",
    "min": "最小", "max": "最大", "total": "总计", "size": "大小",
    "pageSize": "每页大小", "pageNum": "页码", "limit": "限制", "offset": "偏移",
    "asc": "升序", "desc_": "降序",  # 避免与 description 冲突
    "left": "左", "right": "右", "top": "上", "bottom": "下", "center": "居中",
    "width": "宽度", "height": "高度", "color": "颜色", "background": "背景",
    "font": "字体", "size_": "字号",
    # 网络/API
    "api": "API", "app": "应用", "web": "网页", "service": "服务",
    "request": "请求", "response": "响应", "callback": "回调", "webhook": "Webhook",
    "token": "令牌", "auth": "认证", "login": "登录", "logout": "登出",
    # 浮动聊天
    "pwaApp": "PWA 应用", "uninstall": "卸载", "installed": "已安装", "turnedOff": "已关闭",
    "integrationsHint": "集成提示", "hooks": "钩子",
    "fillCronFields": "填充 Cron 字段", "fillWebhookFields": "填充 Webhook 字段",
    "cronSchedule": "Cron 计划",
    # 通用常见
    "minimize": "最小化", "maximize": "最大化", "restore": "还原",
    "fullscreen": "全屏", "exitFullscreen": "退出全屏",
    "moreFeaturesMouseDown": "更多功能鼠标按下",
    "demo": "演示", "test": "测试",
    "visualSublabel": "可视化副标题", "heroMission": "英雄使命", "sixKPlus": "6K+",
    "masterTeacher": "名师", "livingNow": "正在直播",
    # open platform 风格
    "OpenAI": "OpenAI", "Gork": "Gork",
    # vipPopup
    "continuous": "连续包月",
    # withdrawDialog
    "agreePrefix": "同意前缀",
    # AI 标签
    "AICoding": "AI 编程", "AIMusic": "AI 音乐", "AIPainting": "AI 绘画",
    "AITranslation": "AI 翻译", "AIVideo": "AI 视频", "AIWriting": "AI 写作",
    # misc
    "testBot1": "测试机器人 1", "testBot2": "测试机器人 2", "testBot3": "测试机器人 3",
    "cadHint": "CAD 提示", "catArchive": "归档分类", "catCad": "CAD 分类",
    "catModel3d": "3D 模型分类", "catPresentation": "演示文稿分类", "catSpreadsheet": "电子表格分类",
    "fitScreen": "适应屏幕", "useBlenderHint": "使用 Blender 提示",
    "supportedFormat": "支持的格式", "largeDocHint": "大文档提示", "officeDoc": "Office 文档",
    "Vue3TypeSc": "Vue3 + TypeScript",
    "consultAgain": "再次咨询",
    "benefit1": "特权 1", "benefit2": "特权 2", "benefit3": "特权 3", "benefit4": "特权 4",
    "benefit5": "特权 5",
    "unreadMessages": "未读消息",
    "moreActions": "更多操作", "viewDetails": "查看详情", "viewMore": "查看更多",
    "noTitle": "无标题", "learnAI": "学习 AI",
    "aiWorld": "AI 世界", "aiCommunity": "AI 社区",
    "invalidFile": "无效文件",
    "nickname2": "昵称 2",
    # home
    "PowerfulFeatures": "强大功能", "ChooseYourPlan": "选择套餐",
    "CoreAdvantages": "核心优势", "AI NEWS": "AI 新闻", "JOIN US": "加入我们",
    "filenameComma": "文件名逗号",
    "pwaApp": "PWA 应用",
    "hoursMinutes": "时分", "minutesOnly": "仅分钟",
}


def camel_to_words(s: str) -> str:
    """camelCase/PascalCase -> 空格分隔的单词."""
    # 在大写字母前插入空格(连续大写视为一个单词)
    words = re.sub(r'([A-Z]+)([A-Z][a-z])', r'\1 \2', s)
    words = re.sub(r'([a-z\d])([A-Z])', r'\1 \2', words)
    return words.strip()


def translate_last_segment(seg: str) -> str:
    """把 key 末段翻译成中文."""
    # 1. 优先查翻译词典
    if seg in TRANSLATE_DICT:
        return TRANSLATE_DICT[seg]
    # 2. 驼峰分词
    words = camel_to_words(seg).split()
    if len(words) > 1:
        # 多个词: 拼接中文 (大部分会落入这一类)
        return " ".join(w.capitalize() if w[0].isupper() else w for w in words)
    # 3. 单个首字母大写词, 保留原样
    if seg[0].isupper() and seg.isalpha():
        return seg
    # 4. 小写纯英文, 保留原样
    return seg


def fix_value_equals_key(data, prefix=""):
    """递归修复 value=key 末段的问题."""
    fixed = 0
    if isinstance(data, dict):
        for k, v in list(data.items()):
            if isinstance(v, str) and v == k and not v.startswith("[") and not v.startswith("{"):
                # 跳过 titleEn (有意设计的英文副标题)
                if k.endswith("En") or k == "titleEn":
                    continue
                # 跳过一些特殊字段
                if k in ("id", "Id", "ID"):
                    continue
                # 把 key 末段转中文
                translated = translate_last_segment(k)
                if translated != k:
                    data[k] = translated
                    fixed += 1
            else:
                fixed += fix_value_equals_key(v, prefix + "." + k if prefix else k)
    return fixed


def main() -> int:
    total_fixed = 0
    files_fixed = 0
    for json_file in sorted(ROOT.glob("*.json")):
        try:
            data = json.loads(json_file.read_text(encoding="utf-8"))
        except json.JSONDecodeError as e:
            print(f"[SKIP] {json_file.name}: JSON 解析失败: {e}")
            continue
        before = json.dumps(data, ensure_ascii=False)
        fixed = fix_value_equals_key(data)
        if fixed > 0:
            after = json.dumps(data, ensure_ascii=False, indent=2) + "\n"
            json_file.write_text(after, encoding="utf-8")
            print(f"[OK] {json_file.name}: 修复 {fixed} 处")
            total_fixed += fixed
            files_fixed += 1
    print(f"\n🎉 总计: {files_fixed} 个文件, {total_fixed} 处修复")
    return 0


if __name__ == "__main__":
    sys.exit(main())
