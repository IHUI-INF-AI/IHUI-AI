"""
审计日志服务
记录用户操作、文件访问、权限变更等
"""
import logging
from datetime import datetime

from pydantic import BaseModel
from sqlalchemy import text

from app.services.database_service import engine

logger = logging.getLogger(__name__)


class AuditLogCreate(BaseModel):
    user_id: str | None = None
    action: str
    resource_type: str | None = None
    resource_id: str | None = None
    details: str | None = None
    ip_address: str | None = None
    user_agent: str | None = None
    status: str = 'success'
    error_message: str | None = None


class AuditLogService:
    @staticmethod
    def create_log(log_data: AuditLogCreate) -> bool:
        """创建审计日志"""
        try:
            with engine.connect() as conn:
                conn.execute(
                    text("""
                        INSERT INTO audit_logs
                        (user_id, action, resource_type, resource_id, details,
                         ip_address, user_agent, status, error_message, created_at)
                        VALUES
                        (:user_id, :action, :resource_type, :resource_id, :details,
                         :ip_address, :user_agent, :status, :error_message, :created_at)
                    """),
                    {
                        "user_id": log_data.user_id,
                        "action": log_data.action,
                        "resource_type": log_data.resource_type,
                        "resource_id": log_data.resource_id,
                        "details": log_data.details,
                        "ip_address": log_data.ip_address,
                        "user_agent": log_data.user_agent,
                        "status": log_data.status,
                        "error_message": log_data.error_message,
                        "created_at": datetime.utcnow()
                    }
                )
                conn.commit()
            return True
        except Exception as e:
            logger.error(f"创建审计日志失败: {e}")
            return False

    @staticmethod
    def get_logs(
        user_id: str | None = None,
        action: str | None = None,
        resource_type: str | None = None,
        resource_id: str | None = None,
        status: str | None = None,
        start_date: datetime | None = None,
        end_date: datetime | None = None,
        page: int = 1,
        page_size: int = 20
    ) -> list[dict]:
        """查询审计日志"""
        try:
            conditions = []
            params = {"offset": (page - 1) * page_size, "limit": page_size}

            if user_id:
                conditions.append("user_id = :user_id")
                params["user_id"] = user_id
            if action:
                conditions.append("action = :action")
                params["action"] = action
            if resource_type:
                conditions.append("resource_type = :resource_type")
                params["resource_type"] = resource_type
            if resource_id:
                conditions.append("resource_id = :resource_id")
                params["resource_id"] = resource_id
            if status:
                conditions.append("status = :status")
                params["status"] = status
            if start_date:
                conditions.append("created_at >= :start_date")
                params["start_date"] = start_date
            if end_date:
                conditions.append("created_at <= :end_date")
                params["end_date"] = end_date

            where_clause = " AND ".join(conditions) if conditions else "1=1"

            with engine.connect() as conn:
                result = conn.execute(
                    text(f"""
                        SELECT id, user_id, action, resource_type, resource_id,
                               details, ip_address, user_agent, status, error_message, created_at
                        FROM audit_logs
                        WHERE {where_clause}
                        ORDER BY created_at DESC
                        LIMIT :limit OFFSET :offset
                    """),
                    params
                )
                logs = []
                for row in result:
                    logs.append({
                        "id": row[0],
                        "user_id": row[1],
                        "action": row[2],
                        "resource_type": row[3],
                        "resource_id": row[4],
                        "details": row[5],
                        "ip_address": row[6],
                        "user_agent": row[7],
                        "status": row[8],
                        "error_message": row[9],
                        "created_at": row[10].isoformat() if row[10] else None
                    })
                return logs
        except Exception as e:
            logger.error(f"查询审计日志失败: {e}")
            return []

    @staticmethod
    def get_log_stats(
        start_date: datetime | None = None,
        end_date: datetime | None = None
    ) -> dict:
        """获取审计日志统计"""
        try:
            conditions = []
            params = {}

            if start_date:
                conditions.append("created_at >= :start_date")
                params["start_date"] = start_date
            if end_date:
                conditions.append("created_at <= :end_date")
                params["end_date"] = end_date

            where_clause = " AND ".join(conditions) if conditions else "1=1"

            with engine.connect() as conn:
                total_result = conn.execute(
                    text(f"SELECT COUNT(*) FROM audit_logs WHERE {where_clause}"),
                    params
                )
                total = total_result.scalar()

                action_result = conn.execute(
                    text(f"""
                        SELECT action, COUNT(*) as count
                        FROM audit_logs
                        WHERE {where_clause}
                        GROUP BY action
                        ORDER BY count DESC
                    """),
                    params
                )
                by_action = {row[0]: row[1] for row in action_result}

                status_result = conn.execute(
                    text(f"""
                        SELECT status, COUNT(*) as count
                        FROM audit_logs
                        WHERE {where_clause}
                        GROUP BY status
                    """),
                    params
                )
                by_status = {row[0]: row[1] for row in status_result}

                return {
                    "total": total,
                    "by_action": by_action,
                    "by_status": by_status
                }
        except Exception as e:
            logger.error(f"获取审计日志统计失败: {e}")
            return {"total": 0, "by_action": {}, "by_status": {}}

    @staticmethod
    def delete_old_logs(days: int = 90) -> int:
        """删除旧日志"""
        try:
            cutoff_date = datetime.utcnow().replace(
                hour=0, minute=0, second=0, microsecond=0
            )
            cutoff_date = cutoff_date.replace(day=cutoff_date.day - days)

            with engine.connect() as conn:
                result = conn.execute(
                    text("DELETE FROM audit_logs WHERE created_at < :cutoff_date"),
                    {"cutoff_date": cutoff_date}
                )
                conn.commit()
                return result.rowcount
        except Exception as e:
            logger.error(f"删除旧日志失败: {e}")
            return 0


audit_service = AuditLogService()


def log_action(
    action: str,
    user_id: str | None = None,
    resource_type: str | None = None,
    resource_id: str | None = None,
    details: str | None = None,
    ip_address: str | None = None,
    user_agent: str | None = None,
    status: str = 'success',
    error_message: str | None = None
):
    """记录操作日志的便捷函数"""
    log_data = AuditLogCreate(
        user_id=user_id,
        action=action,
        resource_type=resource_type,
        resource_id=resource_id,
        details=details,
        ip_address=ip_address,
        user_agent=user_agent,
        status=status,
        error_message=error_message
    )
    return audit_service.create_log(log_data)
