# AiJimengApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**jimeng4ImageApiV1AiJimeng4Post**](AiJimengApi.md#jimeng4ImageApiV1AiJimeng4Post) | **POST** /api/v1/ai/jimeng4 | 即梦 4.0 文字生成图片（兼容旧路径） |


<a id="jimeng4ImageApiV1AiJimeng4Post"></a>
# **jimeng4ImageApiV1AiJimeng4Post**
> Object jimeng4ImageApiV1AiJimeng4Post(jimeng4ImageRequest)

即梦 4.0 文字生成图片（兼容旧路径）

Submit a JiMeng 4.0 image generation task via CVSync2Async, poll until complete, and return image URLs / base64 data.

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.AiJimengApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    AiJimengApi apiInstance = new AiJimengApi(defaultClient);
    Jimeng4ImageRequest jimeng4ImageRequest = new Jimeng4ImageRequest(); // Jimeng4ImageRequest | 
    try {
      Object result = apiInstance.jimeng4ImageApiV1AiJimeng4Post(jimeng4ImageRequest);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling AiJimengApi#jimeng4ImageApiV1AiJimeng4Post");
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
| **jimeng4ImageRequest** | [**Jimeng4ImageRequest**](Jimeng4ImageRequest.md)|  | |

### Return type

**Object**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

