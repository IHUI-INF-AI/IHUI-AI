"""触发所有 model 加载,让 Base.metadata 收集到所有表."""

from app.models.activity_models import *  # noqa: F403
from app.models.agent_misc_models import *  # noqa: F403
from app.models.agent_models import *  # noqa: F403
from app.models.agent_rule_models import *  # noqa: F403
from app.models.agent_settlement import *  # noqa: F403
from app.models.ai_gc_models import *  # noqa: F403
from app.models.app_content_models import *  # noqa: F403
from app.models.codegen_models import *  # noqa: F403
from app.models.context_models import *  # noqa: F403
from app.models.course_models import *  # noqa: F403
from app.models.education_ext_models import *  # noqa: F403
from app.models.identity_models import *  # noqa: F403
from app.models.oauth_models import *  # noqa: F403
from app.models.payment_models import *  # noqa: F403
from app.models.resource_models import *  # noqa: F403
from app.models.sys_models import *  # noqa: F403
from app.models.token_models import *  # noqa: F403
from app.models.user_models import *  # noqa: F403
