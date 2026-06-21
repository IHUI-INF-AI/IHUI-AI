# AiDashScopeApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**audioModelsApiV1AiDashscopeAudioModelsGet**](AiDashScopeApi.md#audioModelsApiV1AiDashscopeAudioModelsGet) | **GET** /api/v1/ai/dashscope/audio/models | List supported ASR models |
| [**audioRecognizeApiV1AiDashscopeAudioRecognizePost**](AiDashScopeApi.md#audioRecognizeApiV1AiDashscopeAudioRecognizePost) | **POST** /api/v1/ai/dashscope/audio/recognize | Audio speech recognition |
| [**dashscopeChatApiV1AiDashscopeChatPost**](AiDashScopeApi.md#dashscopeChatApiV1AiDashscopeChatPost) | **POST** /api/v1/ai/dashscope/chat | DashScope chat completion |
| [**dashscopeStreamApiV1AiDashscopeChatStreamPost**](AiDashScopeApi.md#dashscopeStreamApiV1AiDashscopeChatStreamPost) | **POST** /api/v1/ai/dashscope/chat/stream | DashScope streaming chat |
| [**imageEditApiV1AiDashscopeImageEditPost**](AiDashScopeApi.md#imageEditApiV1AiDashscopeImageEditPost) | **POST** /api/v1/ai/dashscope/image/edit | DashScope image editing (standard) |
| [**imageEditSimpleApiV1AiDashscopeImageEditSimplePost**](AiDashScopeApi.md#imageEditSimpleApiV1AiDashscopeImageEditSimplePost) | **POST** /api/v1/ai/dashscope/image/edit/simple | Simple DashScope image editing |
| [**imageGenerateApiV1AiDashscopeImageGenerateModelPost**](AiDashScopeApi.md#imageGenerateApiV1AiDashscopeImageGenerateModelPost) | **POST** /api/v1/ai/dashscope/image/generate/{model} | DashScope image generation |
| [**imageTaskStatusApiV1AiDashscopeImageTaskTaskIdGet**](AiDashScopeApi.md#imageTaskStatusApiV1AiDashscopeImageTaskTaskIdGet) | **GET** /api/v1/ai/dashscope/image/task/{task_id} | Query image generation task status |
| [**imageToImageApiV1AiDashscopeImageToImagePost**](AiDashScopeApi.md#imageToImageApiV1AiDashscopeImageToImagePost) | **POST** /api/v1/ai/dashscope/image-to-image | DashScope image-to-image |
| [**videoSynthesisApiV1AiDashscopeVideoSynthesisPost**](AiDashScopeApi.md#videoSynthesisApiV1AiDashscopeVideoSynthesisPost) | **POST** /api/v1/ai/dashscope/video/synthesis | Submit video synthesis task |
| [**videoTaskStatusApiV1AiDashscopeVideoTasksTaskIdGet**](AiDashScopeApi.md#videoTaskStatusApiV1AiDashscopeVideoTasksTaskIdGet) | **GET** /api/v1/ai/dashscope/video/tasks/{task_id} | Query video synthesis task status |
| [**visionChatApiV1AiDashscopeVisionChatPost**](AiDashScopeApi.md#visionChatApiV1AiDashscopeVisionChatPost) | **POST** /api/v1/ai/dashscope/vision/chat | Vision multi-modal chat |


<a id="audioModelsApiV1AiDashscopeAudioModelsGet"></a>
# **audioModelsApiV1AiDashscopeAudioModelsGet**
> Object audioModelsApiV1AiDashscopeAudioModelsGet()

List supported ASR models

Return the list of supported audio recognition models.

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.AiDashScopeApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    AiDashScopeApi apiInstance = new AiDashScopeApi(defaultClient);
    try {
      Object result = apiInstance.audioModelsApiV1AiDashscopeAudioModelsGet();
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling AiDashScopeApi#audioModelsApiV1AiDashscopeAudioModelsGet");
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

<a id="audioRecognizeApiV1AiDashscopeAudioRecognizePost"></a>
# **audioRecognizeApiV1AiDashscopeAudioRecognizePost**
> Object audioRecognizeApiV1AiDashscopeAudioRecognizePost(audioRecognizeRequest)

Audio speech recognition

Recognise speech in audio via DashScope MultiModalConversation ASR.  Uses the DashScope multi-modal-generation HTTP endpoint. Includes token balance check, cost deduction, and conversation recording.

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.AiDashScopeApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    AiDashScopeApi apiInstance = new AiDashScopeApi(defaultClient);
    AudioRecognizeRequest audioRecognizeRequest = new AudioRecognizeRequest(); // AudioRecognizeRequest | 
    try {
      Object result = apiInstance.audioRecognizeApiV1AiDashscopeAudioRecognizePost(audioRecognizeRequest);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling AiDashScopeApi#audioRecognizeApiV1AiDashscopeAudioRecognizePost");
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
| **audioRecognizeRequest** | [**AudioRecognizeRequest**](AudioRecognizeRequest.md)|  | |

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

<a id="dashscopeChatApiV1AiDashscopeChatPost"></a>
# **dashscopeChatApiV1AiDashscopeChatPost**
> Object dashscopeChatApiV1AiDashscopeChatPost(message, model)

DashScope chat completion

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.AiDashScopeApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    AiDashScopeApi apiInstance = new AiDashScopeApi(defaultClient);
    String message = "message_example"; // String | 
    String model = "qwen-turbo"; // String | 
    try {
      Object result = apiInstance.dashscopeChatApiV1AiDashscopeChatPost(message, model);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling AiDashScopeApi#dashscopeChatApiV1AiDashscopeChatPost");
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
| **message** | **String**|  | |
| **model** | **String**|  | [optional] [default to qwen-turbo] |

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

<a id="dashscopeStreamApiV1AiDashscopeChatStreamPost"></a>
# **dashscopeStreamApiV1AiDashscopeChatStreamPost**
> Object dashscopeStreamApiV1AiDashscopeChatStreamPost(message, model)

DashScope streaming chat

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.AiDashScopeApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    AiDashScopeApi apiInstance = new AiDashScopeApi(defaultClient);
    String message = "message_example"; // String | 
    String model = "qwen-turbo"; // String | 
    try {
      Object result = apiInstance.dashscopeStreamApiV1AiDashscopeChatStreamPost(message, model);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling AiDashScopeApi#dashscopeStreamApiV1AiDashscopeChatStreamPost");
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
| **message** | **String**|  | |
| **model** | **String**|  | [optional] [default to qwen-turbo] |

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

<a id="imageEditApiV1AiDashscopeImageEditPost"></a>
# **imageEditApiV1AiDashscopeImageEditPost**
> Object imageEditApiV1AiDashscopeImageEditPost(imageEditBody)

DashScope image editing (standard)

Edit an image using a mask and prompt.  Returns task_id for async models.  For synchronous models (e.g. wan2.1-image-edit) the result image URL is returned directly.

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.AiDashScopeApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    AiDashScopeApi apiInstance = new AiDashScopeApi(defaultClient);
    ImageEditBody imageEditBody = new ImageEditBody(); // ImageEditBody | 
    try {
      Object result = apiInstance.imageEditApiV1AiDashscopeImageEditPost(imageEditBody);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling AiDashScopeApi#imageEditApiV1AiDashscopeImageEditPost");
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
| **imageEditBody** | [**ImageEditBody**](ImageEditBody.md)|  | |

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

<a id="imageEditSimpleApiV1AiDashscopeImageEditSimplePost"></a>
# **imageEditSimpleApiV1AiDashscopeImageEditSimplePost**
> Object imageEditSimpleApiV1AiDashscopeImageEditSimplePost(simpleEditBody)

Simple DashScope image editing

Simple image editing using qwen-image-edit model (background removal, style transfer, etc.).

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.AiDashScopeApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    AiDashScopeApi apiInstance = new AiDashScopeApi(defaultClient);
    SimpleEditBody simpleEditBody = new SimpleEditBody(); // SimpleEditBody | 
    try {
      Object result = apiInstance.imageEditSimpleApiV1AiDashscopeImageEditSimplePost(simpleEditBody);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling AiDashScopeApi#imageEditSimpleApiV1AiDashscopeImageEditSimplePost");
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
| **simpleEditBody** | [**SimpleEditBody**](SimpleEditBody.md)|  | |

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

<a id="imageGenerateApiV1AiDashscopeImageGenerateModelPost"></a>
# **imageGenerateApiV1AiDashscopeImageGenerateModelPost**
> Object imageGenerateApiV1AiDashscopeImageGenerateModelPost(model, appApiV1AiDashscopeRouteImageGenerateBody)

DashScope image generation

Submit an async text-to-image task.  When *sync&#x3D;false* (default) only &#x60;&#x60;task_id&#x60;&#x60; is returned; poll with &#x60;&#x60;GET /image/task/{task_id}&#x60;&#x60;. When *sync&#x3D;true* the endpoint polls until the task finishes and returns the image URL(s) directly.

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.AiDashScopeApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    AiDashScopeApi apiInstance = new AiDashScopeApi(defaultClient);
    String model = "model_example"; // String | 
    AppApiV1AiDashscopeRouteImageGenerateBody appApiV1AiDashscopeRouteImageGenerateBody = new AppApiV1AiDashscopeRouteImageGenerateBody(); // AppApiV1AiDashscopeRouteImageGenerateBody | 
    try {
      Object result = apiInstance.imageGenerateApiV1AiDashscopeImageGenerateModelPost(model, appApiV1AiDashscopeRouteImageGenerateBody);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling AiDashScopeApi#imageGenerateApiV1AiDashscopeImageGenerateModelPost");
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
| **model** | **String**|  | |
| **appApiV1AiDashscopeRouteImageGenerateBody** | [**AppApiV1AiDashscopeRouteImageGenerateBody**](AppApiV1AiDashscopeRouteImageGenerateBody.md)|  | |

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

<a id="imageTaskStatusApiV1AiDashscopeImageTaskTaskIdGet"></a>
# **imageTaskStatusApiV1AiDashscopeImageTaskTaskIdGet**
> Object imageTaskStatusApiV1AiDashscopeImageTaskTaskIdGet(taskId)

Query image generation task status

Poll a DashScope async task; returns status and image URLs when SUCCEEDED.

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.AiDashScopeApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    AiDashScopeApi apiInstance = new AiDashScopeApi(defaultClient);
    String taskId = "taskId_example"; // String | 
    try {
      Object result = apiInstance.imageTaskStatusApiV1AiDashscopeImageTaskTaskIdGet(taskId);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling AiDashScopeApi#imageTaskStatusApiV1AiDashscopeImageTaskTaskIdGet");
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

<a id="imageToImageApiV1AiDashscopeImageToImagePost"></a>
# **imageToImageApiV1AiDashscopeImageToImagePost**
> Object imageToImageApiV1AiDashscopeImageToImagePost(imageToImageBody)

DashScope image-to-image

Transform an image guided by a text prompt. Returns task_id for async models.

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.AiDashScopeApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    AiDashScopeApi apiInstance = new AiDashScopeApi(defaultClient);
    ImageToImageBody imageToImageBody = new ImageToImageBody(); // ImageToImageBody | 
    try {
      Object result = apiInstance.imageToImageApiV1AiDashscopeImageToImagePost(imageToImageBody);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling AiDashScopeApi#imageToImageApiV1AiDashscopeImageToImagePost");
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
| **imageToImageBody** | [**ImageToImageBody**](ImageToImageBody.md)|  | |

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

<a id="videoSynthesisApiV1AiDashscopeVideoSynthesisPost"></a>
# **videoSynthesisApiV1AiDashscopeVideoSynthesisPost**
> Object videoSynthesisApiV1AiDashscopeVideoSynthesisPost(videoSynthesisRequest)

Submit video synthesis task

Submit an async video generation task to DashScope.  Uses the &#x60;&#x60;video_generation&#x60;&#x60; HTTP endpoint with &#x60;&#x60;X-DashScope-Async&#x60;&#x60;. Returns a &#x60;&#x60;task_id&#x60;&#x60;; poll with &#x60;&#x60;GET /video/tasks/{task_id}&#x60;&#x60;.

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.AiDashScopeApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    AiDashScopeApi apiInstance = new AiDashScopeApi(defaultClient);
    VideoSynthesisRequest videoSynthesisRequest = new VideoSynthesisRequest(); // VideoSynthesisRequest | 
    try {
      Object result = apiInstance.videoSynthesisApiV1AiDashscopeVideoSynthesisPost(videoSynthesisRequest);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling AiDashScopeApi#videoSynthesisApiV1AiDashscopeVideoSynthesisPost");
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
| **videoSynthesisRequest** | [**VideoSynthesisRequest**](VideoSynthesisRequest.md)|  | |

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

<a id="videoTaskStatusApiV1AiDashscopeVideoTasksTaskIdGet"></a>
# **videoTaskStatusApiV1AiDashscopeVideoTasksTaskIdGet**
> Object videoTaskStatusApiV1AiDashscopeVideoTasksTaskIdGet(taskId)

Query video synthesis task status

Query the status / result of an async video synthesis task.

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.AiDashScopeApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    AiDashScopeApi apiInstance = new AiDashScopeApi(defaultClient);
    String taskId = "taskId_example"; // String | 
    try {
      Object result = apiInstance.videoTaskStatusApiV1AiDashscopeVideoTasksTaskIdGet(taskId);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling AiDashScopeApi#videoTaskStatusApiV1AiDashscopeVideoTasksTaskIdGet");
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

<a id="visionChatApiV1AiDashscopeVisionChatPost"></a>
# **visionChatApiV1AiDashscopeVisionChatPost**
> Object visionChatApiV1AiDashscopeVisionChatPost(visionChatRequest)

Vision multi-modal chat

Chat with images + text via DashScope MultiModalConversation.  Supports models like &#x60;&#x60;qwen-vl-plus&#x60;&#x60;, &#x60;&#x60;qwen-vl-max&#x60;&#x60;, &#x60;&#x60;qwen-vl-plus-latest&#x60;&#x60;.

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.AiDashScopeApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    AiDashScopeApi apiInstance = new AiDashScopeApi(defaultClient);
    VisionChatRequest visionChatRequest = new VisionChatRequest(); // VisionChatRequest | 
    try {
      Object result = apiInstance.visionChatApiV1AiDashscopeVisionChatPost(visionChatRequest);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling AiDashScopeApi#visionChatApiV1AiDashscopeVisionChatPost");
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
| **visionChatRequest** | [**VisionChatRequest**](VisionChatRequest.md)|  | |

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

