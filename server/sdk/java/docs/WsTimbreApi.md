# WsTimbreApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**createTimbreApiV1WsTimbreCreatePost**](WsTimbreApi.md#createTimbreApiV1WsTimbreCreatePost) | **POST** /api/v1/ws/timbre/create | 新增音色 |
| [**createTimbreTimbreCreatePost**](WsTimbreApi.md#createTimbreTimbreCreatePost) | **POST** /timbre/create | 新增音色 |
| [**deleteTimbreApiV1WsTimbreDeletePost**](WsTimbreApi.md#deleteTimbreApiV1WsTimbreDeletePost) | **POST** /api/v1/ws/timbre/delete | 删除音色 |
| [**deleteTimbreTimbreDeletePost**](WsTimbreApi.md#deleteTimbreTimbreDeletePost) | **POST** /timbre/delete | 删除音色 |
| [**listTimbresApiV1WsTimbreListGet**](WsTimbreApi.md#listTimbresApiV1WsTimbreListGet) | **GET** /api/v1/ws/timbre/list | 音色列表 |
| [**listTimbresTimbreListGet**](WsTimbreApi.md#listTimbresTimbreListGet) | **GET** /timbre/list | 音色列表 |
| [**updateTimbreApiV1WsTimbreUpdatePost**](WsTimbreApi.md#updateTimbreApiV1WsTimbreUpdatePost) | **POST** /api/v1/ws/timbre/update | 更新音色 |
| [**updateTimbreTimbreUpdatePost**](WsTimbreApi.md#updateTimbreTimbreUpdatePost) | **POST** /timbre/update | 更新音色 |


<a id="createTimbreApiV1WsTimbreCreatePost"></a>
# **createTimbreApiV1WsTimbreCreatePost**
> Object createTimbreApiV1WsTimbreCreatePost(name, voiceId, language, gender, ageRange, style, sampleUrl)

新增音色

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.WsTimbreApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    WsTimbreApi apiInstance = new WsTimbreApi(defaultClient);
    String name = "name_example"; // String | 
    String voiceId = "voiceId_example"; // String | 
    String language = "zh"; // String | 
    String gender = "female"; // String | 
    String ageRange = ""; // String | 
    String style = ""; // String | 
    String sampleUrl = ""; // String | 
    try {
      Object result = apiInstance.createTimbreApiV1WsTimbreCreatePost(name, voiceId, language, gender, ageRange, style, sampleUrl);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling WsTimbreApi#createTimbreApiV1WsTimbreCreatePost");
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
| **name** | **String**|  | |
| **voiceId** | **String**|  | |
| **language** | **String**|  | [optional] [default to zh] |
| **gender** | **String**|  | [optional] [default to female] |
| **ageRange** | **String**|  | [optional] [default to ] |
| **style** | **String**|  | [optional] [default to ] |
| **sampleUrl** | **String**|  | [optional] [default to ] |

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

<a id="createTimbreTimbreCreatePost"></a>
# **createTimbreTimbreCreatePost**
> Object createTimbreTimbreCreatePost(name, voiceId, language, gender, ageRange, style, sampleUrl)

新增音色

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.WsTimbreApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    WsTimbreApi apiInstance = new WsTimbreApi(defaultClient);
    String name = "name_example"; // String | 
    String voiceId = "voiceId_example"; // String | 
    String language = "zh"; // String | 
    String gender = "female"; // String | 
    String ageRange = ""; // String | 
    String style = ""; // String | 
    String sampleUrl = ""; // String | 
    try {
      Object result = apiInstance.createTimbreTimbreCreatePost(name, voiceId, language, gender, ageRange, style, sampleUrl);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling WsTimbreApi#createTimbreTimbreCreatePost");
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
| **name** | **String**|  | |
| **voiceId** | **String**|  | |
| **language** | **String**|  | [optional] [default to zh] |
| **gender** | **String**|  | [optional] [default to female] |
| **ageRange** | **String**|  | [optional] [default to ] |
| **style** | **String**|  | [optional] [default to ] |
| **sampleUrl** | **String**|  | [optional] [default to ] |

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

<a id="deleteTimbreApiV1WsTimbreDeletePost"></a>
# **deleteTimbreApiV1WsTimbreDeletePost**
> Object deleteTimbreApiV1WsTimbreDeletePost(timbreId)

删除音色

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.WsTimbreApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    WsTimbreApi apiInstance = new WsTimbreApi(defaultClient);
    String timbreId = "timbreId_example"; // String | 
    try {
      Object result = apiInstance.deleteTimbreApiV1WsTimbreDeletePost(timbreId);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling WsTimbreApi#deleteTimbreApiV1WsTimbreDeletePost");
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
| **timbreId** | **String**|  | |

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

<a id="deleteTimbreTimbreDeletePost"></a>
# **deleteTimbreTimbreDeletePost**
> Object deleteTimbreTimbreDeletePost(timbreId)

删除音色

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.WsTimbreApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    WsTimbreApi apiInstance = new WsTimbreApi(defaultClient);
    String timbreId = "timbreId_example"; // String | 
    try {
      Object result = apiInstance.deleteTimbreTimbreDeletePost(timbreId);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling WsTimbreApi#deleteTimbreTimbreDeletePost");
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
| **timbreId** | **String**|  | |

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

<a id="listTimbresApiV1WsTimbreListGet"></a>
# **listTimbresApiV1WsTimbreListGet**
> Object listTimbresApiV1WsTimbreListGet(language, gender, page, limit)

音色列表

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.WsTimbreApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    WsTimbreApi apiInstance = new WsTimbreApi(defaultClient);
    String language = "language_example"; // String | 
    String gender = "gender_example"; // String | 
    Integer page = 1; // Integer | 
    Integer limit = 20; // Integer | 
    try {
      Object result = apiInstance.listTimbresApiV1WsTimbreListGet(language, gender, page, limit);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling WsTimbreApi#listTimbresApiV1WsTimbreListGet");
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
| **language** | **String**|  | [optional] |
| **gender** | **String**|  | [optional] |
| **page** | **Integer**|  | [optional] [default to 1] |
| **limit** | **Integer**|  | [optional] [default to 20] |

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

<a id="listTimbresTimbreListGet"></a>
# **listTimbresTimbreListGet**
> Object listTimbresTimbreListGet(language, gender, page, limit)

音色列表

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.WsTimbreApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    WsTimbreApi apiInstance = new WsTimbreApi(defaultClient);
    String language = "language_example"; // String | 
    String gender = "gender_example"; // String | 
    Integer page = 1; // Integer | 
    Integer limit = 20; // Integer | 
    try {
      Object result = apiInstance.listTimbresTimbreListGet(language, gender, page, limit);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling WsTimbreApi#listTimbresTimbreListGet");
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
| **language** | **String**|  | [optional] |
| **gender** | **String**|  | [optional] |
| **page** | **Integer**|  | [optional] [default to 1] |
| **limit** | **Integer**|  | [optional] [default to 20] |

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

<a id="updateTimbreApiV1WsTimbreUpdatePost"></a>
# **updateTimbreApiV1WsTimbreUpdatePost**
> Object updateTimbreApiV1WsTimbreUpdatePost(timbreId, name, sampleUrl, status)

更新音色

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.WsTimbreApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    WsTimbreApi apiInstance = new WsTimbreApi(defaultClient);
    String timbreId = "timbreId_example"; // String | 
    String name = "name_example"; // String | 
    String sampleUrl = "sampleUrl_example"; // String | 
    Integer status = 56; // Integer | 
    try {
      Object result = apiInstance.updateTimbreApiV1WsTimbreUpdatePost(timbreId, name, sampleUrl, status);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling WsTimbreApi#updateTimbreApiV1WsTimbreUpdatePost");
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
| **timbreId** | **String**|  | |
| **name** | **String**|  | [optional] |
| **sampleUrl** | **String**|  | [optional] |
| **status** | **Integer**|  | [optional] |

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

<a id="updateTimbreTimbreUpdatePost"></a>
# **updateTimbreTimbreUpdatePost**
> Object updateTimbreTimbreUpdatePost(timbreId, name, sampleUrl, status)

更新音色

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.WsTimbreApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    WsTimbreApi apiInstance = new WsTimbreApi(defaultClient);
    String timbreId = "timbreId_example"; // String | 
    String name = "name_example"; // String | 
    String sampleUrl = "sampleUrl_example"; // String | 
    Integer status = 56; // Integer | 
    try {
      Object result = apiInstance.updateTimbreTimbreUpdatePost(timbreId, name, sampleUrl, status);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling WsTimbreApi#updateTimbreTimbreUpdatePost");
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
| **timbreId** | **String**|  | |
| **name** | **String**|  | [optional] |
| **sampleUrl** | **String**|  | [optional] |
| **status** | **Integer**|  | [optional] |

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

