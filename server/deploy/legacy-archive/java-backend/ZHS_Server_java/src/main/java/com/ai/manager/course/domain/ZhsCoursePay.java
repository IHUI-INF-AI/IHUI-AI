package com.ai.manager.course.domain;

import com.ai.manager.small.domain.dto.PageBean;
import com.fasterxml.jackson.annotation.JsonFormat;
import io.swagger.v3.oas.annotations.media.Schema;
import lombok.*;

import java.util.Date;

/**
 * 课程价格对象 zhs_course_pay
 *
 * @author Raindrop_L
 * @date 2025-08-29
 */

@EqualsAndHashCode(callSuper = true)
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@ToString
public class ZhsCoursePay extends PageBean {
    private static final long serialVersionUID = 1L;

    /**
     * $column.columnComment
     */
    @Schema(description = "唯一标识")
    private String uuid;

    /**
     * 课程id
     */
    @Schema(description = "课程ID")
    private String courseId;

    /**
     * 课程类型 0免费 | 1限免 | 2收费
     */
    @Schema(description = "课程类型")
    private Long payType;

    /**
     * 免费人群 0全部 | 1会员
     */
    @Schema(description = "免费人群 0全部 | 1会员")
    private Long payCrowd;

    /**
     * 价格 单位：分
     */
    @Schema(description = "价格单位：分")
    private Integer amount;

    /**
     * 创建人
     */
    @Schema(description = "创建人")
    private String creator;

    /**
     * 创建时间
     */
    @JsonFormat(pattern = "yyyy-MM-dd HH:mm:dd")
    @Schema(description = "创建时间")
    private Date createdAt;

    /**
     * 修改人
     */
    @Schema(description = "修改人")
    private String updator;

    /**
     * 修改时间
     */
    @Schema(description = "修改时间")
    private Date updatedAt;

}
