# CozeReviewApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**getReviewStatusApiV1CozeReviewReviewStatusGet**](CozeReviewApi.md#getReviewStatusApiV1CozeReviewReviewStatusGet) | **GET** /api/v1/coze/review/review/status | Get Review Status |
| [**getReviewStatusApiV1CozeReviewReviewStatusGet_0**](CozeReviewApi.md#getReviewStatusApiV1CozeReviewReviewStatusGet_0) | **GET** /api/v1/coze/review/review/status | Get Review Status |
| [**updateReviewResultApiV1CozeReviewReviewUpdateReviewResultPost**](CozeReviewApi.md#updateReviewResultApiV1CozeReviewReviewUpdateReviewResultPost) | **POST** /api/v1/coze/review/review/update_review_result | Update Review Result |
| [**updateReviewResultApiV1CozeReviewReviewUpdateReviewResultPost_0**](CozeReviewApi.md#updateReviewResultApiV1CozeReviewReviewUpdateReviewResultPost_0) | **POST** /api/v1/coze/review/review/update_review_result | Update Review Result |


<a id="getReviewStatusApiV1CozeReviewReviewStatusGet"></a>
# **getReviewStatusApiV1CozeReviewReviewStatusGet**
> Object getReviewStatusApiV1CozeReviewReviewStatusGet(botId, connectorId)

Get Review Status

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.CozeReviewApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    CozeReviewApi apiInstance = new CozeReviewApi(defaultClient);
    String botId = "botId_example"; // String | 
    String connectorId = "connectorId_example"; // String | 
    try {
      Object result = apiInstance.getReviewStatusApiV1CozeReviewReviewStatusGet(botId, connectorId);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling CozeReviewApi#getReviewStatusApiV1CozeReviewReviewStatusGet");
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
| **botId** | **String**|  | |
| **connectorId** | **String**|  | |

### Return type

**Object**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

<a id="getReviewStatusApiV1CozeReviewReviewStatusGet_0"></a>
# **getReviewStatusApiV1CozeReviewReviewStatusGet_0**
> Object getReviewStatusApiV1CozeReviewReviewStatusGet_0(botId, connectorId)

Get Review Status

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.CozeReviewApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    CozeReviewApi apiInstance = new CozeReviewApi(defaultClient);
    String botId = "botId_example"; // String | 
    String connectorId = "connectorId_example"; // String | 
    try {
      Object result = apiInstance.getReviewStatusApiV1CozeReviewReviewStatusGet_0(botId, connectorId);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling CozeReviewApi#getReviewStatusApiV1CozeReviewReviewStatusGet_0");
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
| **botId** | **String**|  | |
| **connectorId** | **String**|  | |

### Return type

**Object**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

<a id="updateReviewResultApiV1CozeReviewReviewUpdateReviewResultPost"></a>
# **updateReviewResultApiV1CozeReviewReviewUpdateReviewResultPost**
> UpdateReviewResp updateReviewResultApiV1CozeReviewReviewUpdateReviewResultPost(updateReviewReq)

Update Review Result

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.CozeReviewApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    CozeReviewApi apiInstance = new CozeReviewApi(defaultClient);
    UpdateReviewReq updateReviewReq = new UpdateReviewReq(); // UpdateReviewReq | 
    try {
      UpdateReviewResp result = apiInstance.updateReviewResultApiV1CozeReviewReviewUpdateReviewResultPost(updateReviewReq);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling CozeReviewApi#updateReviewResultApiV1CozeReviewReviewUpdateReviewResultPost");
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
| **updateReviewReq** | [**UpdateReviewReq**](UpdateReviewReq.md)|  | |

### Return type

[**UpdateReviewResp**](UpdateReviewResp.md)

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

<a id="updateReviewResultApiV1CozeReviewReviewUpdateReviewResultPost_0"></a>
# **updateReviewResultApiV1CozeReviewReviewUpdateReviewResultPost_0**
> UpdateReviewResp updateReviewResultApiV1CozeReviewReviewUpdateReviewResultPost_0(updateReviewReq)

Update Review Result

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.CozeReviewApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    CozeReviewApi apiInstance = new CozeReviewApi(defaultClient);
    UpdateReviewReq updateReviewReq = new UpdateReviewReq(); // UpdateReviewReq | 
    try {
      UpdateReviewResp result = apiInstance.updateReviewResultApiV1CozeReviewReviewUpdateReviewResultPost_0(updateReviewReq);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling CozeReviewApi#updateReviewResultApiV1CozeReviewReviewUpdateReviewResultPost_0");
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
| **updateReviewReq** | [**UpdateReviewReq**](UpdateReviewReq.md)|  | |

### Return type

[**UpdateReviewResp**](UpdateReviewResp.md)

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

