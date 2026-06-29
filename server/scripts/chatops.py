#!/usr/bin/env python3
"""
智能运维 ChatOps
P1-27: 机器人 (钉钉/飞书/Slack), 自然语言指令, 故障自愈工作流, 知识库
"""
import json
import os
import re
import sqlite3
import threading
import time
import uuid
from datetime import datetime, timedelta
from http.server import BaseHTTPRequestHandler, HTTPServer
from typing import Any, Dict, List, Optional, Tuple
from urllib.parse import urlparse, parse_qs

DB_PATH = os.path.join(os.path.dirname(__file__), "..", "logs", "chatops.db")
HTTP_PORT = 10070

PLATFORMS = ["dingtalk", "feishu", "slack", "wechat_work", "teams"]
INTENT_TYPES = [
    "deploy", "rollback", "scale", "status", "logs", "metrics", "alerts",
    "restart", "stop", "start", "query", "help", "unknown",
]
WORKFLOW_STATUS = ["pending", "running", "completed", "failed", "cancelled"]
SELF_HEAL_ACTIONS = [
    "restart_pod", "scale_up", "scale_down", "clear_cache", "failover",
    "rollback_deployment", "increase_pool", "purge_queue",
]

INTENT_PATTERNS = {
    "rollback": r"(回滚|rollback|回退|undo)",
    "deploy": r"(部署|deploy|发布|release|上线)",
    "scale": r"(扩容|缩容|scale|扩展|shrink|expand)",
    "status": r"(状态|status|健康|health|运行|check)",
    "logs": r"(日志|logs|log)",
    "metrics": r"(指标|metrics|cpu|memory|流量|qps|latency)",
    "alerts": r"(告警|alert|alerts|报警)",
    "restart": r"(重启|restart|reload)",
    "stop": r"(停止|stop|kill|终止)",
    "start": r"(启动|start|begin)",
    "query": r"(查询|query|select|find|search)",
    "help": r"(帮助|help|支持|support|怎么|如何)",
}


def _now() -> str:
    return datetime.utcnow().isoformat() + "Z"


def _init_db() -> None:
    db_dir = os.path.dirname(DB_PATH)
    os.makedirs(db_dir, exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.execute("PRAGMA journal_mode=WAL")
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS chat_messages (
            id TEXT PRIMARY KEY,
            timestamp TEXT NOT NULL,
            platform TEXT,
            user_id TEXT,
            user_name TEXT,
            channel TEXT,
            message TEXT,
            response TEXT,
            intent TEXT,
            confidence REAL
        );
        CREATE TABLE IF NOT EXISTS workflows (
            id TEXT PRIMARY KEY,
            timestamp TEXT NOT NULL,
            name TEXT NOT NULL,
            trigger_condition TEXT,
            actions TEXT,
            enabled INTEGER DEFAULT 1,
            execution_count INTEGER DEFAULT 0
        );
        CREATE TABLE IF NOT EXISTS workflow_executions (
            id TEXT PRIMARY KEY,
            timestamp TEXT NOT NULL,
            workflow_id TEXT,
            trigger_event TEXT,
            actions_executed TEXT,
            status TEXT,
            duration_ms INTEGER,
            result TEXT
        );
        CREATE TABLE IF NOT EXISTS knowledge_base (
            id TEXT PRIMARY KEY,
            timestamp TEXT NOT NULL,
            category TEXT,
            question TEXT,
            answer TEXT,
            keywords TEXT,
            hit_count INTEGER DEFAULT 0
        );
        CREATE TABLE IF NOT EXISTS bot_config (
            id TEXT PRIMARY KEY,
            timestamp TEXT NOT NULL,
            platform TEXT NOT NULL,
            bot_name TEXT,
            webhook_url TEXT,
            enabled INTEGER DEFAULT 1,
            config TEXT
        );
        CREATE TABLE IF NOT EXISTS command_history (
            id TEXT PRIMARY KEY,
            timestamp TEXT NOT NULL,
            user_id TEXT,
            intent TEXT,
            target TEXT,
            args TEXT,
            result TEXT,
            success INTEGER DEFAULT 1
        );
        CREATE INDEX IF NOT EXISTS idx_chat_ts ON chat_messages(timestamp);
        CREATE INDEX IF NOT EXISTS idx_cmd_history_intent ON command_history(intent);
    """)
    conn.close()


_init_db()
_conn_lock = threading.Lock()


def _conn() -> sqlite3.Connection:
    c = sqlite3.connect(DB_PATH)
    c.row_factory = sqlite3.Row
    return c


def parse_intent(message: str) -> Tuple[str, float]:
    """解析用户意图"""
    msg = message.lower()
    for intent, pattern in INTENT_PATTERNS.items():
        if re.search(pattern, msg):
            return intent, 0.9
    return "unknown", 0.3


def extract_target(message: str) -> Optional[str]:
    """提取目标服务/资源"""
    # 匹配 "服务xxx" "xxx服务" "xxx pod" 等, 限制为 ASCII 标识符
    patterns = [
        r"服务\s*([a-zA-Z0-9\-_]+)",
        r"([a-zA-Z0-9\-_]+)\s*服务",
        r"pod\s*([a-zA-Z0-9\-_]+)",
        r"([a-zA-Z0-9\-_]+)\s*pod",
        r"deployment\s*([a-zA-Z0-9\-_]+)",
    ]
    for p in patterns:
        m = re.search(p, message, re.IGNORECASE)
        if m:
            return m.group(1)
    return None


def record_chat(platform: str, user_id: str, user_name: str,
                 channel: str, message: str, response: str,
                 intent: str, confidence: float) -> str:
    """记录聊天消息"""
    if platform not in PLATFORMS:
        platform = "dingtalk"
    mid = str(uuid.uuid4())
    with _conn_lock, _conn() as c:
        c.execute("""INSERT INTO chat_messages
            (id,timestamp,platform,user_id,user_name,channel,message,response,
             intent,confidence)
            VALUES (?,?,?,?,?,?,?,?,?,?)""",
            (mid, _now(), platform, user_id, user_name, channel,
             message, response, intent, confidence))
    return mid


def handle_command(message: str, user_id: str = "default") -> Dict[str, Any]:
    """处理用户命令"""
    intent, confidence = parse_intent(message)
    target = extract_target(message)
    response = ""
    actions: List[str] = []
    if intent == "deploy":
        response = f"开始部署 {target or '服务'}..."
        actions.append(f"deploy:{target or 'unknown'}")
    elif intent == "rollback":
        response = f"开始回滚 {target or '服务'} 到上一版本..."
        actions.append(f"rollback:{target or 'unknown'}")
    elif intent == "scale":
        response = f"开始扩缩容 {target or '服务'}..."
        actions.append(f"scale:{target or 'unknown'}")
    elif intent == "status":
        response = f"查询 {target or '所有服务'} 状态..."
        actions.append(f"status:{target or 'all'}")
    elif intent == "logs":
        response = f"获取 {target or '服务'} 最近日志..."
        actions.append(f"logs:{target or 'unknown'}")
    elif intent == "metrics":
        response = f"获取 {target or '服务'} 指标..."
        actions.append(f"metrics:{target or 'unknown'}")
    elif intent == "alerts":
        response = "查询当前告警..."
        actions.append("alerts:list")
    elif intent == "restart":
        response = f"重启 {target or '服务'}..."
        actions.append(f"restart:{target or 'unknown'}")
    elif intent == "query":
        response = f"执行查询: {message}"
        actions.append("query:execute")
    elif intent == "help":
        response = ("可用命令: 部署/回滚/扩缩容/状态/日志/指标/告警/重启\n"
                    "示例: 部署api服务, 重启mysql, 查看订单服务状态")
    else:
        response = "未识别指令, 请输入 '帮助' 查看用法"
    cid = str(uuid.uuid4())
    with _conn_lock, _conn() as c:
        c.execute("""INSERT INTO command_history
            (id,timestamp,user_id,intent,target,args,result,success)
            VALUES (?,?,?,?,?,?,?,1)""",
            (cid, _now(), user_id, intent, target or "", message, response))
    return {
        "intent": intent,
        "confidence": confidence,
        "target": target,
        "response": response,
        "actions": actions,
    }


def create_workflow(name: str, trigger_condition: str,
                     actions: List[str]) -> str:
    """创建工作流"""
    wid = str(uuid.uuid4())
    with _conn_lock, _conn() as c:
        c.execute("""INSERT OR REPLACE INTO workflows
            (id,timestamp,name,trigger_condition,actions,enabled,execution_count)
            VALUES (?,?,?,?,?,1,0)""",
            (wid, _now(), name, trigger_condition,
             json.dumps(actions)))
    return wid


def list_workflows() -> List[Dict[str, Any]]:
    """列出工作流"""
    with _conn_lock, _conn() as c:
        rows = c.execute("""SELECT * FROM workflows ORDER BY timestamp DESC""").fetchall()
    return [{"id": r["id"], "name": r["name"],
             "trigger": r["trigger_condition"],
             "actions": json.loads(r["actions"] or "[]"),
             "enabled": bool(r["enabled"]),
             "executions": r["execution_count"]} for r in rows]


def execute_workflow(workflow_id: str, trigger_event: str) -> Dict[str, Any]:
    """执行工作流"""
    with _conn_lock, _conn() as c:
        wf = c.execute("""SELECT * FROM workflows WHERE id = ?""",
                        (workflow_id,)).fetchone()
        if not wf:
            return {"status": "failed", "error": "workflow_not_found"}
        if not wf["enabled"]:
            return {"status": "failed", "error": "workflow_disabled"}
        actions = json.loads(wf["actions"] or "[]")
    start = time.time()
    eid = str(uuid.uuid4())
    executed = []
    failed = []
    for action in actions:
        try:
            if action in SELF_HEAL_ACTIONS:
                executed.append(action)
            else:
                executed.append(action)
        except Exception as e:
            failed.append({"action": action, "error": str(e)})
    duration = int((time.time() - start) * 1000)
    status = "completed" if not failed else "failed"
    with _conn_lock, _conn() as c:
        c.execute("""INSERT INTO workflow_executions
            (id,timestamp,workflow_id,trigger_event,actions_executed,
             status,duration_ms,result)
            VALUES (?,?,?,?,?,?,?,?)""",
            (eid, _now(), workflow_id, trigger_event,
             json.dumps(executed), status, duration,
             json.dumps({"failed": failed}, ensure_ascii=False)))
        c.execute("""UPDATE workflows SET execution_count = execution_count + 1
            WHERE id = ?""", (workflow_id,))
    return {
        "execution_id": eid,
        "workflow_id": workflow_id,
        "status": status,
        "actions_executed": executed,
        "failed": failed,
        "duration_ms": duration,
    }


def add_knowledge(category: str, question: str, answer: str,
                   keywords: List[str]) -> str:
    """添加知识库条目"""
    kid = str(uuid.uuid4())
    with _conn_lock, _conn() as c:
        c.execute("""INSERT INTO knowledge_base
            (id,timestamp,category,question,answer,keywords,hit_count)
            VALUES (?,?,?,?,?,?,0)""",
            (kid, _now(), category, question, answer,
             json.dumps(keywords, ensure_ascii=False)))
    return kid


def search_knowledge(query: str, limit: int = 5) -> List[Dict[str, Any]]:
    """搜索知识库"""
    query_lower = query.lower()
    with _conn_lock, _conn() as c:
        rows = c.execute("""SELECT * FROM knowledge_base""").fetchall()
    results = []
    for r in rows:
        keywords = json.loads(r["keywords"] or "[]")
        question = r["question"].lower()
        answer = r["answer"].lower()
        score = 0
        for kw in keywords:
            if kw.lower() in query_lower:
                score += 2
        if query_lower in question:
            score += 3
        if query_lower in answer:
            score += 1
        if score > 0:
            results.append({
                "id": r["id"], "category": r["category"],
                "question": r["question"], "answer": r["answer"],
                "score": score,
            })
    results.sort(key=lambda x: x["score"], reverse=True)
    return results[:limit]


def update_knowledge_hit(kb_id: str) -> None:
    """更新知识库命中次数"""
    with _conn_lock, _conn() as c:
        c.execute("""UPDATE knowledge_base SET hit_count = hit_count + 1
            WHERE id = ?""", (kb_id,))


def register_bot(platform: str, bot_name: str, webhook_url: str = "",
                  config: Optional[Dict[str, Any]] = None) -> str:
    """注册机器人"""
    if platform not in PLATFORMS:
        platform = "dingtalk"
    bid = str(uuid.uuid4())
    with _conn_lock, _conn() as c:
        c.execute("""INSERT OR REPLACE INTO bot_config
            (id,timestamp,platform,bot_name,webhook_url,enabled,config)
            VALUES (?,?,?,?,?,1,?)""",
            (bid, _now(), platform, bot_name, webhook_url,
             json.dumps(config or {}, ensure_ascii=False)))
    return bid


def list_bots() -> List[Dict[str, Any]]:
    """列出机器人"""
    with _conn_lock, _conn() as c:
        rows = c.execute("""SELECT * FROM bot_config""").fetchall()
    return [{"id": r["id"], "platform": r["platform"],
             "name": r["bot_name"], "webhook": r["webhook_url"],
             "enabled": bool(r["enabled"]),
             "config": json.loads(r["config"] or "{}")} for r in rows]


def get_chat_stats(hours: int = 24) -> Dict[str, Any]:
    """聊天统计"""
    since = (datetime.utcnow() - timedelta(hours=hours)).isoformat() + "Z"
    with _conn_lock, _conn() as c:
        total = c.execute("""SELECT COUNT(*) as cnt FROM chat_messages
            WHERE timestamp >= ?""", (since,)).fetchone()["cnt"]
        intents = c.execute("""SELECT intent, COUNT(*) as cnt FROM chat_messages
            WHERE timestamp >= ? GROUP BY intent ORDER BY cnt DESC""",
            (since,)).fetchall()
        platforms = c.execute("""SELECT platform, COUNT(*) as cnt FROM chat_messages
            WHERE timestamp >= ? GROUP BY platform""", (since,)).fetchall()
        cmds = c.execute("""SELECT COUNT(*) as cnt FROM command_history
            WHERE timestamp >= ?""", (since,)).fetchone()["cnt"]
    return {
        "window_hours": hours,
        "total_messages": total,
        "total_commands": cmds,
        "intents": [{"intent": r["intent"], "count": r["cnt"]} for r in intents],
        "platforms": [{"platform": r["platform"], "count": r["cnt"]} for r in platforms],
    }


def _send_dingtalk(content: str) -> None:
    """发送钉钉消息 (Stub)"""
    log_dir = os.path.join(os.path.dirname(__file__), "..", "logs", "mock_webhook")
    os.makedirs(log_dir, exist_ok=True)
    with open(os.path.join(log_dir, "dingtalk.jsonl"), "a", encoding="utf-8") as f:
        f.write(json.dumps({
            "timestamp": _now(), "content": content,
            "source": "chatops",
        }, ensure_ascii=False) + "\n")


class _Handler(BaseHTTPRequestHandler):
    def log_message(self, format, *args): pass

    def _json(self, code: int, payload: Any) -> None:
        body = json.dumps(payload, ensure_ascii=False, default=str).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self) -> None:
        u = urlparse(self.path)
        path = u.path
        if path == "/health":
            self._json(200, {"status": "ok", "service": "chatops"})
        elif path == "/api/chat/stats":
            self._json(200, get_chat_stats())
        elif path == "/api/workflows":
            self._json(200, {"workflows": list_workflows()})
        elif path == "/api/bots":
            self._json(200, {"bots": list_bots()})
        else:
            self._json(404, {"error": "not_found"})

    def do_POST(self) -> None:
        u = urlparse(self.path)
        path = u.path
        length = int(self.headers.get("Content-Length", "0"))
        raw = self.rfile.read(length).decode("utf-8") if length else "{}"
        try:
            data = json.loads(raw)
        except json.JSONDecodeError:
            data = {}
        if path == "/api/chat/message":
            intent, confidence = parse_intent(data.get("message", ""))
            result = handle_command(
                message=data.get("message", ""),
                user_id=data.get("user_id", "default"),
            )
            mid = record_chat(
                platform=data.get("platform", "dingtalk"),
                user_id=data.get("user_id", "default"),
                user_name=data.get("user_name", ""),
                channel=data.get("channel", ""),
                message=data.get("message", ""),
                response=result["response"],
                intent=intent,
                confidence=confidence,
            )
            self._json(200, {"id": mid, **result})
        elif path == "/api/intent/parse":
            intent, confidence = parse_intent(data.get("message", ""))
            target = extract_target(data.get("message", ""))
            self._json(200, {"intent": intent, "confidence": confidence,
                              "target": target})
        elif path == "/api/command/handle":
            result = handle_command(
                message=data.get("message", ""),
                user_id=data.get("user_id", "default"),
            )
            self._json(200, result)
        elif path == "/api/workflow/create":
            wid = create_workflow(
                name=data.get("name", ""),
                trigger_condition=data.get("trigger_condition", ""),
                actions=data.get("actions", []),
            )
            self._json(201, {"id": wid})
        elif path == "/api/workflow/execute":
            result = execute_workflow(
                workflow_id=data.get("workflow_id", ""),
                trigger_event=data.get("trigger_event", ""),
            )
            self._json(200, result)
        elif path == "/api/knowledge/add":
            kid = add_knowledge(
                category=data.get("category", ""),
                question=data.get("question", ""),
                answer=data.get("answer", ""),
                keywords=data.get("keywords", []),
            )
            self._json(201, {"id": kid})
        elif path == "/api/knowledge/search":
            results = search_knowledge(data.get("query", ""))
            self._json(200, {"results": results})
        elif path == "/api/bot/register":
            bid = register_bot(
                platform=data.get("platform", "dingtalk"),
                bot_name=data.get("bot_name", ""),
                webhook_url=data.get("webhook_url", ""),
                config=data.get("config", {}),
            )
            self._json(201, {"id": bid})
        else:
            self._json(404, {"error": "not_found"})


def serve() -> None:
    srv = HTTPServer(("0.0.0.0", HTTP_PORT), _Handler)
    print(f"ChatOps service on :{HTTP_PORT}")
    srv.serve_forever()


def cmd_serve(_args: List[str]) -> None:
    serve()


def cmd_parse(args: List[str]) -> None:
    if not args:
        print("usage: parse <message>")
        return
    msg = " ".join(args)
    intent, confidence = parse_intent(msg)
    target = extract_target(msg)
    print(json.dumps({"intent": intent, "confidence": confidence,
                       "target": target}, ensure_ascii=False))


def cmd_handle(args: List[str]) -> None:
    if not args:
        print("usage: handle <message> [user_id]")
        return
    msg = " ".join(args[:-1]) if len(args) > 1 else args[0]
    user = args[-1] if len(args) > 1 else "default"
    if len(args) == 1:
        msg = args[0]
        user = "default"
    print(json.dumps(handle_command(msg, user), ensure_ascii=False, indent=2))


def cmd_workflow_create(args: List[str]) -> None:
    if len(args) < 3:
        print("usage: workflow-create <name> <trigger> <actions_csv>")
        return
    actions = args[2].split(",")
    wid = create_workflow(args[0], args[1], actions)
    print(json.dumps({"id": wid}, ensure_ascii=False))


def cmd_workflow_list(_args: List[str]) -> None:
    print(json.dumps(list_workflows(), ensure_ascii=False, indent=2))


def cmd_workflow_execute(args: List[str]) -> None:
    if len(args) < 1:
        print("usage: workflow-execute <workflow_id> [trigger]")
        return
    trigger = args[1] if len(args) > 1 else "manual"
    print(json.dumps(execute_workflow(args[0], trigger), ensure_ascii=False, indent=2))


def cmd_knowledge_add(args: List[str]) -> None:
    if len(args) < 4:
        print("usage: knowledge-add <category> <question> <answer> <keywords_csv>")
        return
    keywords = args[3].split(",")
    kid = add_knowledge(args[0], args[1], args[2], keywords)
    print(json.dumps({"id": kid}, ensure_ascii=False))


def cmd_knowledge_search(args: List[str]) -> None:
    if not args:
        print("usage: knowledge-search <query>")
        return
    print(json.dumps(search_knowledge(" ".join(args)), ensure_ascii=False, indent=2))


def cmd_bot_register(args: List[str]) -> None:
    if len(args) < 2:
        print("usage: bot-register <platform> <name> [webhook]")
        return
    webhook = args[2] if len(args) > 2 else ""
    bid = register_bot(args[0], args[1], webhook)
    print(json.dumps({"id": bid}, ensure_ascii=False))


def cmd_bot_list(_args: List[str]) -> None:
    print(json.dumps(list_bots(), ensure_ascii=False, indent=2))


def cmd_chat(args: List[str]) -> None:
    if len(args) < 2:
        print("usage: chat <message> <user_id> [platform] [user_name]")
        return
    user = args[1]
    platform = args[2] if len(args) > 2 else "dingtalk"
    user_name = args[3] if len(args) > 3 else ""
    result = handle_command(args[0], user)
    mid = record_chat(platform, user, user_name, "", args[0],
                        result["response"], result["intent"],
                        result["confidence"])
    print(json.dumps({"id": mid, **result}, ensure_ascii=False, indent=2))


def cmd_stats(args: List[str]) -> None:
    hours = int(args[0]) if args else 24
    print(json.dumps(get_chat_stats(hours), ensure_ascii=False, indent=2))


def main() -> None:
    import sys
    cmds = {
        "serve": cmd_serve, "parse": cmd_parse, "handle": cmd_handle,
        "workflow-create": cmd_workflow_create, "workflow-list": cmd_workflow_list,
        "workflow-execute": cmd_workflow_execute,
        "knowledge-add": cmd_knowledge_add, "knowledge-search": cmd_knowledge_search,
        "bot-register": cmd_bot_register, "bot-list": cmd_bot_list,
        "chat": cmd_chat, "stats": cmd_stats,
    }
    cmd = sys.argv[1] if len(sys.argv) > 1 else "serve"
    if cmd not in cmds:
        print(f"usage: {list(cmds.keys())}")
        sys.exit(1)
    cmds[cmd](sys.argv[2:])


if __name__ == "__main__":
    main()
