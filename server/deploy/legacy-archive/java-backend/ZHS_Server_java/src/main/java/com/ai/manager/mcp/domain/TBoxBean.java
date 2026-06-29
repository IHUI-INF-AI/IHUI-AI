package com.ai.manager.mcp.domain;
import io.swagger.v3.oas.annotations.media.Schema;
import lombok.*;

import java.io.Serializable;

/**
 * 智能体发布事件通知顶层Bean
 *
 * @author 豆包编程助手
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@ToString
@Schema(name = "百宝箱实体")
public class TBoxBean implements Serializable {
    private static final long serialVersionUID = 1L;

    /**
     * 随机数
     */
    @Schema(description = "随机数")
    private Long nonce;

    /**
     * 创建时间戳
     */
    @Schema(description = "创建时间戳")
    private Long create_timestamp;

    /**
     * 通知时间戳
     */
    @Schema(description = "通知时间戳")
    private Long notify_timestamp;

    /**
     * 事件id
     */
    @Schema(description = "事件id")
    private String event_id;

    /**
     * 事件类型（示例：platform.agent_publish）
     */
    @Schema(description = "事件类型（示例：platform.agent_publish）")
    private String event_type;

    /**
     * 事件内容（智能体发布核心信息）
     */
    @Schema(description = "事件内容（智能体发布核心信息）")
    private TBoxAgentContentBean event_content;

    @Schema(description = "事件内容（智能体发布核心信息）")
    private TBoxAgentContentBean custom_param;

    /**
     * 签名
     */
    @Schema(description = "签名")
    private String sign;
}