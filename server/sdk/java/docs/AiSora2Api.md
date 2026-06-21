# AiSora2Api

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**generateVideoApiV1AiSora2GenerateVideoPost**](AiSora2Api.md#generateVideoApiV1AiSora2GenerateVideoPost) | **POST** /api/v1/ai/sora2/generate/video | Sora2/Veo AI 视频生成 |
| [**queryVideoApiV1AiSora2VideoTaskIdGet**](AiSora2Api.md#queryVideoApiV1AiSora2VideoTaskIdGet) | **GET** /api/v1/ai/sora2/video/{task_id} | 查询Sora2视频生成任务状态 |


<a id="generateVideoApiV1AiSora2GenerateVideoPost"></a>
# **generateVideoApiV1AiSora2GenerateVideoPost**
> Object generateVideoApiV1AiSora2GenerateVideoPost(generateVideoRequest)

Sora2/Veo AI 视频生成

Submit a video generation task via the yunwu.ai proxy.  Flow (matching original luyala_proxy.py): 1. POST to create video task -&gt; returns task id 2. Sync poll for up to 5 minutes (30 x 10s) 3. If not done, return pending + continue background poll for 10 minutes

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.AiSora2Api;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    AiSora2Api apiInstance = new AiSora2Api(defaultClient);
    GenerateVideoRequest generateVideoRequest = new GenerateVideoRequest(); // GenerateVideoRequest | 
    try {
      Object result = apiInstance.generateVideoApiV1AiSora2GenerateVideoPost(generateVideoRequest);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling AiSora2Api#generateVideoApiV1AiSora2GenerateVideoPost");
      System.err.println("Status code: " + e.getCode());
      System.err.println("Reason: " + e.getResponseBody());
      System.err.println("Response headers: " + e.getResponseHeaders());
      e.printStackTrace();
    }
  }
}
```

### Parameters

| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **generateVideoRequest** | [**GenerateVideoRequest**](GenerateVideoRequest.md)|  | |

### Return type

**Object**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

<a id="queryVideoApiV1AiSora2VideoTaskIdGet"></a>
# **queryVideoApiV1AiSora2VideoTaskIdGet**
> Object queryVideoApiV1AiSora2VideoTaskIdGet(taskId)

查询Sora2视频生成任务状态

Query the status and result of a Sora 2 video generation task.

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.AiSora2Api;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    AiSora2Api apiInstance = new AiSora2Api(defaultClient);
    String taskId = "taskId_example"; // String | 
    try {
      Object result = apiInstance.queryVideoApiV1AiSora2VideoTaskIdGet(taskId);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling AiSora2Api#queryVideoApiV1AiSora2VideoTaskIdGet");
      System.err.println("Status code: " + e.getCode());
      System.err.println("Reason: " + e.getResponseBody());
      System.err.println("Response headers: " + e.getResponseHeaders());
      e.printStackTrace();
    }
  }
}
```

### Parameters

| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **taskId** | **String**|  | |

### Return type

**Object**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

