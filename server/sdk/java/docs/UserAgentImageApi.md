# UserAgentImageApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**createImageApiV1UserAgentImagePost**](UserAgentImageApi.md#createImageApiV1UserAgentImagePost) | **POST** /api/v1/user-agent-image | 记录图片交互 |
| [**createImageApiV1UserAgentImagePost_0**](UserAgentImageApi.md#createImageApiV1UserAgentImagePost_0) | **POST** /api/v1/user-agent-image | 记录图片交互 |
| [**deleteImageApiV1UserAgentImageIidDelete**](UserAgentImageApi.md#deleteImageApiV1UserAgentImageIidDelete) | **DELETE** /api/v1/user-agent-image/{iid} | 删除图片记录 |
| [**deleteImageApiV1UserAgentImageIidDelete_0**](UserAgentImageApi.md#deleteImageApiV1UserAgentImageIidDelete_0) | **DELETE** /api/v1/user-agent-image/{iid} | 删除图片记录 |
| [**getImageApiV1UserAgentImageIidGet**](UserAgentImageApi.md#getImageApiV1UserAgentImageIidGet) | **GET** /api/v1/user-agent-image/{iid} | 图片详情 |
| [**getImageApiV1UserAgentImageIidGet_0**](UserAgentImageApi.md#getImageApiV1UserAgentImageIidGet_0) | **GET** /api/v1/user-agent-image/{iid} | 图片详情 |
| [**listImagesApiV1UserAgentImageListGet**](UserAgentImageApi.md#listImagesApiV1UserAgentImageListGet) | **GET** /api/v1/user-agent-image/list | 我的图片交互 |
| [**listImagesApiV1UserAgentImageListGet_0**](UserAgentImageApi.md#listImagesApiV1UserAgentImageListGet_0) | **GET** /api/v1/user-agent-image/list | 我的图片交互 |


<a id="createImageApiV1UserAgentImagePost"></a>
# **createImageApiV1UserAgentImagePost**
> Object createImageApiV1UserAgentImagePost(imageUrl, imageType, agentId, agentName, prompt, model, taskId, status, cost, width, height, size)

记录图片交互

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.UserAgentImageApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    UserAgentImageApi apiInstance = new UserAgentImageApi(defaultClient);
    String imageUrl = "imageUrl_example"; // String | 
    String imageType = "input"; // String | 
    String agentId = "agentId_example"; // String | 
    String agentName = "agentName_example"; // String | 
    String prompt = "prompt_example"; // String | 
    String model = "model_example"; // String | 
    String taskId = "taskId_example"; // String | 
    Integer status = 1; // Integer | 
    Integer cost = 0; // Integer | 
    Integer width = 0; // Integer | 
    Integer height = 0; // Integer | 
    Integer size = 0; // Integer | 
    try {
      Object result = apiInstance.createImageApiV1UserAgentImagePost(imageUrl, imageType, agentId, agentName, prompt, model, taskId, status, cost, width, height, size);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling UserAgentImageApi#createImageApiV1UserAgentImagePost");
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
| **imageUrl** | **String**|  | |
| **imageType** | **String**|  | [optional] [default to input] |
| **agentId** | **String**|  | [optional] |
| **agentName** | **String**|  | [optional] |
| **prompt** | **String**|  | [optional] |
| **model** | **String**|  | [optional] |
| **taskId** | **String**|  | [optional] |
| **status** | **Integer**|  | [optional] [default to 1] |
| **cost** | **Integer**|  | [optional] [default to 0] |
| **width** | **Integer**|  | [optional] [default to 0] |
| **height** | **Integer**|  | [optional] [default to 0] |
| **size** | **Integer**|  | [optional] [default to 0] |

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

<a id="createImageApiV1UserAgentImagePost_0"></a>
# **createImageApiV1UserAgentImagePost_0**
> Object createImageApiV1UserAgentImagePost_0(imageUrl, imageType, agentId, agentName, prompt, model, taskId, status, cost, width, height, size)

记录图片交互

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.UserAgentImageApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    UserAgentImageApi apiInstance = new UserAgentImageApi(defaultClient);
    String imageUrl = "imageUrl_example"; // String | 
    String imageType = "input"; // String | 
    String agentId = "agentId_example"; // String | 
    String agentName = "agentName_example"; // String | 
    String prompt = "prompt_example"; // String | 
    String model = "model_example"; // String | 
    String taskId = "taskId_example"; // String | 
    Integer status = 1; // Integer | 
    Integer cost = 0; // Integer | 
    Integer width = 0; // Integer | 
    Integer height = 0; // Integer | 
    Integer size = 0; // Integer | 
    try {
      Object result = apiInstance.createImageApiV1UserAgentImagePost_0(imageUrl, imageType, agentId, agentName, prompt, model, taskId, status, cost, width, height, size);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling UserAgentImageApi#createImageApiV1UserAgentImagePost_0");
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
| **imageUrl** | **String**|  | |
| **imageType** | **String**|  | [optional] [default to input] |
| **agentId** | **String**|  | [optional] |
| **agentName** | **String**|  | [optional] |
| **prompt** | **String**|  | [optional] |
| **model** | **String**|  | [optional] |
| **taskId** | **String**|  | [optional] |
| **status** | **Integer**|  | [optional] [default to 1] |
| **cost** | **Integer**|  | [optional] [default to 0] |
| **width** | **Integer**|  | [optional] [default to 0] |
| **height** | **Integer**|  | [optional] [default to 0] |
| **size** | **Integer**|  | [optional] [default to 0] |

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

<a id="deleteImageApiV1UserAgentImageIidDelete"></a>
# **deleteImageApiV1UserAgentImageIidDelete**
> Object deleteImageApiV1UserAgentImageIidDelete(iid)

删除图片记录

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.UserAgentImageApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    UserAgentImageApi apiInstance = new UserAgentImageApi(defaultClient);
    Integer iid = 56; // Integer | 
    try {
      Object result = apiInstance.deleteImageApiV1UserAgentImageIidDelete(iid);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling UserAgentImageApi#deleteImageApiV1UserAgentImageIidDelete");
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
| **iid** | **Integer**|  | |

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

<a id="deleteImageApiV1UserAgentImageIidDelete_0"></a>
# **deleteImageApiV1UserAgentImageIidDelete_0**
> Object deleteImageApiV1UserAgentImageIidDelete_0(iid)

删除图片记录

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.UserAgentImageApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    UserAgentImageApi apiInstance = new UserAgentImageApi(defaultClient);
    Integer iid = 56; // Integer | 
    try {
      Object result = apiInstance.deleteImageApiV1UserAgentImageIidDelete_0(iid);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling UserAgentImageApi#deleteImageApiV1UserAgentImageIidDelete_0");
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
| **iid** | **Integer**|  | |

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

<a id="getImageApiV1UserAgentImageIidGet"></a>
# **getImageApiV1UserAgentImageIidGet**
> Object getImageApiV1UserAgentImageIidGet(iid)

图片详情

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.UserAgentImageApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    UserAgentImageApi apiInstance = new UserAgentImageApi(defaultClient);
    Integer iid = 56; // Integer | 
    try {
      Object result = apiInstance.getImageApiV1UserAgentImageIidGet(iid);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling UserAgentImageApi#getImageApiV1UserAgentImageIidGet");
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
| **iid** | **Integer**|  | |

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

<a id="getImageApiV1UserAgentImageIidGet_0"></a>
# **getImageApiV1UserAgentImageIidGet_0**
> Object getImageApiV1UserAgentImageIidGet_0(iid)

图片详情

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.UserAgentImageApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    UserAgentImageApi apiInstance = new UserAgentImageApi(defaultClient);
    Integer iid = 56; // Integer | 
    try {
      Object result = apiInstance.getImageApiV1UserAgentImageIidGet_0(iid);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling UserAgentImageApi#getImageApiV1UserAgentImageIidGet_0");
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
| **iid** | **Integer**|  | |

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

<a id="listImagesApiV1UserAgentImageListGet"></a>
# **listImagesApiV1UserAgentImageListGet**
> Object listImagesApiV1UserAgentImageListGet(page, limit, imageType, agentId)

我的图片交互

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.UserAgentImageApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    UserAgentImageApi apiInstance = new UserAgentImageApi(defaultClient);
    Integer page = 1; // Integer | 
    Integer limit = 20; // Integer | 
    String imageType = "imageType_example"; // String | 
    String agentId = "agentId_example"; // String | 
    try {
      Object result = apiInstance.listImagesApiV1UserAgentImageListGet(page, limit, imageType, agentId);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling UserAgentImageApi#listImagesApiV1UserAgentImageListGet");
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
| **page** | **Integer**|  | [optional] [default to 1] |
| **limit** | **Integer**|  | [optional] [default to 20] |
| **imageType** | **String**|  | [optional] |
| **agentId** | **String**|  | [optional] |

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

<a id="listImagesApiV1UserAgentImageListGet_0"></a>
# **listImagesApiV1UserAgentImageListGet_0**
> Object listImagesApiV1UserAgentImageListGet_0(page, limit, imageType, agentId)

我的图片交互

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.UserAgentImageApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    UserAgentImageApi apiInstance = new UserAgentImageApi(defaultClient);
    Integer page = 1; // Integer | 
    Integer limit = 20; // Integer | 
    String imageType = "imageType_example"; // String | 
    String agentId = "agentId_example"; // String | 
    try {
      Object result = apiInstance.listImagesApiV1UserAgentImageListGet_0(page, limit, imageType, agentId);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling UserAgentImageApi#listImagesApiV1UserAgentImageListGet_0");
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
| **page** | **Integer**|  | [optional] [default to 1] |
| **limit** | **Integer**|  | [optional] [default to 20] |
| **imageType** | **String**|  | [optional] |
| **agentId** | **String**|  | [optional] |

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

