# AiSunoApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**generateMusicApiV1AiSunoGenerateMusicPost**](AiSunoApi.md#generateMusicApiV1AiSunoGenerateMusicPost) | **POST** /api/v1/ai/suno/generate/music | Suno AI 音乐生成 |
| [**queryMusicApiV1AiSunoQueryMusicTaskIdGet**](AiSunoApi.md#queryMusicApiV1AiSunoQueryMusicTaskIdGet) | **GET** /api/v1/ai/suno/query/music/{task_id} | 查询Suno音乐任务状态 |


<a id="generateMusicApiV1AiSunoGenerateMusicPost"></a>
# **generateMusicApiV1AiSunoGenerateMusicPost**
> Object generateMusicApiV1AiSunoGenerateMusicPost(generateMusicRequest)

Suno AI 音乐生成

Submit a music generation task via the Suno API. Returns task ID that can be polled with /query/music.  Suno API flow (matching original langchain_api_mini.py): 1. POST to create task -&gt; returns task_id 2. GET to poll task status until completed

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.AiSunoApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    AiSunoApi apiInstance = new AiSunoApi(defaultClient);
    GenerateMusicRequest generateMusicRequest = new GenerateMusicRequest(); // GenerateMusicRequest | 
    try {
      Object result = apiInstance.generateMusicApiV1AiSunoGenerateMusicPost(generateMusicRequest);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling AiSunoApi#generateMusicApiV1AiSunoGenerateMusicPost");
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
| **generateMusicRequest** | [**GenerateMusicRequest**](GenerateMusicRequest.md)|  | |

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

<a id="queryMusicApiV1AiSunoQueryMusicTaskIdGet"></a>
# **queryMusicApiV1AiSunoQueryMusicTaskIdGet**
> Object queryMusicApiV1AiSunoQueryMusicTaskIdGet(taskId)

查询Suno音乐任务状态

Poll the status of a Suno music generation task.  Returns the music URLs when completed.

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.AiSunoApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    AiSunoApi apiInstance = new AiSunoApi(defaultClient);
    String taskId = "taskId_example"; // String | 
    try {
      Object result = apiInstance.queryMusicApiV1AiSunoQueryMusicTaskIdGet(taskId);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling AiSunoApi#queryMusicApiV1AiSunoQueryMusicTaskIdGet");
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

