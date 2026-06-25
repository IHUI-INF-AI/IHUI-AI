"""第三方设备 - TBox/IoT设备管理"""

from fastapi import APIRouter, Query
from loguru import logger
from sqlalchemy import BigInteger, Boolean, Column, DateTime, Index, Integer, String, Text

from app.database import Base, get_session
from app.models.base import TimestampMixin
from app.schemas.common import error, success
from app.utils.datetime_helper import utcnow


class TboxDevice(TimestampMixin, Base):
    """TBox 设备"""
    __tablename__ = "tbox_device"
    __table_args__ = (
        Index("idx_td_device_no", "device_no"),
        Index("idx_td_user", "user_id"),
        Index("idx_td_status", "status"),
    )
    id = Column(BigInteger, primary_key=True, autoincrement=True)
    device_no = Column(String(100), unique=True, nullable=False, comment="设备编号")
    device_name = Column(String(100), nullable=True, comment="设备名称")
    device_type = Column(String(50), default="tbox", comment="设备类型: tbox/dashcam/obu/iot")
    model = Column(String(50), nullable=True)
    brand = Column(String(50), nullable=True)
    user_id = Column(String(64), nullable=True, comment="绑定用户")
    user_name = Column(String(100), nullable=True)
    iccid = Column(String(50), nullable=True, comment="SIM卡号")
    imei = Column(String(50), nullable=True, comment="IMEI")
    firmware = Column(String(50), nullable=True, comment="固件版本")
    is_online = Column(Boolean, default=False, comment="是否在线")
    last_online_time = Column(DateTime, nullable=True)
    last_offline_time = Column(DateTime, nullable=True)
    signal_strength = Column(Integer, default=0, comment="信号强度0-100")
    battery = Column(Integer, default=0, comment="电量0-100")
    location = Column(String(200), nullable=True, comment="位置信息")
    status = Column(Integer, default=1, comment="0=未激活 1=正常 2=故障 3=停用")
    activated_at = Column(DateTime, nullable=True, comment="激活时间")


class TboxCommand(TimestampMixin, Base):
    """TBox 控制指令"""
    __tablename__ = "tbox_command"
    __table_args__ = (
        Index("idx_tc_device", "device_no"),
        Index("idx_tc_status", "status"),
    )
    id = Column(BigInteger, primary_key=True, autoincrement=True)
    device_no = Column(String(100), nullable=False)
    command = Column(String(50), nullable=False, comment="指令类型: reboot/lock/unlock/upgrade")
    params = Column(Text, nullable=True, comment="指令参数")
    status = Column(Integer, default=0, comment="0=待执行 1=执行中 2=成功 3=失败")
    response = Column(Text, nullable=True, comment="设备响应")
    send_time = Column(DateTime, nullable=True)
    complete_time = Column(DateTime, nullable=True)


router = APIRouter()


@router.get("/device/list", summary="设备列表")
async def list_devices(page: int = Query(1, ge=1), limit: int = Query(20, ge=1, le=100),
                        user_id: str | None = None, device_type: str | None = None,
                        status: int | None = None, is_online: bool | None = None):
    with get_session() as db:
        try:
            q = db.query(TboxDevice)
            if user_id:
                q = q.filter(TboxDevice.user_id == user_id)
            if device_type:
                q = q.filter(TboxDevice.device_type == device_type)
            if status is not None:
                q = q.filter(TboxDevice.status == status)
            if is_online is not None:
                q = q.filter(TboxDevice.is_online == is_online)
            total = q.count()
            items = q.order_by(TboxDevice.id.desc()).offset((page - 1) * limit).limit(limit).all()
            return success([{
                "id": d.id, "device_no": d.device_no, "device_name": d.device_name,
                "device_type": d.device_type, "model": d.model, "brand": d.brand,
                "user_id": d.user_id, "iccid": d.iccid, "imei": d.imei,
                "firmware": d.firmware, "is_online": d.is_online,
                "last_online_time": d.last_online_time.isoformat() if d.last_online_time else None,
                "signal_strength": d.signal_strength, "battery": d.battery,
                "location": d.location, "status": d.status,
                "activated_at": d.activated_at.isoformat() if d.activated_at else None,
            } for d in items], total=total)
        except Exception as e:
            logger.error(f"tbox device list error: {e}")
            return error(str(e))


@router.get("/device/{device_no}", summary="设备详情")
async def get_device(device_no: str):
    with get_session() as db:
        try:
            d = db.query(TboxDevice).filter(TboxDevice.device_no == device_no).first()
            if not d:
                return error("设备不存在", "404")
            return success({
                "id": d.id, "device_no": d.device_no, "device_name": d.device_name,
                "device_type": d.device_type, "model": d.model, "brand": d.brand,
                "user_id": d.user_id, "iccid": d.iccid, "imei": d.imei,
                "firmware": d.firmware, "is_online": d.is_online,
                "signal_strength": d.signal_strength, "battery": d.battery,
                "location": d.location, "status": d.status,
            })
        except Exception as e:
            logger.error(f"tbox device get error: {e}")
            return error(str(e))


@router.post("/device", summary="注册设备")
async def register_device(device_no: str = Query(...), device_name: str | None = None,
                           device_type: str = "tbox", model: str | None = None,
                           brand: str | None = None, iccid: str | None = None,
                           imei: str | None = None, firmware: str | None = None):
    with get_session() as db:
        try:
            d = db.query(TboxDevice).filter(TboxDevice.device_no == device_no).first()
            if d:
                return error("设备已存在", "400")
            d = TboxDevice(
                device_no=device_no, device_name=device_name,
                device_type=device_type, model=model, brand=brand,
                iccid=iccid, imei=imei, firmware=firmware,
                status=0,
            )
            db.add(d)
            db.flush()
            return success({"id": d.id})
        except Exception as e:
            logger.error(f"tbox device register error: {e}")
            return error(str(e))


@router.post("/device/{device_no}/activate", summary="激活设备")
async def activate_device(device_no: str, user_id: str = Query(...),
                            user_name: str | None = None):
    with get_session() as db:
        try:
            d = db.query(TboxDevice).filter(TboxDevice.device_no == device_no).first()
            if not d:
                return error("设备不存在", "404")
            d.user_id = user_id
            d.user_name = user_name or "匿名用户"
            d.status = 1
            d.activated_at = utcnow()
            return success()
        except Exception as e:
            logger.error(f"tbox device activate error: {e}")
            return error(str(e))


@router.post("/device/heartbeat", summary="设备心跳")
async def heartbeat(device_no: str = Query(...),
                     is_online: bool = True,
                     signal_strength: int = 0, battery: int = 0,
                     location: str | None = None):
    with get_session() as db:
        try:
            d = db.query(TboxDevice).filter(TboxDevice.device_no == device_no).first()
            if not d:
                return error("设备不存在", "404")
            d.is_online = is_online
            d.signal_strength = signal_strength
            d.battery = battery
            d.location = location
            if is_online:
                d.last_online_time = utcnow()
            else:
                d.last_offline_time = utcnow()
            return success()
        except Exception as e:
            logger.error(f"tbox heartbeat error: {e}")
            return error(str(e))


@router.post("/device/{device_no}/command", summary="下发指令")
async def send_command(device_no: str, command: str = Query(...),
                        params: str | None = None):
    with get_session() as db:
        try:
            d = db.query(TboxDevice).filter(TboxDevice.device_no == device_no).first()
            if not d:
                return error("设备不存在", "404")
            c = TboxCommand(
                device_no=device_no, command=command, params=params,
                status=0, send_time=utcnow(),
            )
            db.add(c)
            db.flush()
            return success({"id": c.id})
        except Exception as e:
            logger.error(f"tbox command error: {e}")
            return error(str(e))


@router.get("/command/list", summary="指令列表")
async def list_commands(page: int = Query(1, ge=1), limit: int = Query(20, ge=1, le=100),
                        device_no: str | None = None, status: int | None = None):
    with get_session() as db:
        try:
            q = db.query(TboxCommand)
            if device_no:
                q = q.filter(TboxCommand.device_no == device_no)
            if status is not None:
                q = q.filter(TboxCommand.status == status)
            total = q.count()
            items = q.order_by(TboxCommand.id.desc()).offset((page - 1) * limit).limit(limit).all()
            return success([{
                "id": c.id, "device_no": c.device_no, "command": c.command,
                "params": c.params, "status": c.status, "response": c.response,
                "send_time": c.send_time.isoformat() if c.send_time else None,
                "complete_time": c.complete_time.isoformat() if c.complete_time else None,
            } for c in items], total=total)
        except Exception as e:
            logger.error(f"tbox command list error: {e}")
            return error(str(e))
