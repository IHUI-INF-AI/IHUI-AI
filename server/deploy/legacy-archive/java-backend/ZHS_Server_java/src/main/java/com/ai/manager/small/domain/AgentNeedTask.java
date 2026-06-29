package com.ai.manager.small.domain;

import com.ai.manager.small.domain.dto.PageBean;
import com.ai.manager.small.domain.vo.AgentCategoryVO;
import com.fasterxml.jackson.annotation.JsonFormat;
import lombok.*;

import java.util.Date;
import java.util.List;

/**
 * 智能体需求任务对象 agent_need_task
 * 
 * @author Raindrop_L
 * @date 2025-08-15
 */

@EqualsAndHashCode(callSuper = true)
@Data
@NoArgsConstructor
@AllArgsConstructor
@ToString
public class AgentNeedTask extends PageBean
{
    private static final long serialVersionUID = 1L;

    /**  */
    private String id;

    /** 智能体种类id */
    private String type;

    /** 赛道id */
    private String category;

    /** 标题 */
    private String title;

    /** 正文 */
    private String context;

    /** 图片路径英文逗号分割 */
    private String imgs;

    /** 最低价格 单位：分 */
    private Long lowestPrice;

    /** 最高价格 单位：分 */
    private Long peakPrice;

    /** 周期 */
    private Integer cycle;

    /** 周期单位 0天| 1周 | 2月 | 3年 */
    private Long cycleUnit;

    /** 截止时间 yyyy-MM-dd */
    @JsonFormat(pattern = "yyyy-MM-dd")
    private Date closingTime;

    /** 任务状态 0待审批 | 1驳回 | 2审批通过 | 3沟通中 | 4开发中 | 5交接中 | 5已完成 */
    private Integer status;

    /** 是否隐藏 0不隐藏 | 1隐藏 */
    private Long isHidden;

    /** 是否删除 0不删除 | 1删除 */
    private Long isDel;

    /** 排序字段 */
    private Long sort;

    /** 是否置顶 */
    private Long isTop;

    /** 创建人（发布者） */
    private String creator;

    /** 创建时间 */
    @JsonFormat(pattern = "yyyy-MM-dd hh:mm:dd")
    private Date createdAt;

    /** 审核人 */
    private String reviewer;

    /** 审核时间 */
    @JsonFormat(pattern = "yyyy-MM-dd hh:mm:dd")
    private Date reviewerAt;

    /** 邀请二维码 */
    private String invitationCode;

    private String typeName;
    private String categoryName;

    private List<AgentCategoryVO> typeList;
    private List<AgentCategoryVO> categoryList;

    private String createdName;
    private String avatar;

    private String remark;

}
