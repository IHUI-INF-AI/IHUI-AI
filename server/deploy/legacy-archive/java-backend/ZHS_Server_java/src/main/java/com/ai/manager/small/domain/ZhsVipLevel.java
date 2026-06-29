package com.ai.manager.small.domain;

import lombok.*;

import java.io.Serializable;
import java.util.Date;

/**
 * vip等级对象 zhs_vip_level
 * 
 * @author Raindrop_L
 * @date 2025-06-09
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@ToString
@Builder
public class ZhsVipLevel implements Serializable
{
    private static final long serialVersionUID = 1L;

    /** UUID */
    private String id;

    /** 会员标头 */
    private String title;

    /** 会员级别 */
    private Integer level;

    /** 经验条 */
    private Integer progress;

    /** 预留字段1 */
    private String model1;

    /** 预留字段2 */
    private String model2;

    /** 创建者 */
    private String creator;

    /** 创建时间 */
    private Date createdTime;

    /** 修改者 */
    private String updator;

    /** 修改时间 */
    private Date updatedTime;

    /** 修改时间 */
    private String remark;
}
