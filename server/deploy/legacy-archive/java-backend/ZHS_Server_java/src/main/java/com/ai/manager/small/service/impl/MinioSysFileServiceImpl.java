package com.ai.manager.small.service.impl;

import com.ai.manager.core.config.MinioConfig;
import com.ai.manager.core.config.ResponseResultInfo;
import io.minio.MinioClient;
import io.minio.PutObjectArgs;
import lombok.SneakyThrows;
import org.apache.http.client.utils.DateUtils;
import org.apache.tomcat.util.http.fileupload.IOUtils;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Primary;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.ByteArrayInputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.Date;
import java.util.UUID;

/**
 * Minio 文件存储
 *
 * @author ruoyi
 */
@Primary
@Service
public class MinioSysFileServiceImpl implements ISysFileService
{
    @Autowired
    private MinioConfig minioConfig;

    @Autowired
    private MinioClient client;

    @Value("${minio.bucketName}")
    private String bucketName;

    /**
     * Minio文件上传接口
     *
     * @param file 上传的文件
     * @return 访问地址
     * @throws Exception
     */
    @Override
    public String uploadFile(MultipartFile file) throws Exception
    {
        String bucketName = minioConfig.getBucketName();
        return upload(file,bucketName);
    }

    private String upload(MultipartFile file,String bucketName)  throws Exception{

        InputStream inputStream = null;
        try
        {
            String fileName = extractFilename(file);
            inputStream = file.getInputStream();
            PutObjectArgs args = PutObjectArgs.builder()
                    .bucket(bucketName)
                    .object(fileName)
                    .stream(inputStream, file.getSize(), -1)
                    .contentType(file.getContentType())
                    .build();
            client.putObject(args);
            return minioConfig.getReturnUrl() + "/" + minioConfig.getBucketName() + "/" + fileName;
        }
        catch (Exception e)
        {
            throw new RuntimeException("Minio Failed to upload file", e);
        }
        finally
        {
            IOUtils.closeQuietly(inputStream);
        }
    }

    @Override
    public String uploadMinioByBucketName(MultipartFile file,String bucketName) throws Exception {
        return upload(file,bucketName);
    }

    @Override
    public String uploadMinio(byte[] bytes, String fileName) {
        InputStream inputStream = null;
        try
        {
            fileName = extractFilename(fileName);
            inputStream = new ByteArrayInputStream(bytes);
            PutObjectArgs args = PutObjectArgs.builder()
                    .bucket(bucketName)
                    .object(fileName)
                    .stream(inputStream, bytes.length, -1)
                    .contentType("multipart/form-data")
                    .build();
            client.putObject(args);
            return minioConfig.getReturnUrl() + "/" + minioConfig.getBucketName() + "/" + fileName;
        }
        catch (Exception e)
        {
            throw new RuntimeException("Minio Failed to upload file", e);
        }
        finally
        {
            IOUtils.closeQuietly(inputStream);
        }
    }

    @SneakyThrows
    @Override
    public ResponseResultInfo<String> fileUploadNetworkPath(String agentUrl) {


        // 1. 打开网络流
        URL url = new URL(agentUrl);
        HttpURLConnection conn = (HttpURLConnection) url.openConnection();
        conn.setRequestMethod("GET");
        int i = agentUrl.lastIndexOf("?");
        if(i == -1){
            i = agentUrl.length();
        }
        String filename = UUID.randomUUID().toString() + agentUrl.substring(agentUrl.lastIndexOf("."), i);

        try (InputStream inputStream = conn.getInputStream()) {
            // 2. 获取文件大小（可选）
            long fileSize = conn.getContentLengthLong();

            // 3. 流式上传到 MinIO
            PutObjectArgs args = PutObjectArgs.builder()
                    .bucket(bucketName)
                    .object(filename)
                    .stream(inputStream, fileSize, -1)  // -1 表示未知大小
                    .contentType(conn.getContentType()) // 自动获取 MIME
                    .build();

            client.putObject(args);
        } finally {
            conn.disconnect();
        }

//        return minioConfig.getReturnUrl() + "/" + minioConfig.getBucketName() + "/" + agentUrl;
        return ResponseResultInfo.success(minioConfig.getReturnUrl() + "/" + minioConfig.getBucketName() + "/" + filename);

    }

    public static String extractFilename(MultipartFile file)
    {
        return extractFilename(file.getOriginalFilename());
    }
    public static String extractFilename(String file)
    {
        return String.format("%s_%s.%s", /*Base64Util.encode(file)*/ file.substring(0,file.lastIndexOf(".")),
                DateUtils.formatDate(new Date(),"yyyyMMddHHmmss") , file.substring(file.lastIndexOf(".")+1));
    }


}
