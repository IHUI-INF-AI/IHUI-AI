# CozeChatAudioApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**oneToOneAudioApiV1CozeChatAudioChatAudioOneToOnePost**](CozeChatAudioApi.md#oneToOneAudioApiV1CozeChatAudioChatAudioOneToOnePost) | **POST** /api/v1/coze/chat-audio/chat-audio/one-to-one | One To One Audio |
| [**oneToOneAudioApiV1CozeChatAudioChatAudioOneToOnePost_0**](CozeChatAudioApi.md#oneToOneAudioApiV1CozeChatAudioChatAudioOneToOnePost_0) | **POST** /api/v1/coze/chat-audio/chat-audio/one-to-one | One To One Audio |
| [**pluginAudioChatApiV1CozeChatAudioChatAudioPluginPost**](CozeChatAudioApi.md#pluginAudioChatApiV1CozeChatAudioChatAudioPluginPost) | **POST** /api/v1/coze/chat-audio/chat-audio/plugin | Plugin Audio Chat |
| [**pluginAudioChatApiV1CozeChatAudioChatAudioPluginPost_0**](CozeChatAudioApi.md#pluginAudioChatApiV1CozeChatAudioChatAudioPluginPost_0) | **POST** /api/v1/coze/chat-audio/chat-audio/plugin | Plugin Audio Chat |
| [**simpleAudioChatApiV1CozeChatAudioChatAudioSimplePost**](CozeChatAudioApi.md#simpleAudioChatApiV1CozeChatAudioChatAudioSimplePost) | **POST** /api/v1/coze/chat-audio/chat-audio/simple | Simple Audio Chat |
| [**simpleAudioChatApiV1CozeChatAudioChatAudioSimplePost_0**](CozeChatAudioApi.md#simpleAudioChatApiV1CozeChatAudioChatAudioSimplePost_0) | **POST** /api/v1/coze/chat-audio/chat-audio/simple | Simple Audio Chat |


<a id="oneToOneAudioApiV1CozeChatAudioChatAudioOneToOnePost"></a>
# **oneToOneAudioApiV1CozeChatAudioChatAudioOneToOnePost**
> Object oneToOneAudioApiV1CozeChatAudioChatAudioOneToOnePost(oneToOneAudioReq)

One To One Audio

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.CozeChatAudioApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    CozeChatAudioApi apiInstance = new CozeChatAudioApi(defaultClient);
    OneToOneAudioReq oneToOneAudioReq = new OneToOneAudioReq(); // OneToOneAudioReq | 
    try {
      Object result = apiInstance.oneToOneAudioApiV1CozeChatAudioChatAudioOneToOnePost(oneToOneAudioReq);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling CozeChatAudioApi#oneToOneAudioApiV1CozeChatAudioChatAudioOneToOnePost");
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
| **oneToOneAudioReq** | [**OneToOneAudioReq**](OneToOneAudioReq.md)|  | |

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

<a id="oneToOneAudioApiV1CozeChatAudioChatAudioOneToOnePost_0"></a>
# **oneToOneAudioApiV1CozeChatAudioChatAudioOneToOnePost_0**
> Object oneToOneAudioApiV1CozeChatAudioChatAudioOneToOnePost_0(oneToOneAudioReq)

One To One Audio

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.CozeChatAudioApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    CozeChatAudioApi apiInstance = new CozeChatAudioApi(defaultClient);
    OneToOneAudioReq oneToOneAudioReq = new OneToOneAudioReq(); // OneToOneAudioReq | 
    try {
      Object result = apiInstance.oneToOneAudioApiV1CozeChatAudioChatAudioOneToOnePost_0(oneToOneAudioReq);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling CozeChatAudioApi#oneToOneAudioApiV1CozeChatAudioChatAudioOneToOnePost_0");
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
| **oneToOneAudioReq** | [**OneToOneAudioReq**](OneToOneAudioReq.md)|  | |

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

<a id="pluginAudioChatApiV1CozeChatAudioChatAudioPluginPost"></a>
# **pluginAudioChatApiV1CozeChatAudioChatAudioPluginPost**
> Object pluginAudioChatApiV1CozeChatAudioChatAudioPluginPost(pluginAudioReq)

Plugin Audio Chat

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.CozeChatAudioApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    CozeChatAudioApi apiInstance = new CozeChatAudioApi(defaultClient);
    PluginAudioReq pluginAudioReq = new PluginAudioReq(); // PluginAudioReq | 
    try {
      Object result = apiInstance.pluginAudioChatApiV1CozeChatAudioChatAudioPluginPost(pluginAudioReq);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling CozeChatAudioApi#pluginAudioChatApiV1CozeChatAudioChatAudioPluginPost");
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
| **pluginAudioReq** | [**PluginAudioReq**](PluginAudioReq.md)|  | |

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

<a id="pluginAudioChatApiV1CozeChatAudioChatAudioPluginPost_0"></a>
# **pluginAudioChatApiV1CozeChatAudioChatAudioPluginPost_0**
> Object pluginAudioChatApiV1CozeChatAudioChatAudioPluginPost_0(pluginAudioReq)

Plugin Audio Chat

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.CozeChatAudioApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    CozeChatAudioApi apiInstance = new CozeChatAudioApi(defaultClient);
    PluginAudioReq pluginAudioReq = new PluginAudioReq(); // PluginAudioReq | 
    try {
      Object result = apiInstance.pluginAudioChatApiV1CozeChatAudioChatAudioPluginPost_0(pluginAudioReq);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling CozeChatAudioApi#pluginAudioChatApiV1CozeChatAudioChatAudioPluginPost_0");
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
| **pluginAudioReq** | [**PluginAudioReq**](PluginAudioReq.md)|  | |

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

<a id="simpleAudioChatApiV1CozeChatAudioChatAudioSimplePost"></a>
# **simpleAudioChatApiV1CozeChatAudioChatAudioSimplePost**
> Object simpleAudioChatApiV1CozeChatAudioChatAudioSimplePost(simpleAudioReq)

Simple Audio Chat

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.CozeChatAudioApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    CozeChatAudioApi apiInstance = new CozeChatAudioApi(defaultClient);
    SimpleAudioReq simpleAudioReq = new SimpleAudioReq(); // SimpleAudioReq | 
    try {
      Object result = apiInstance.simpleAudioChatApiV1CozeChatAudioChatAudioSimplePost(simpleAudioReq);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling CozeChatAudioApi#simpleAudioChatApiV1CozeChatAudioChatAudioSimplePost");
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
| **simpleAudioReq** | [**SimpleAudioReq**](SimpleAudioReq.md)|  | |

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

<a id="simpleAudioChatApiV1CozeChatAudioChatAudioSimplePost_0"></a>
# **simpleAudioChatApiV1CozeChatAudioChatAudioSimplePost_0**
> Object simpleAudioChatApiV1CozeChatAudioChatAudioSimplePost_0(simpleAudioReq)

Simple Audio Chat

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.CozeChatAudioApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    CozeChatAudioApi apiInstance = new CozeChatAudioApi(defaultClient);
    SimpleAudioReq simpleAudioReq = new SimpleAudioReq(); // SimpleAudioReq | 
    try {
      Object result = apiInstance.simpleAudioChatApiV1CozeChatAudioChatAudioSimplePost_0(simpleAudioReq);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling CozeChatAudioApi#simpleAudioChatApiV1CozeChatAudioChatAudioSimplePost_0");
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
| **simpleAudioReq** | [**SimpleAudioReq**](SimpleAudioReq.md)|  | |

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

