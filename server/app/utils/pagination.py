"""通用分页工具."""


from sqlalchemy.orm import Query


def paginate(query: Query, page: int = 1, size: int = 20) -> tuple[list, int]:
    """对 SQLAlchemy Query 做分页, 返回 (items, total)."""
    if page < 1:
        page = 1
    if size < 1:
        size = 1
    if size > 200:
        size = 200
    total = query.count()
    items = query.offset((page - 1) * size).limit(size).all()
    return list(items), total
