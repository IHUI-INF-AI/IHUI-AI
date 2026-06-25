
from fastapi import APIRouter, HTTPException
from loguru import logger
from pydantic import BaseModel

from app.utils.coze_compat import CozeClient

router = APIRouter(prefix="/variables", tags=["Coze Variables"])


class CreateVarReq(BaseModel):
    connector_id: str
    keyword: str
    value: str
    type: str | None = "string"


class UpdateVarReq(BaseModel):
    connector_id: str
    variable_id: str
    value: str


class DeleteVarReq(BaseModel):
    connector_id: str
    variable_id: str


@router.get("/retrieve")
async def retrieve_variable(connector_id: str, variable_id: str):
    try:
        async with CozeClient() as coze:
            return await coze.retrieve_variable(connector_id, variable_id)
    except Exception as e:
        logger.error("Retrieve variable error: " + str(e))
        raise HTTPException(status_code=500, detail="服务内部错误,请稍后重试") from e


@router.get("/list")
async def list_variables(connector_id: str, page: int = 1, size: int = 20):
    try:
        async with CozeClient() as coze:
            return await coze.list_variables(connector_id, page, size)
    except Exception as e:
        logger.error("List variables error: " + str(e))
        raise HTTPException(status_code=500, detail="服务内部错误,请稍后重试") from e


@router.post("/update")
async def update_variable(req: UpdateVarReq):
    try:
        async with CozeClient() as coze:
            return await coze.update_variable(
                {"connector_id": req.connector_id, "variable_id": req.variable_id, "value": req.value}
            )
    except Exception as e:
        logger.error("Update variable error: " + str(e))
        raise HTTPException(status_code=500, detail="服务内部错误,请稍后重试") from e


@router.post("/create")
async def create_variable(req: CreateVarReq):
    try:
        async with CozeClient() as coze:
            return await coze.create_variable(
                {"connector_id": req.connector_id, "keyword": req.keyword, "value": req.value, "type": req.type}
            )
    except Exception as e:
        logger.error("Create variable error: " + str(e))
        raise HTTPException(status_code=500, detail="服务内部错误,请稍后重试") from e


@router.post("/delete")
async def delete_variable(req: DeleteVarReq):
    try:
        async with CozeClient() as coze:
            return await coze.delete_variable(req.connector_id, req.variable_id)
    except Exception as e:
        logger.error("Delete variable error: " + str(e))
        raise HTTPException(status_code=500, detail="服务内部错误,请稍后重试") from e
