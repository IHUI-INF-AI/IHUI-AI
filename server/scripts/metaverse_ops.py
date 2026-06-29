#!/usr/bin/env python3
"""
元宇宙运维
P2-42: 3D 可视化, VR 故障诊断, 沉浸式监控, 协作运维空间, AI 数字员工
"""
import hashlib
import json
import os
import random
import secrets
import sqlite3
import threading
import time
import uuid
from datetime import datetime
from http.server import BaseHTTPRequestHandler, HTTPServer
from typing import Any, Dict, List, Optional, Tuple
from urllib.parse import urlparse, parse_qs

DB_PATH = os.path.join(os.path.dirname(__file__), "..", "logs", "metaverse_ops.db")
HTTP_PORT = 10220

SCENE_TYPES = ["datacenter", "network", "application", "city", "industrial"]
OBJECT_TYPES = ["server", "router", "database", "service", "sensor", "user", "agent", "drone"]
DIAGNOSIS_PHASES = ["intake", "analysis", "hypothesis", "experiment", "resolution", "closed"]
COLLABORATION_ROLES = ["lead", "expert", "observer", "apprentice", "ai_assistant"]
AGENT_SKILLS = ["diagnose", "remediate", "communicate", "learn", "predict", "visualize"]


def _now() -> str:
    return datetime.utcnow().isoformat() + "Z"


def _init_db() -> None:
    db_dir = os.path.dirname(DB_PATH)
    os.makedirs(db_dir, exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.execute("PRAGMA journal_mode=WAL")
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS scenes (
            id TEXT PRIMARY KEY,
            timestamp TEXT NOT NULL,
            scene_id TEXT NOT NULL UNIQUE,
            scene_type TEXT,
            name TEXT,
            description TEXT,
            owner TEXT,
            visibility TEXT DEFAULT 'private'
        );
        CREATE TABLE IF NOT EXISTS scene_objects (
            id TEXT PRIMARY KEY,
            timestamp TEXT NOT NULL,
            object_id TEXT NOT NULL,
            scene_id TEXT,
            object_type TEXT,
            position TEXT,
            rotation TEXT,
            scale TEXT,
            health TEXT DEFAULT 'healthy'
        );
        CREATE TABLE IF NOT EXISTS views (
            id TEXT PRIMARY KEY,
            timestamp TEXT NOT NULL,
            view_id TEXT NOT NULL UNIQUE,
            scene_id TEXT,
            user_id TEXT,
            duration_sec REAL DEFAULT 0,
            interactions INTEGER DEFAULT 0
        );
        CREATE TABLE IF NOT EXISTS diagnosis_sessions (
            id TEXT PRIMARY KEY,
            timestamp TEXT NOT NULL,
            session_id TEXT NOT NULL UNIQUE,
            incident_id TEXT,
            target_object TEXT,
            phase TEXT DEFAULT 'intake',
            findings TEXT,
            resolution TEXT,
            status TEXT DEFAULT 'active'
        );
        CREATE TABLE IF NOT EXISTS immersive_streams (
            id TEXT PRIMARY KEY,
            timestamp TEXT NOT NULL,
            stream_id TEXT NOT NULL,
            scene_id TEXT,
            user_id TEXT,
            metric_name TEXT,
            metric_value REAL,
            attention_score REAL
        );
        CREATE TABLE IF NOT EXISTS collab_sessions (
            id TEXT PRIMARY KEY,
            timestamp TEXT NOT NULL,
            collab_id TEXT NOT NULL UNIQUE,
            session_name TEXT,
            owner TEXT,
            participants TEXT,
            space_type TEXT DEFAULT 'warroom'
        );
        CREATE TABLE IF NOT EXISTS collab_messages (
            id TEXT PRIMARY KEY,
            timestamp TEXT NOT NULL,
            message_id TEXT NOT NULL,
            collab_id TEXT,
            sender TEXT,
            role TEXT,
            content TEXT,
            is_ai INTEGER DEFAULT 0
        );
        CREATE TABLE IF NOT EXISTS digital_agents (
            id TEXT PRIMARY KEY,
            timestamp TEXT NOT NULL,
            agent_id TEXT NOT NULL UNIQUE,
            name TEXT,
            persona TEXT,
            skills TEXT,
            status TEXT DEFAULT 'active',
            conversations INTEGER DEFAULT 0
        );
        CREATE TABLE IF NOT EXISTS agent_tasks (
            id TEXT PRIMARY KEY,
            timestamp TEXT NOT NULL,
            task_id TEXT NOT NULL UNIQUE,
            agent_id TEXT,
            task_type TEXT,
            priority TEXT DEFAULT 'medium',
            status TEXT DEFAULT 'pending',
            result TEXT
        );
        CREATE INDEX IF NOT EXISTS idx_scenes_type ON scenes(scene_type);
        CREATE INDEX IF NOT EXISTS idx_objects_scene ON scene_objects(scene_id);
        CREATE INDEX IF NOT EXISTS idx_diagnosis_phase ON diagnosis_sessions(phase);
        CREATE INDEX IF NOT EXISTS idx_agents_status ON digital_agents(status);
    """)
    conn.close()


_init_db()
_conn_lock = threading.Lock()


def _conn() -> sqlite3.Connection:
    c = sqlite3.connect(DB_PATH)
    c.row_factory = sqlite3.Row
    return c


def create_scene(scene_id: str, scene_type: str, name: str,
                  description: str = "", owner: str = "system",
                  visibility: str = "private") -> str:
    """创建 3D 场景"""
    if scene_type not in SCENE_TYPES:
        scene_type = "datacenter"
    if visibility not in ["private", "team", "public"]:
        visibility = "private"
    sid = str(uuid.uuid4())
    with _conn_lock, _conn() as c:
        c.execute("""INSERT INTO scenes
            (id,timestamp,scene_id,scene_type,name,description,owner,visibility)
            VALUES (?,?,?,?,?,?,?,?)""",
            (sid, _now(), scene_id, scene_type, name, description, owner, visibility))
    return scene_id


def add_scene_object(scene_id: str, object_id: str, object_type: str,
                      position: Optional[List[float]] = None,
                      rotation: Optional[List[float]] = None,
                      scale: Optional[List[float]] = None,
                      health: str = "healthy") -> str:
    """向场景添加 3D 物体"""
    if object_type not in OBJECT_TYPES:
        object_type = "server"
    if health not in ["healthy", "degraded", "unhealthy", "offline"]:
        health = "healthy"
    pos = json.dumps(position or [0, 0, 0])
    rot = json.dumps(rotation or [0, 0, 0])
    scl = json.dumps(scale or [1, 1, 1])
    oid = str(uuid.uuid4())
    with _conn_lock, _conn() as c:
        c.execute("""INSERT INTO scene_objects
            (id,timestamp,object_id,scene_id,object_type,position,rotation,scale,health)
            VALUES (?,?,?,?,?,?,?,?,?)""",
            (oid, _now(), object_id, scene_id, object_type, pos, rot, scl, health))
    return object_id


def record_view(scene_id: str, user_id: str, duration_sec: float = 0.0,
                 interactions: int = 0) -> str:
    """记录 3D 视图访问"""
    vid = f"view-{int(time.time())}-{uuid.uuid4().hex[:6]}"
    with _conn_lock, _conn() as c:
        c.execute("""INSERT INTO views
            (id,timestamp,view_id,scene_id,user_id,duration_sec,interactions)
            VALUES (?,?,?,?,?,?,?)""",
            (str(uuid.uuid4()), _now(), vid, scene_id, user_id,
             duration_sec, interactions))
    return vid


def start_diagnosis_session(incident_id: str, target_object: str,
                              phase: str = "intake") -> str:
    """启动 VR 故障诊断会话"""
    if phase not in DIAGNOSIS_PHASES:
        phase = "intake"
    sid = str(uuid.uuid4())
    session_id = f"diag-{int(time.time())}-{uuid.uuid4().hex[:6]}"
    with _conn_lock, _conn() as c:
        c.execute("""INSERT INTO diagnosis_sessions
            (id,timestamp,session_id,incident_id,target_object,phase,status)
            VALUES (?,?,?,?,?,?,?)""",
            (sid, _now(), session_id, incident_id, target_object, phase, "active"))
    return session_id


def advance_diagnosis(session_id: str, phase: str, findings: str = "",
                       resolution: str = "", status: str = "active") -> None:
    """推进诊断会话阶段"""
    if phase not in DIAGNOSIS_PHASES:
        phase = "intake"
    if status not in ["active", "paused", "resolved", "escalated"]:
        status = "active"
    with _conn_lock, _conn() as c:
        c.execute("""UPDATE diagnosis_sessions
            SET phase=?, findings=?, resolution=?, status=?
            WHERE session_id=?""", (phase, findings, resolution, status, session_id))


def record_immersive_stream(scene_id: str, user_id: str, metric_name: str,
                              metric_value: float, attention_score: float = 1.0) -> str:
    """记录沉浸式监控数据流"""
    if not 0 <= attention_score <= 1:
        attention_score = 1.0
    sid = str(uuid.uuid4())
    stream_id = f"stream-{int(time.time())}-{uuid.uuid4().hex[:6]}"
    with _conn_lock, _conn() as c:
        c.execute("""INSERT INTO immersive_streams
            (id,timestamp,stream_id,scene_id,user_id,metric_name,metric_value,attention_score)
            VALUES (?,?,?,?,?,?,?,?)""",
            (sid, _now(), stream_id, scene_id, user_id, metric_name,
             metric_value, attention_score))
    return stream_id


def create_collab_session(session_name: str, owner: str,
                            participants: Optional[List[str]] = None,
                            space_type: str = "warroom") -> str:
    """创建协作运维空间"""
    if space_type not in ["warroom", "bridge", "lab", "audit_room", "social"]:
        space_type = "warroom"
    cid = str(uuid.uuid4())
    collab_id = f"collab-{int(time.time())}-{uuid.uuid4().hex[:6]}"
    plist = json.dumps(participants or [])
    with _conn_lock, _conn() as c:
        c.execute("""INSERT INTO collab_sessions
            (id,timestamp,collab_id,session_name,owner,participants,space_type)
            VALUES (?,?,?,?,?,?,?)""",
            (cid, _now(), collab_id, session_name, owner, plist, space_type))
    return collab_id


def post_collab_message(collab_id: str, sender: str, role: str, content: str,
                          is_ai: bool = False) -> str:
    """发布协作消息"""
    if role not in COLLABORATION_ROLES:
        role = "observer"
    mid = str(uuid.uuid4())
    message_id = f"msg-{int(time.time())}-{uuid.uuid4().hex[:6]}"
    with _conn_lock, _conn() as c:
        c.execute("""INSERT INTO collab_messages
            (id,timestamp,message_id,collab_id,sender,role,content,is_ai)
            VALUES (?,?,?,?,?,?,?,?)""",
            (mid, _now(), message_id, collab_id, sender, role, content, 1 if is_ai else 0))
    return message_id


def register_digital_agent(name: str, persona: str = "ops_assistant",
                            skills: Optional[List[str]] = None) -> str:
    """注册 AI 数字员工"""
    if not skills:
        skills = ["diagnose", "communicate"]
    for s in skills:
        if s not in AGENT_SKILLS:
            skills = ["diagnose", "communicate"]
            break
    aid = str(uuid.uuid4())
    agent_id = f"agent-{int(time.time())}-{uuid.uuid4().hex[:6]}"
    with _conn_lock, _conn() as c:
        c.execute("""INSERT INTO digital_agents
            (id,timestamp,agent_id,name,persona,skills,status,conversations)
            VALUES (?,?,?,?,?,?,?,?)""",
            (aid, _now(), agent_id, name, persona, json.dumps(skills), "active", 0))
    return agent_id


def assign_agent_task(agent_id: str, task_type: str, priority: str = "medium") -> str:
    """给 AI 数字员工分配任务"""
    if priority not in ["low", "medium", "high", "critical"]:
        priority = "medium"
    if task_type not in ["diagnose", "remediate", "report", "communicate", "predict"]:
        task_type = "diagnose"
    tid = str(uuid.uuid4())
    task_id = f"task-{int(time.time())}-{uuid.uuid4().hex[:6]}"
    with _conn_lock, _conn() as c:
        c.execute("""INSERT INTO agent_tasks
            (id,timestamp,task_id,agent_id,task_type,priority,status,result)
            VALUES (?,?,?,?,?,?,?,?)""",
            (tid, _now(), task_id, agent_id, task_type, priority, "pending", ""))
    return task_id


def complete_agent_task(task_id: str, result: str = "success") -> None:
    """完成任务"""
    if result not in ["success", "failure", "partial", "skipped"]:
        result = "success"
    with _conn_lock, _conn() as c:
        c.execute("""UPDATE agent_tasks SET status=?, result=? WHERE task_id=?""",
                    ("completed", result, task_id))


def get_metaverse_overview() -> Dict[str, Any]:
    """获取元宇宙运维概览"""
    with _conn_lock, _conn() as c:
        sc = c.execute("SELECT COUNT(*) as c FROM scenes").fetchone()["c"]
        ob = c.execute("SELECT COUNT(*) as c FROM scene_objects").fetchone()["c"]
        vw = c.execute("SELECT COUNT(*) as c FROM views").fetchone()["c"]
        dg = c.execute("SELECT COUNT(*) as c FROM diagnosis_sessions").fetchone()["c"]
        im = c.execute("SELECT COUNT(*) as c FROM immersive_streams").fetchone()["c"]
        cl = c.execute("SELECT COUNT(*) as c FROM collab_sessions").fetchone()["c"]
        cm = c.execute("SELECT COUNT(*) as c FROM collab_messages").fetchone()["c"]
        ag = c.execute("SELECT COUNT(*) as c FROM digital_agents").fetchone()["c"]
        at = c.execute("SELECT COUNT(*) as c FROM agent_tasks").fetchone()["c"]
    return {"scenes": sc, "objects": ob, "views": vw,
            "diagnosis_sessions": dg, "immersive_streams": im,
            "collab_sessions": cl, "collab_messages": cm,
            "digital_agents": ag, "agent_tasks": at}


def _send_dingtalk(title: str, content: str) -> None:
    log_dir = os.path.join(os.path.dirname(__file__), "..", "logs", "mock_webhook")
    os.makedirs(log_dir, exist_ok=True)
    with open(os.path.join(log_dir, "dingtalk.jsonl"), "a", encoding="utf-8") as f:
        f.write(json.dumps({"timestamp": _now(), "title": title, "content": content,
                            "source": "metaverse_ops"}, ensure_ascii=False) + "\n")


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
            self._json(200, {"status": "ok", "service": "metaverse_ops"})
        elif path == "/api/overview":
            self._json(200, get_metaverse_overview())
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
        if path == "/api/scene/create":
            sid = create_scene(
                scene_id=data.get("scene_id", f"sc-{int(time.time())}"),
                scene_type=data.get("scene_type", "datacenter"),
                name=data.get("name", "Untitled"),
                description=data.get("description", ""),
                owner=data.get("owner", "system"),
                visibility=data.get("visibility", "private"),
            )
            self._json(201, {"scene_id": sid})
        elif path == "/api/scene/object":
            oid = add_scene_object(
                scene_id=data.get("scene_id", ""),
                object_id=data.get("object_id", f"obj-{int(time.time())}"),
                object_type=data.get("object_type", "server"),
                position=data.get("position"),
                rotation=data.get("rotation"),
                scale=data.get("scale"),
                health=data.get("health", "healthy"),
            )
            self._json(201, {"object_id": oid})
        elif path == "/api/diagnosis/start":
            sid = start_diagnosis_session(
                incident_id=data.get("incident_id", ""),
                target_object=data.get("target_object", ""),
                phase=data.get("phase", "intake"),
            )
            self._json(201, {"session_id": sid})
        elif path == "/api/collab/create":
            cid = create_collab_session(
                session_name=data.get("session_name", "ops-room"),
                owner=data.get("owner", "system"),
                participants=data.get("participants"),
                space_type=data.get("space_type", "warroom"),
            )
            self._json(201, {"collab_id": cid})
        elif path == "/api/agent/register":
            aid = register_digital_agent(
                name=data.get("name", "OpsBot"),
                persona=data.get("persona", "ops_assistant"),
                skills=data.get("skills"),
            )
            self._json(201, {"agent_id": aid})
        else:
            self._json(404, {"error": "not_found"})


def serve() -> None:
    srv = HTTPServer(("0.0.0.0", HTTP_PORT), _Handler)
    print(f"Metaverse Ops service on :{HTTP_PORT}")
    srv.serve_forever()


def cmd_serve(_args: List[str]) -> None:
    serve()


def cmd_overview(_args: List[str]) -> None:
    print(json.dumps(get_metaverse_overview(), ensure_ascii=False, indent=2))


def cmd_scene(args: List[str]) -> None:
    if len(args) < 3:
        print("usage: scene <scene_id> <type> <name>")
        return
    sid = create_scene(args[0], args[1], args[2])
    print(json.dumps({"scene_id": sid}, ensure_ascii=False))


def cmd_object(args: List[str]) -> None:
    if len(args) < 3:
        print("usage: object <scene_id> <object_id> <type>")
        return
    oid = add_scene_object(args[0], args[1], args[2])
    print(json.dumps({"object_id": oid}, ensure_ascii=False))


def cmd_diagnosis(args: List[str]) -> None:
    if len(args) < 2:
        print("usage: diagnosis <incident_id> <target_object>")
        return
    sid = start_diagnosis_session(args[0], args[1])
    print(json.dumps({"session_id": sid}, ensure_ascii=False))


def cmd_agent(args: List[str]) -> None:
    if not args:
        print("usage: agent <name> [persona] [skill1,skill2,...]")
        return
    name = args[0]
    persona = args[1] if len(args) > 1 else "ops_assistant"
    skills = args[2].split(",") if len(args) > 2 else None
    aid = register_digital_agent(name, persona, skills)
    print(json.dumps({"agent_id": aid}, ensure_ascii=False))


def cmd_collab(args: List[str]) -> None:
    if len(args) < 2:
        print("usage: collab <session_name> <owner>")
        return
    cid = create_collab_session(args[0], args[1])
    print(json.dumps({"collab_id": cid}, ensure_ascii=False))


def main() -> None:
    import sys
    cmds = {"serve": cmd_serve, "overview": cmd_overview, "scene": cmd_scene,
            "object": cmd_object, "diagnosis": cmd_diagnosis, "agent": cmd_agent,
            "collab": cmd_collab}
    cmd = sys.argv[1] if len(sys.argv) > 1 else "serve"
    if cmd not in cmds:
        print(f"usage: {list(cmds.keys())}")
        sys.exit(1)
    cmds[cmd](sys.argv[2:])


if __name__ == "__main__":
    main()
