package com.ai.manager.small.domain.dto;

public class OfficialInformationContentDto {
    private String img;
    private String content;
    private String title;
    private Long createdAt; // 假设是时间戳
    private Long updatedAt; // 假设是时间戳
    private String tag;
    private String date;

    // Getters and Setters
    public String getImg() { return img; }
    public void setImg(String img) { this.img = img; }
    public String getContent() { return content; }
    public void setContent(String content) { this.content = content; }
    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }
    public Long getCreatedAt() { return createdAt; }
    public void setCreatedAt(Long createdAt) { this.createdAt = createdAt; }
    public Long getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Long updatedAt) { this.updatedAt = updatedAt; }
    public String getTag() { return tag; }
    public void setTag(String tag) { this.tag = tag; }
    public String getDate() { return date; }
    public void setDate(String date) { this.date = date; }
}