# CozeAudioApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**chatAudioApiV1CozeAudioAudioChatAudioPost**](CozeAudioApi.md#chatAudioApiV1CozeAudioAudioChatAudioPost) | **POST** /api/v1/coze/audio/audio/chat-audio | Chat Audio |
| [**chatAudioApiV1CozeAudioAudioChatAudioPost_0**](CozeAudioApi.md#chatAudioApiV1CozeAudioAudioChatAudioPost_0) | **POST** /api/v1/coze/audio/audio/chat-audio | Chat Audio |
| [**createSpeechApiV1CozeAudioAudioSpeechPost**](CozeAudioApi.md#createSpeechApiV1CozeAudioAudioSpeechPost) | **POST** /api/v1/coze/audio/audio/speech | Create Speech |
| [**createSpeechApiV1CozeAudioAudioSpeechPost_0**](CozeAudioApi.md#createSpeechApiV1CozeAudioAudioSpeechPost_0) | **POST** /api/v1/coze/audio/audio/speech | Create Speech |
| [**createVoiceprintApiV1CozeAudioAudioVoiceprintsPost**](CozeAudioApi.md#createVoiceprintApiV1CozeAudioAudioVoiceprintsPost) | **POST** /api/v1/coze/audio/audio/voiceprints | Create Voiceprint |
| [**createVoiceprintApiV1CozeAudioAudioVoiceprintsPost_0**](CozeAudioApi.md#createVoiceprintApiV1CozeAudioAudioVoiceprintsPost_0) | **POST** /api/v1/coze/audio/audio/voiceprints | Create Voiceprint |
| [**deleteVoiceprintApiV1CozeAudioAudioVoiceprintsDelete**](CozeAudioApi.md#deleteVoiceprintApiV1CozeAudioAudioVoiceprintsDelete) | **DELETE** /api/v1/coze/audio/audio/voiceprints | Delete Voiceprint |
| [**deleteVoiceprintApiV1CozeAudioAudioVoiceprintsDelete_0**](CozeAudioApi.md#deleteVoiceprintApiV1CozeAudioAudioVoiceprintsDelete_0) | **DELETE** /api/v1/coze/audio/audio/voiceprints | Delete Voiceprint |
| [**listVoiceprintsApiV1CozeAudioAudioVoiceprintsGet**](CozeAudioApi.md#listVoiceprintsApiV1CozeAudioAudioVoiceprintsGet) | **GET** /api/v1/coze/audio/audio/voiceprints | List Voiceprints |
| [**listVoiceprintsApiV1CozeAudioAudioVoiceprintsGet_0**](CozeAudioApi.md#listVoiceprintsApiV1CozeAudioAudioVoiceprintsGet_0) | **GET** /api/v1/coze/audio/audio/voiceprints | List Voiceprints |
| [**listVoicesApiV1CozeAudioAudioVoicesGet**](CozeAudioApi.md#listVoicesApiV1CozeAudioAudioVoicesGet) | **GET** /api/v1/coze/audio/audio/voices | List Voices |
| [**listVoicesApiV1CozeAudioAudioVoicesGet_0**](CozeAudioApi.md#listVoicesApiV1CozeAudioAudioVoicesGet_0) | **GET** /api/v1/coze/audio/audio/voices | List Voices |
| [**updateVoiceprintApiV1CozeAudioAudioVoiceprintsPut**](CozeAudioApi.md#updateVoiceprintApiV1CozeAudioAudioVoiceprintsPut) | **PUT** /api/v1/coze/audio/audio/voiceprints | Update Voiceprint |
| [**updateVoiceprintApiV1CozeAudioAudioVoiceprintsPut_0**](CozeAudioApi.md#updateVoiceprintApiV1CozeAudioAudioVoiceprintsPut_0) | **PUT** /api/v1/coze/audio/audio/voiceprints | Update Voiceprint |


<a id="chatAudioApiV1CozeAudioAudioChatAudioPost"></a>
# **chatAudioApiV1CozeAudioAudioChatAudioPost**
> Object chatAudioApiV1CozeAudioAudioChatAudioPost(chatAudioReq)

Chat Audio

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.CozeAudioApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    CozeAudioApi apiInstance = new CozeAudioApi(defaultClient);
    ChatAudioReq chatAudioReq = new ChatAudioReq(); // ChatAudioReq | 
    try {
      Object result = apiInstance.chatAudioApiV1CozeAudioAudioChatAudioPost(chatAudioReq);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling CozeAudioApi#chatAudioApiV1CozeAudioAudioChatAudioPost");
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
| **chatAudioReq** | [**ChatAudioReq**](ChatAudioReq.md)|  | |

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

<a id="chatAudioApiV1CozeAudioAudioChatAudioPost_0"></a>
# **chatAudioApiV1CozeAudioAudioChatAudioPost_0**
> Object chatAudioApiV1CozeAudioAudioChatAudioPost_0(chatAudioReq)

Chat Audio

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.CozeAudioApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    CozeAudioApi apiInstance = new CozeAudioApi(defaultClient);
    ChatAudioReq chatAudioReq = new ChatAudioReq(); // ChatAudioReq | 
    try {
      Object result = apiInstance.chatAudioApiV1CozeAudioAudioChatAudioPost_0(chatAudioReq);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling CozeAudioApi#chatAudioApiV1CozeAudioAudioChatAudioPost_0");
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
| **chatAudioReq** | [**ChatAudioReq**](ChatAudioReq.md)|  | |

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

<a id="createSpeechApiV1CozeAudioAudioSpeechPost"></a>
# **createSpeechApiV1CozeAudioAudioSpeechPost**
> Object createSpeechApiV1CozeAudioAudioSpeechPost(speechReq)

Create Speech

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.CozeAudioApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    CozeAudioApi apiInstance = new CozeAudioApi(defaultClient);
    SpeechReq speechReq = new SpeechReq(); // SpeechReq | 
    try {
      Object result = apiInstance.createSpeechApiV1CozeAudioAudioSpeechPost(speechReq);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling CozeAudioApi#createSpeechApiV1CozeAudioAudioSpeechPost");
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
| **speechReq** | [**SpeechReq**](SpeechReq.md)|  | |

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

<a id="createSpeechApiV1CozeAudioAudioSpeechPost_0"></a>
# **createSpeechApiV1CozeAudioAudioSpeechPost_0**
> Object createSpeechApiV1CozeAudioAudioSpeechPost_0(speechReq)

Create Speech

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.CozeAudioApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    CozeAudioApi apiInstance = new CozeAudioApi(defaultClient);
    SpeechReq speechReq = new SpeechReq(); // SpeechReq | 
    try {
      Object result = apiInstance.createSpeechApiV1CozeAudioAudioSpeechPost_0(speechReq);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling CozeAudioApi#createSpeechApiV1CozeAudioAudioSpeechPost_0");
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
| **speechReq** | [**SpeechReq**](SpeechReq.md)|  | |

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

<a id="createVoiceprintApiV1CozeAudioAudioVoiceprintsPost"></a>
# **createVoiceprintApiV1CozeAudioAudioVoiceprintsPost**
> Object createVoiceprintApiV1CozeAudioAudioVoiceprintsPost(voiceprintCreateReq)

Create Voiceprint

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.CozeAudioApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    CozeAudioApi apiInstance = new CozeAudioApi(defaultClient);
    VoiceprintCreateReq voiceprintCreateReq = new VoiceprintCreateReq(); // VoiceprintCreateReq | 
    try {
      Object result = apiInstance.createVoiceprintApiV1CozeAudioAudioVoiceprintsPost(voiceprintCreateReq);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling CozeAudioApi#createVoiceprintApiV1CozeAudioAudioVoiceprintsPost");
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
| **voiceprintCreateReq** | [**VoiceprintCreateReq**](VoiceprintCreateReq.md)|  | |

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

<a id="createVoiceprintApiV1CozeAudioAudioVoiceprintsPost_0"></a>
# **createVoiceprintApiV1CozeAudioAudioVoiceprintsPost_0**
> Object createVoiceprintApiV1CozeAudioAudioVoiceprintsPost_0(voiceprintCreateReq)

Create Voiceprint

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.CozeAudioApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    CozeAudioApi apiInstance = new CozeAudioApi(defaultClient);
    VoiceprintCreateReq voiceprintCreateReq = new VoiceprintCreateReq(); // VoiceprintCreateReq | 
    try {
      Object result = apiInstance.createVoiceprintApiV1CozeAudioAudioVoiceprintsPost_0(voiceprintCreateReq);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling CozeAudioApi#createVoiceprintApiV1CozeAudioAudioVoiceprintsPost_0");
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
| **voiceprintCreateReq** | [**VoiceprintCreateReq**](VoiceprintCreateReq.md)|  | |

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

<a id="deleteVoiceprintApiV1CozeAudioAudioVoiceprintsDelete"></a>
# **deleteVoiceprintApiV1CozeAudioAudioVoiceprintsDelete**
> Object deleteVoiceprintApiV1CozeAudioAudioVoiceprintsDelete(voiceprintDeleteReq)

Delete Voiceprint

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.CozeAudioApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    CozeAudioApi apiInstance = new CozeAudioApi(defaultClient);
    VoiceprintDeleteReq voiceprintDeleteReq = new VoiceprintDeleteReq(); // VoiceprintDeleteReq | 
    try {
      Object result = apiInstance.deleteVoiceprintApiV1CozeAudioAudioVoiceprintsDelete(voiceprintDeleteReq);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling CozeAudioApi#deleteVoiceprintApiV1CozeAudioAudioVoiceprintsDelete");
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
| **voiceprintDeleteReq** | [**VoiceprintDeleteReq**](VoiceprintDeleteReq.md)|  | |

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

<a id="deleteVoiceprintApiV1CozeAudioAudioVoiceprintsDelete_0"></a>
# **deleteVoiceprintApiV1CozeAudioAudioVoiceprintsDelete_0**
> Object deleteVoiceprintApiV1CozeAudioAudioVoiceprintsDelete_0(voiceprintDeleteReq)

Delete Voiceprint

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.CozeAudioApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    CozeAudioApi apiInstance = new CozeAudioApi(defaultClient);
    VoiceprintDeleteReq voiceprintDeleteReq = new VoiceprintDeleteReq(); // VoiceprintDeleteReq | 
    try {
      Object result = apiInstance.deleteVoiceprintApiV1CozeAudioAudioVoiceprintsDelete_0(voiceprintDeleteReq);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling CozeAudioApi#deleteVoiceprintApiV1CozeAudioAudioVoiceprintsDelete_0");
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
| **voiceprintDeleteReq** | [**VoiceprintDeleteReq**](VoiceprintDeleteReq.md)|  | |

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

<a id="listVoiceprintsApiV1CozeAudioAudioVoiceprintsGet"></a>
# **listVoiceprintsApiV1CozeAudioAudioVoiceprintsGet**
> Object listVoiceprintsApiV1CozeAudioAudioVoiceprintsGet()

List Voiceprints

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.CozeAudioApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    CozeAudioApi apiInstance = new CozeAudioApi(defaultClient);
    try {
      Object result = apiInstance.listVoiceprintsApiV1CozeAudioAudioVoiceprintsGet();
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling CozeAudioApi#listVoiceprintsApiV1CozeAudioAudioVoiceprintsGet");
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

<a id="listVoiceprintsApiV1CozeAudioAudioVoiceprintsGet_0"></a>
# **listVoiceprintsApiV1CozeAudioAudioVoiceprintsGet_0**
> Object listVoiceprintsApiV1CozeAudioAudioVoiceprintsGet_0()

List Voiceprints

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.CozeAudioApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    CozeAudioApi apiInstance = new CozeAudioApi(defaultClient);
    try {
      Object result = apiInstance.listVoiceprintsApiV1CozeAudioAudioVoiceprintsGet_0();
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling CozeAudioApi#listVoiceprintsApiV1CozeAudioAudioVoiceprintsGet_0");
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

<a id="listVoicesApiV1CozeAudioAudioVoicesGet"></a>
# **listVoicesApiV1CozeAudioAudioVoicesGet**
> Object listVoicesApiV1CozeAudioAudioVoicesGet(filterType)

List Voices

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.CozeAudioApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    CozeAudioApi apiInstance = new CozeAudioApi(defaultClient);
    String filterType = "filterType_example"; // String | 
    try {
      Object result = apiInstance.listVoicesApiV1CozeAudioAudioVoicesGet(filterType);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling CozeAudioApi#listVoicesApiV1CozeAudioAudioVoicesGet");
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
| **filterType** | **String**|  | [optional] |

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

<a id="listVoicesApiV1CozeAudioAudioVoicesGet_0"></a>
# **listVoicesApiV1CozeAudioAudioVoicesGet_0**
> Object listVoicesApiV1CozeAudioAudioVoicesGet_0(filterType)

List Voices

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.CozeAudioApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    CozeAudioApi apiInstance = new CozeAudioApi(defaultClient);
    String filterType = "filterType_example"; // String | 
    try {
      Object result = apiInstance.listVoicesApiV1CozeAudioAudioVoicesGet_0(filterType);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling CozeAudioApi#listVoicesApiV1CozeAudioAudioVoicesGet_0");
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
| **filterType** | **String**|  | [optional] |

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

<a id="updateVoiceprintApiV1CozeAudioAudioVoiceprintsPut"></a>
# **updateVoiceprintApiV1CozeAudioAudioVoiceprintsPut**
> Object updateVoiceprintApiV1CozeAudioAudioVoiceprintsPut(voiceprintUpdateReq)

Update Voiceprint

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.CozeAudioApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    CozeAudioApi apiInstance = new CozeAudioApi(defaultClient);
    VoiceprintUpdateReq voiceprintUpdateReq = new VoiceprintUpdateReq(); // VoiceprintUpdateReq | 
    try {
      Object result = apiInstance.updateVoiceprintApiV1CozeAudioAudioVoiceprintsPut(voiceprintUpdateReq);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling CozeAudioApi#updateVoiceprintApiV1CozeAudioAudioVoiceprintsPut");
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
| **voiceprintUpdateReq** | [**VoiceprintUpdateReq**](VoiceprintUpdateReq.md)|  | |

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

<a id="updateVoiceprintApiV1CozeAudioAudioVoiceprintsPut_0"></a>
# **updateVoiceprintApiV1CozeAudioAudioVoiceprintsPut_0**
> Object updateVoiceprintApiV1CozeAudioAudioVoiceprintsPut_0(voiceprintUpdateReq)

Update Voiceprint

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.CozeAudioApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    CozeAudioApi apiInstance = new CozeAudioApi(defaultClient);
    VoiceprintUpdateReq voiceprintUpdateReq = new VoiceprintUpdateReq(); // VoiceprintUpdateReq | 
    try {
      Object result = apiInstance.updateVoiceprintApiV1CozeAudioAudioVoiceprintsPut_0(voiceprintUpdateReq);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling CozeAudioApi#updateVoiceprintApiV1CozeAudioAudioVoiceprintsPut_0");
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
| **voiceprintUpdateReq** | [**VoiceprintUpdateReq**](VoiceprintUpdateReq.md)|  | |

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

