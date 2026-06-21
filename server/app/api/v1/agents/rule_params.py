# Agent rule param management - ported from P2 AgentRuleParamController.java

from fastapi import APIRouter, Query
from loguru import logger
from pydantic import BaseModel

from app.database import get_session
from app.schemas.common import error, success
from app.utils.pagination import paginate

router = APIRouter()


class RuleParamCreate(BaseModel):
    rule_id: int
    param_name: str
    param_value: str | None = None
    param_type: str | None = "string"


class RuleParamUpdate(BaseModel):
    id: int
    rule_id: int | None = None
    param_name: str | None = None
    param_value: str | None = None
    param_type: str | None = None


@router.get("/list", summary="List rule params")
async def list_rule_params(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=200),
    rule_id: int | None = Query(None),
):
    with get_session() as db:
        from app.models.agent_rule_models import AgentRuleParam

        q = db.query(AgentRuleParam)
        if rule_id is not None:
            q = q.filter(AgentRuleParam.rule_id == rule_id)
        q = q.order_by(AgentRuleParam.id.desc())
        items, total = paginate(q, page, limit)
        rows = []
        for i in items:
            rows.append(
                {
                    "id": i.id,
                    "rule_id": i.rule_id,
                    "param_name": i.param_name,
                    "param_value": i.param_value,
                    "param_type": i.param_type,
                    "create_time": str(i.create_time) if i.create_time else None,
                }
            )
        return success({"rows": rows, "total": total})


@router.get("/{item_id}", summary="Get rule param detail")
async def get_rule_param(item_id: int):
    with get_session() as db:
        from app.models.agent_rule_models import AgentRuleParam

        item = db.query(AgentRuleParam).filter(AgentRuleParam.id == item_id).first()
        if not item:
            return error("Not found", "404")
        return success(
            {
                "id": item.id,
                "rule_id": item.rule_id,
                "param_name": item.param_name,
                "param_value": item.param_value,
                "param_type": item.param_type,
                "create_time": str(item.create_time) if item.create_time else None,
            }
        )


@router.post("/", summary="Create rule param")
async def create_rule_param(body: RuleParamCreate):
    with get_session() as db:
        try:
            from app.models.agent_rule_models import AgentRuleParam

            item = AgentRuleParam(
                rule_id=body.rule_id,
                param_name=body.param_name,
                param_value=body.param_value,
                param_type=body.param_type,
            )
            db.add(item)
            db.commit()
            db.refresh(item)
            return success({"id": item.id})
        except Exception as e:
            logger.error("Create rule param error: " + str(e))
            return error(str(e))


@router.put("/", summary="Update rule param")
async def update_rule_param(body: RuleParamUpdate):
    with get_session() as db:
        try:
            from app.models.agent_rule_models import AgentRuleParam

            item = db.query(AgentRuleParam).filter(AgentRuleParam.id == body.id).first()
            if not item:
                return error("Not found", "404")
            if body.rule_id is not None:
                item.rule_id = body.rule_id
            if body.param_name is not None:
                item.param_name = body.param_name
            if body.param_value is not None:
                item.param_value = body.param_value
            if body.param_type is not None:
                item.param_type = body.param_type
            db.commit()
            return success()
        except Exception as e:
            logger.error("Update rule param error: " + str(e))
            return error(str(e))


@router.delete("/{item_ids}", summary="Delete rule params")
async def delete_rule_params(item_ids: str):
    with get_session() as db:
        try:
            from app.models.agent_rule_models import AgentRuleParam

            ids = [int(x) for x in item_ids.split(",") if x.strip()]
            db.query(AgentRuleParam).filter(AgentRuleParam.id.in_(ids)).delete(synchronize_session=False)
            db.commit()
            return success()
        except Exception as e:
            logger.error("Delete rule param error: " + str(e))
            return error(str(e))
