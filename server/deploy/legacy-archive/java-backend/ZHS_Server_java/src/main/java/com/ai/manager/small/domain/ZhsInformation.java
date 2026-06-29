package com.ai.manager.small.domain;

import lombok.Data;
import lombok.ToString;
import org.apache.http.client.utils.DateUtils;

import java.util.Date;

/**
 * AI资讯库对象 zhs_information
 * 
 * @author ljd
 * @date 2025-05-27
 */
@Data
@ToString
public class ZhsInformation
{
    private static final long serialVersionUID = 1L;

    /** UUID */
    private String id;

    /** 标题 */
    private String title;

    /** 内容 */
    private String content;

    /** 字典表UUID */
    private String type;

    /** 图片/视频路径 */
    private String url;

    /** 出处名称 */
    private String sourceName;

    /** 出处路径 */
    private String sourceUrl;

    /** 出处作者 */
    private String sourceCreator;

    /** 出处时间 */
    private Date sourceTime;
    public void setSourceTime(String sourceTime) {
        // 2025-05-27T00:00:00T+0800TCST+08:00
        // dd MMM yyyy HH:mm:ss zzz
        String[] formats = {"yyyy-MM-dd'T'HH:mm:ss"};
        this.sourceTime = DateUtils.parseDate(sourceTime,formats);
    }
    public void setSourceTime(Date sourceTime) {
        this.sourceTime = sourceTime;
    }

    /** 插入时间 */
    private Long insertTime;
    private String insertTimeStr;

    /** 浏览次数 */
    private Long browse;

    /** 创建人 */
    private Long creator;

    /** 创建时间 */
    private Date createdTime;

    public void setCreatedTime(String createdTime) {
        this.createdTime = DateUtils.parseDate(createdTime);
    }
    public void setCreatedTime(Date createdTime) {
        this.createdTime = createdTime;
    }

    /** 修改人 */
    private Long update;
    private Date updateTime;
    public void setUpdateTime(String updateTime) {
        this.updateTime = DateUtils.parseDate(updateTime);
    }
    public void setUpdateTime(Date updateTime) {
        this.updateTime = updateTime;
    }
    private String creatorName;

    private Integer informationType = 0; // 资讯类型 0资讯；1非咨询

}
