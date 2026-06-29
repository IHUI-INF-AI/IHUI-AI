package com.ai.manager.small.domain;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.*;
import org.apache.commons.lang3.time.DateFormatUtils;

import java.io.Serializable;

/**
 * 用户关于智能体上下文对象 zhs_user_agent_context
 * 
 * @author Raindrop_L
 * @date 2025-06-20
 */

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@ToString
public class ZhsUserAgentContext implements Serializable
{
    private static final long serialVersionUID = 1L;

    /** 主键 */
    @Schema(description = "主键")
    private String id;

    /** agent_id */
    @Schema(description = "agent_id")
    private String agentId;

    /** 用户唯一主键 */
    @Schema(description = "用户唯一主键")
    private String userUuid;

    /** 用户发送的问题 */
    @Schema(description = "用户发送的问题")
    private String problem;

    /** 智能体回答 */
    @Schema(description = "智能体回答")
    private String answer;

    /** 用户上传文件路径 分割：, */
    @Schema(description = "用户上传文件路径 分割：,")
    private String userUrl;

    /** 智能体回答文件 分割：, */
    @Schema(description = "智能体回答文件 分割：, ")
    private String agentUrl;

    /** 消息发送时间：秒值 */
    @Schema(description = "消息发送时间：秒值")
    private Long sendTime;

    /** 备用字段 */
    @Schema(description = "备用字段")
    private String field1;


    @Schema(description = "大模型名称")
    private String modelName;
    @Schema(description = "对话id")
    private String chatId;
    @Schema(description = "比例")
    private String videoRatio;

    @Schema(description = "大模型图片")
    private String avatar;

    public String getSendTimeStr(){
        return DateFormatUtils.format(sendTime * 1000, "YYYY-MM-dd HH:mm:dd");
    }

}
