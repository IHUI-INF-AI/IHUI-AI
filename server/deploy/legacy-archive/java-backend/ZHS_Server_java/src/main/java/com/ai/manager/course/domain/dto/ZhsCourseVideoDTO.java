package com.ai.manager.course.domain.dto;

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
public class ZhsCourseVideoDTO extends PageBean {
    private static final long serialVersionUID = 1L;

    /**
     * 唯一标识
     */
    @Schema(description = "唯一标识")
    private String id;

    /**
     * 课程唯一标识
     */
    @Schema(description = "课程唯一标识")
    private String courseId;

    /**
     * 封面图
     */
    @Schema(description = "封面图")
    private String binding;

    /**
     * 视频地址
     */
    @Schema(description = "视频地址")
    private String videoPath;

    /**
     * 视频标题
     */
    @Schema(description = "视频标题")
    private String title;

    /**
     * 副标题
     */
    @Schema(description = "副标题")
    private String subtitle;

    /**
     * 正文
     */
    @Schema(description = "正文")
    private String content;

    /**
     * 预计时长 分钟
     */
    @Schema(description = "预计时长 分钟")
    private Integer duration;

    /**
     * 附件连接
     */
    @Schema(description = "附件连接")
    private String adjunctUrl;

    /**
     * 是否需要支付 0免费 | 1付费
     */
    @Schema(description = "是否需要支付 0免费 | 1付费")
    private Integer isPay;

    /**
     * 付费金额 单位：分
     */
    @Schema(description = "付费金额 单位：分")
    private Integer amount;

    /**
     * 阶段状态 0入门 | 1进阶 | 2精通
     */
    @Schema(description = "阶段状态 0入门 | 1进阶 | 2精通")
    private Integer status;

    /**
     * 排序
     */
    @Schema(description = "排序")
    private Integer sort;

    /**
     * 创建人uuid
     */
    @Schema(description = "创建人uuid")
    private String creator;

    /**
     * 创建时间
     */
    @JsonFormat(pattern = "yyyy-MM-dd")
    @Schema(description = "创建时间")
    private Date createdAt;

    /**
     * 修改人uuid
     */
    @Schema(description = "修改人uuid")
    private String updator;

    /**
     * 修改时间
     */
    @JsonFormat(pattern = "yyyy-MM-dd HH:mm:ss")
    @Schema(description = "修改时间")
    private Date updatedAt;

    @Schema(description = "备注")
    private String remark;

    /** 讲师 */
    @Schema(description = "讲师")
    private String lecturer;


    // 点赞
    @Schema(description = "点赞")
    private String endorse;
    // 收藏
    @Schema(description = "收藏")
    private String favorite;

    private String platform;
    private String userUuid;

    private Integer stage;
}
