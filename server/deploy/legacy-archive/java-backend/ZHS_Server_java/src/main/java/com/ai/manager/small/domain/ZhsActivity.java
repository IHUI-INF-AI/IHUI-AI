package com.ai.manager.small.domain;

import lombok.*;

import java.util.Date;

/**
 * 活动对象 zhs_activity
 * 
 * @author raindrop_l
 * @date 2025-06-05
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@ToString
public class ZhsActivity
{
    private static final long serialVersionUID = 1L;

    /** UUID */
    private String id;

    /** 活动名称 */
    private String activityName;

    /** 活动规则说明 */
    private String activityRule;

    /** 活动充值说明 */
    private String activityRecharge;

    /** 充值倍数【正整数】 */
    private Integer multiple;

    /** 一元赠送的金额 */
    private Long computing;

    /** 活动开始时间 */
    private Date beginTime;

    /** 活动结算时间 */
    private Date endTime;

    /** 活动状态；0关闭 | 1启用 */
    private Long status;

    /** 创建人 */
    private String creator;

    /** 创建时间 */
    private Date createdTime;

    /** 修改人 */
    private String updator;

    /** 修改时间 */
    private Date updatedTime;

    private Integer beginAmount;
}
