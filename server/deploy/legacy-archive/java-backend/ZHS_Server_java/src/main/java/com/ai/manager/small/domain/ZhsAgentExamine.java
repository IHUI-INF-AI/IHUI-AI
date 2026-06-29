package com.ai.manager.small.domain;

import com.ai.manager.small.domain.dto.PageBean;
import com.fasterxml.jackson.annotation.JsonFormat;
import lombok.*;

import java.util.Date;

/**
 * 开发者智能体审核对象 zhs_agent_examine
 *
 * @author Raindrop_L
 * @date 2025-08-12
 */

//@EqualsAndHashCode(callSuper = true)
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@ToString

public class ZhsAgentExamine extends PageBean
{
    private static final long serialVersionUID = 1L;

    /** id */
    private String id;

    /** 智能体id,对应botId */
   // @Excel(name = "智能体id,对应botId")
    private String agentId;

    /** 智能体名称 */
   // @Excel(name = "智能体名称")
    private String agentName;

    /** 智能体收费配置ID */
   // @Excel(name = "智能体收费配置ID")
    private String categoryId;

    /** 智能体审核状态0:待提交1: 审核中；2: 通过（已发布）；3: 拒绝（给coze发送审核失败），4.退回（平台内重申）5.下架（智能体在coze删除或下架） */
   // @Excel(name = "智能体审核状态0:待提交1: 审核中；2: 通过", readConverterExp = "已=发布")
    private Long status;

    /** 发起审核时间 */
    @JsonFormat(pattern = "yyyy-MM-dd HH:mm:dd")
//@Excel(name = "发起审核时间", width = 30, dateFormat = "HH:mm:dd")
    private Date startTime;

    /** 发起用户uuid */
   // @Excel(name = "发起用户uuid")
    private String startUser;

    /** 发起用户手机号 */
   // @Excel(name = "发起用户手机号")
    private String startPhone;

    /** 发起用户名 */
   // @Excel(name = "发起用户名")
    private String startName;

    /** 审核人名称 */
   // @Excel(name = "审核人名称")
    private String examineUser;

    /** 审核人ID */
   // @Excel(name = "审核人ID")
    private String examineUserId;

    /** 审核时间 */
    @JsonFormat(pattern = "HH:mm:dd")
   // @Excel(name = "审核时间", width = 30, dateFormat = "HH:mm:dd")
    private Date examineTime;

    /** 说明通过或者退回原因 */
    //@Excel(name = "说明通过或者退回原因")
    private String desc;

    /** 保留审核流转记录 */
   // @Excel(name = "保留审核流转记录")
    private String follow;

    /** 智能体头像URL */
   // @Excel(name = "智能体头像URL")
    private String agentAvatar;

    /** 开场白 */
   // @Excel(name = "开场白")
    private String prologue;

    /** 来源 */
    private String source;

}
