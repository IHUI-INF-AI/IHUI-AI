package com.ai.manager.small.service.impl;

import com.ai.manager.core.config.ResponseResultInfo;
import org.springframework.web.multipart.MultipartFile;

/**
 * 文件上传接口
 * 
 * @author ruoyi
 */
public interface ISysFileService
{
    /**
     * 文件上传接口
     * 
     * @param file 上传的文件
     * @return 访问地址
     * @throws Exception
     */
    public String uploadFile(MultipartFile file) throws Exception;

    /**
     * minio专用 文件指定minio桶名上传接口
     * @param file
     * @param bucketName
     * @return
     * @throws Exception
     */
    public String uploadMinioByBucketName(MultipartFile file,String bucketName) throws Exception;

    public String uploadMinio(byte[] bytes,String fileName);

    ResponseResultInfo<String> fileUploadNetworkPath(String file);
}
