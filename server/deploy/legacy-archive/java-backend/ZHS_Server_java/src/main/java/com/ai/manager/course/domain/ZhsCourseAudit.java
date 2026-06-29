package com.ai.manager.course.domain;

import com.fasterxml.jackson.annotation.JsonFormat;
import lombok.*;

import java.io.Serializable;
import java.util.Date;

/**
 * 课程审批对象 zhs_course_audit
 * 
 * @author Raindrop_L
 * @date 2025-09-06
 */

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@ToString
public class ZhsCourseAudit implements Serializable
{
    private static final long serialVersionUID = 1L;

    /** $column.columnComment */
    private String id;

    /** 审批类型 0课程 1 视频 */
    
    private Integer type;

    /** 审批 0发布 | 1修改  | 2 删除 */
    
    private Integer operate;

    /** 原始数据 */
    
    private String sourceId;

    /** 修改后数据 */
    
    private String targetId;

    /** 审批状态 0待审批 | 1整改 | 2驳回 | 3通过 */
    
    private Integer status;

    /** 发布人 */
    
    private String creator;

    /** 修改时间 */
    @JsonFormat(pattern = "yyyy-MM-dd HH:mm:dd")
    
    private Date createdAt;

    /** 审批人 */
    
    private String updator;

    /** 审批时间 */
    private Date updatedAt;


    private String remark;

}
