package com.ai.manager.mcp.domain;
import io.swagger.v3.oas.annotations.media.Schema;
import lombok.*;

import java.io.Serializable;
import java.util.List;
import java.util.Map;

/**
 * 智能体发布事件内容Bean
 *
 * @author 豆包编程助手
 */
@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
@ToString
@Schema(name = "agent实体")
public class TBoxAgentContentBean implements Serializable {
    private static final long serialVersionUID = 1L;

    /**
     * 智能体所属空间id
     */
    @Schema(description = "智能体所属空间id")
    private String tenant_id;

    /**
     * 智能体id
     */
    @Schema(description = "智能体id")
    private String agent_id;

    /**
     * 智能体名称
     */
    @Schema(description = "智能体名称")
    private String agent_name;

    /**
     * 智能体图标（临时文件链接，需转存）
     */
    @Schema(description = "智能体图标（临时文件链接，需转存）")
    private String icon;

    /**
     * 智能体描述信息
     */
    @Schema(description = "智能体描述信息")
    private String description;

    /**
     * 智能体版本
     */
    @Schema(description = "智能体版本")
    private String version;

    /**
     * 智能体创建用户id（企业版用户id，非支付宝2088开头）
     */
    @Schema(description = "智能体创建用户id（企业版用户id，非支付宝2088开头）")
    private String creator_id;

    /**
     * 智能体创建者名称（示例：xxxxx公司）
     */
    @Schema(description = "智能体创建者名称（示例：xxxxx公司）")
    private String creator_name;

    /**
     * 自定义参数（渠道方透传信息）
     * "custom_param":{
     *     // 用于携带渠道方的一些特殊信息用于平台之间的透传
     *     "custom_key":"xxx"
     * }
     */
    @Schema(description = "自定义参数（渠道方透传信息）")
    private TBoxAgentCustomBean custom_param;

    /**
     * 智能体技能列表（默认不开放，需联系接入）
     */
    @Schema(description = "智能体技能列表（默认不开放，需联系接入）")
    private List<Object> agent_skills;

    /**
     * 百宝箱智能体操作人id，是百宝箱的用户id
     */
    @Schema(description = "智能体技能列表（默认不开放，需联系接入）")
    private List<Object> operator_id;
}