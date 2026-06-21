"""v1 业务存储 (内存版).

为 v2_admin CRUD 端点提供简单的内存存储, 后续可替换为数据库实现.

函数:
  - get_list(store_key) -> list[dict]
  - create_item(store_key, body) -> dict
  - update_item(store_key, item_id, body) -> dict | None
  - delete_item(store_key, item_id) -> dict | None
"""

from threading import Lock

# 内存存储: {store_key: [record, ...]}
_STORES: dict[str, list[dict]] = {}
_LOCK = Lock()
_SEQ = 0


def _next_id() -> int:
    global _SEQ
    with _LOCK:
        _SEQ += 1
        return _SEQ


def get_list(store_key: str) -> list[dict]:
    """返回某个 store 的全部记录 (浅拷贝)."""
    return [dict(r) for r in _STORES.get(store_key, [])]


def create_item(store_key: str, body: dict) -> dict:
    """创建记录, 自动分配 id."""
    record = dict(body) if isinstance(body, dict) else {}
    record["id"] = _next_id()
    _STORES.setdefault(store_key, []).append(record)
    return dict(record)


def update_item(store_key: str, item_id: int, body: dict) -> dict | None:
    """更新记录, 返回更新后的记录或 None."""
    items = _STORES.get(store_key, [])
    for i, r in enumerate(items):
        if r.get("id") == item_id:
            merged = {**r, **(body if isinstance(body, dict) else {})}
            merged["id"] = item_id
            items[i] = merged
            return dict(merged)
    return None


def delete_item(store_key: str, item_id: int) -> dict | None:
    """删除记录, 返回被删除的记录或 None."""
    items = _STORES.get(store_key, [])
    for i, r in enumerate(items):
        if r.get("id") == item_id:
            return dict(items.pop(i))
    return None
