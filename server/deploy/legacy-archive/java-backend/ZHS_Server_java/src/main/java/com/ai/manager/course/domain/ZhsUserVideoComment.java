package com.ai.manager.course.domain;

import com.ai.manager.small.domain.dto.PageBean;
import com.fasterxml.jackson.annotation.JsonFormat;
import io.swagger.v3.oas.annotations.media.Schema;
import lombok.*;

import java.util.Date;
import java.util.List;

@EqualsAndHashCode(callSuper = true)
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@ToString
public class ZhsUserVideoComment extends PageBean {
    private static final long serialVersionUID = 1L;

    /**
     * $column.columnComment
     */
    @Schema(description = "评论id")
    private String id;

    /**
     * 课程视频唯一标识
     */
    @Schema(description = "课程视频唯一标识")
    private String videoId;

    /**
     * 用户唯一标识
     */
    @Schema(description = "用户唯一标识")
    private String userUuid;

    /**
     * 评论正文
     */
    @Schema(description = "评论正文")
    private String content;

    /**
     * 评论附件或者表情包地址，逗号分割（预留字段）
     */
    @Schema(description = "评论附件或者表情包地址，逗号分割（预留字段）")
    private String path;

    /**
     * 上级评论唯一标识
     */
    @Schema(description = "上级评论唯一标识")
    private String parentId;

    /**
     * 逻辑隐藏 0显示 | 1隐藏
     */
    @Schema(description = "逻辑隐藏 0显示 | 1隐藏")
    private Integer isHidden;

    /**
     * 逻辑删除 0保留 | 1删除
     */
    @Schema(description = "逻辑删除 0保留 | 1删除")
    private Integer isDel;

    /**
     * 创建时间
     */
    @Schema(description = "创建时间")
    @JsonFormat(pattern = "yyyy-MM-dd")
    private Date createdAt;

    @Schema(description = "评论列表")
    private List<ZhsUserVideoComment>  videoComments;
    @Schema(description = "不进行查询的评论id，逗号分割")
    private String notQueryIds;

    private String nickname;
    private String avatar;
}
