package com.ai.manager.small.domain;

import com.ai.manager.small.domain.dto.PageBean;
import com.fasterxml.jackson.annotation.JsonFormat;
import lombok.*;

import java.util.Date;

/**
 * App版本管理对象 app_version
 * 
 * @author Raindrop_L
 * @date 2025-12-02
 */

@EqualsAndHashCode(callSuper = true)
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@ToString
public class AppVersion extends PageBean
{
    private static final long serialVersionUID = 1L;

    /** 主键ID */
    private Long id;

    /** 应用唯一标识（如：com.example.myapp） */
    private String appId;

    /** 版本号（数字递增，用于判断更新，如：101） */
    private Integer versionCode;

    /** 版本名称（用户可见，如：1.0.1） */
    private String versionName;

    /** 发布时间 */
    @JsonFormat(pattern = "yyyy-MM-dd HH:mm:dd")
    private Date publishTime;

    /** 是否强制更新（0=否，1=是） */
    private Integer isForceUpdate;

    /** 版本状态（1=有效，0=下架） */
    private Integer status;

    /** 文件存储路径 */
    private String filePath;

    private Integer needUpdate;

}
