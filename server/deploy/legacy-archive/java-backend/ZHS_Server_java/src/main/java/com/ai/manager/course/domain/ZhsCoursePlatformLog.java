package com.ai.manager.course.domain;

import com.ai.manager.small.domain.dto.PageBean;
import com.fasterxml.jackson.annotation.JsonFormat;
import io.swagger.v3.oas.annotations.media.Schema;
import lombok.*;

import java.util.Date;

@EqualsAndHashCode(callSuper = true)
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@ToString
public class ZhsCoursePlatformLog extends PageBean
{
    private static final long serialVersionUID = 1L;

    /** $column.columnComment */
    @Schema(description = "主键")
    private String id;

    /** 平台唯一标识 */
    @Schema(description = "平台唯一标识")
    private String platformId;

    /** 课程唯一标识 */
    @Schema(description = "课程唯一标识")
    private String courseId;

    /** 视频唯一标识 */
    @Schema(description = "视频唯一标识")
    private String videoId;

    /** 关联类型 0视频 | 1课程 */
    @Schema(description = "关联类型 0视频 | 1课程")
    private Integer type;

    /** 用户创建人 */
    @Schema(description = "用户创建人")
    private String creator;

    /** 管理员创建人 */
    @Schema(description = "管理员创建人")
    private String sysCreator;

    /** 创建时间 */
    @JsonFormat(pattern = "yyyy-MM-dd")
    @Schema(description = "创建时间")
    private Date createdAt;

}
