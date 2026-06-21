# UserModelChatApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**imageApiV1UserModelChatImagePost**](UserModelChatApi.md#imageApiV1UserModelChatImagePost) | **POST** /api/v1/user-model-chat/image | AI模型生图 |
| [**imageApiV1UserModelChatImagePost_0**](UserModelChatApi.md#imageApiV1UserModelChatImagePost_0) | **POST** /api/v1/user-model-chat/image | AI模型生图 |
| [**listModelsApiV1UserModelChatListGet**](UserModelChatApi.md#listModelsApiV1UserModelChatListGet) | **GET** /api/v1/user-model-chat/list | 可用模型列表 |
| [**listModelsApiV1UserModelChatListGet_0**](UserModelChatApi.md#listModelsApiV1UserModelChatListGet_0) | **GET** /api/v1/user-model-chat/list | 可用模型列表 |
| [**userModelChatChat**](UserModelChatApi.md#userModelChatChat) | **POST** /api/v1/user-model-chat/chat | AI模型对话 |
| [**userModelChatChat_0**](UserModelChatApi.md#userModelChatChat_0) | **POST** /api/v1/user-model-chat/chat | AI模型对话 |


<a id="imageApiV1UserModelChatImagePost"></a>
# **imageApiV1UserModelChatImagePost**
> Object imageApiV1UserModelChatImagePost(bodyImageApiV1UserModelChatImagePost, apiKey, apiBase)

AI模型生图

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.UserModelChatApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    UserModelChatApi apiInstance = new UserModelChatApi(defaultClient);
    BodyImageApiV1UserModelChatImagePost bodyImageApiV1UserModelChatImagePost = new BodyImageApiV1UserModelChatImagePost(); // BodyImageApiV1UserModelChatImagePost | 
    String apiKey = "apiKey_example"; // String | 
    String apiBase = "apiBase_example"; // String | 
    try {
      Object result = apiInstance.imageApiV1UserModelChatImagePost(bodyImageApiV1UserModelChatImagePost, apiKey, apiBase);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling UserModelChatApi#imageApiV1UserModelChatImagePost");
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
| **bodyImageApiV1UserModelChatImagePost** | [**BodyImageApiV1UserModelChatImagePost**](BodyImageApiV1UserModelChatImagePost.md)|  | |
| **apiKey** | **String**|  | [optional] |
| **apiBase** | **String**|  | [optional] |

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

<a id="imageApiV1UserModelChatImagePost_0"></a>
# **imageApiV1UserModelChatImagePost_0**
> Object imageApiV1UserModelChatImagePost_0(bodyImageApiV1UserModelChatImagePost, apiKey, apiBase)

AI模型生图

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.UserModelChatApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    UserModelChatApi apiInstance = new UserModelChatApi(defaultClient);
    BodyImageApiV1UserModelChatImagePost bodyImageApiV1UserModelChatImagePost = new BodyImageApiV1UserModelChatImagePost(); // BodyImageApiV1UserModelChatImagePost | 
    String apiKey = "apiKey_example"; // String | 
    String apiBase = "apiBase_example"; // String | 
    try {
      Object result = apiInstance.imageApiV1UserModelChatImagePost_0(bodyImageApiV1UserModelChatImagePost, apiKey, apiBase);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling UserModelChatApi#imageApiV1UserModelChatImagePost_0");
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
| **bodyImageApiV1UserModelChatImagePost** | [**BodyImageApiV1UserModelChatImagePost**](BodyImageApiV1UserModelChatImagePost.md)|  | |
| **apiKey** | **String**|  | [optional] |
| **apiBase** | **String**|  | [optional] |

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

<a id="listModelsApiV1UserModelChatListGet"></a>
# **listModelsApiV1UserModelChatListGet**
> Object listModelsApiV1UserModelChatListGet()

可用模型列表

获取支持的AI模型列表

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.UserModelChatApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    UserModelChatApi apiInstance = new UserModelChatApi(defaultClient);
    try {
      Object result = apiInstance.listModelsApiV1UserModelChatListGet();
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling UserModelChatApi#listModelsApiV1UserModelChatListGet");
      System.err.println("Status code: " + e.getCode());
      System.err.println("Reason: " + e.getResponseBody());
      System.err.println("Response headers: " + e.getResponseHeaders());
      e.printStackTrace();
    }
  }
}
```

### Parameters
This endpoint does not need any parameter.

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

<a id="listModelsApiV1UserModelChatListGet_0"></a>
# **listModelsApiV1UserModelChatListGet_0**
> Object listModelsApiV1UserModelChatListGet_0()

可用模型列表

获取支持的AI模型列表

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.UserModelChatApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    UserModelChatApi apiInstance = new UserModelChatApi(defaultClient);
    try {
      Object result = apiInstance.listModelsApiV1UserModelChatListGet_0();
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling UserModelChatApi#listModelsApiV1UserModelChatListGet_0");
      System.err.println("Status code: " + e.getCode());
      System.err.println("Reason: " + e.getResponseBody());
      System.err.println("Response headers: " + e.getResponseHeaders());
      e.printStackTrace();
    }
  }
}
```

### Parameters
This endpoint does not need any parameter.

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

<a id="userModelChatChat"></a>
# **userModelChatChat**
> Object userModelChatChat(bodyUserModelChatChat, apiKey, apiBase)

AI模型对话

用户直接调用AI模型对话（不绑定Agent）

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.UserModelChatApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    UserModelChatApi apiInstance = new UserModelChatApi(defaultClient);
    BodyUserModelChatChat bodyUserModelChatChat = new BodyUserModelChatChat(); // BodyUserModelChatChat | 
    String apiKey = "apiKey_example"; // String | 
    String apiBase = "apiBase_example"; // String | 
    try {
      Object result = apiInstance.userModelChatChat(bodyUserModelChatChat, apiKey, apiBase);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling UserModelChatApi#userModelChatChat");
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
| **bodyUserModelChatChat** | [**BodyUserModelChatChat**](BodyUserModelChatChat.md)|  | |
| **apiKey** | **String**|  | [optional] |
| **apiBase** | **String**|  | [optional] |

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

<a id="userModelChatChat_0"></a>
# **userModelChatChat_0**
> Object userModelChatChat_0(bodyUserModelChatChat, apiKey, apiBase)

AI模型对话

用户直接调用AI模型对话（不绑定Agent）

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.UserModelChatApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    UserModelChatApi apiInstance = new UserModelChatApi(defaultClient);
    BodyUserModelChatChat bodyUserModelChatChat = new BodyUserModelChatChat(); // BodyUserModelChatChat | 
    String apiKey = "apiKey_example"; // String | 
    String apiBase = "apiBase_example"; // String | 
    try {
      Object result = apiInstance.userModelChatChat_0(bodyUserModelChatChat, apiKey, apiBase);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling UserModelChatApi#userModelChatChat_0");
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
| **bodyUserModelChatChat** | [**BodyUserModelChatChat**](BodyUserModelChatChat.md)|  | |
| **apiKey** | **String**|  | [optional] |
| **apiBase** | **String**|  | [optional] |

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

