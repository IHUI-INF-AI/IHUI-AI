# AiVoiceprintApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**addVoiceprintApiV1AiAudioGroupsGroupIdUsersPost**](AiVoiceprintApi.md#addVoiceprintApiV1AiAudioGroupsGroupIdUsersPost) | **POST** /api/v1/ai/audio/groups/{group_id}/users | Add voiceprint to group |
| [**addVoiceprintUploadApiV1AiAudioGroupsGroupIdUsersUploadPost**](AiVoiceprintApi.md#addVoiceprintUploadApiV1AiAudioGroupsGroupIdUsersUploadPost) | **POST** /api/v1/ai/audio/groups/{group_id}/users/upload | Add voiceprint via file upload |
| [**createVoiceprintGroupApiV1AiAudioGroupsCreatePost**](AiVoiceprintApi.md#createVoiceprintGroupApiV1AiAudioGroupsCreatePost) | **POST** /api/v1/ai/audio/groups/create | Create voiceprint group |
| [**deleteVoiceprintApiV1AiAudioGroupsGroupIdUsersFeatureIdDelete**](AiVoiceprintApi.md#deleteVoiceprintApiV1AiAudioGroupsGroupIdUsersFeatureIdDelete) | **DELETE** /api/v1/ai/audio/groups/{group_id}/users/{feature_id} | Delete voiceprint from group |
| [**identifySpeakerApiV1AiAudioIdentifyPost**](AiVoiceprintApi.md#identifySpeakerApiV1AiAudioIdentifyPost) | **POST** /api/v1/ai/audio/identify | Identify speaker from audio |
| [**identifySpeakerUploadApiV1AiAudioGroupsGroupIdIdentifyPost**](AiVoiceprintApi.md#identifySpeakerUploadApiV1AiAudioGroupsGroupIdIdentifyPost) | **POST** /api/v1/ai/audio/groups/{group_id}/identify | Identify speaker (file upload) |
| [**listVoiceprintGroupsApiV1AiAudioGroupsListGet**](AiVoiceprintApi.md#listVoiceprintGroupsApiV1AiAudioGroupsListGet) | **GET** /api/v1/ai/audio/groups/list | List voiceprint groups |
| [**listVoiceprintsApiV1AiAudioGroupsGroupIdUsersGet**](AiVoiceprintApi.md#listVoiceprintsApiV1AiAudioGroupsGroupIdUsersGet) | **GET** /api/v1/ai/audio/groups/{group_id}/users | List voiceprints in group |


<a id="addVoiceprintApiV1AiAudioGroupsGroupIdUsersPost"></a>
# **addVoiceprintApiV1AiAudioGroupsGroupIdUsersPost**
> Object addVoiceprintApiV1AiAudioGroupsGroupIdUsersPost(groupId, voiceprintFeatureCreate)

Add voiceprint to group

Add a voiceprint feature (speaker profile) to a group.  Provide either audio_url or audio_base64 containing the speaker&#39;s voice sample. The audio will be processed by DashScope to extract voice characteristics.

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.AiVoiceprintApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    AiVoiceprintApi apiInstance = new AiVoiceprintApi(defaultClient);
    String groupId = "groupId_example"; // String | 
    VoiceprintFeatureCreate voiceprintFeatureCreate = new VoiceprintFeatureCreate(); // VoiceprintFeatureCreate | 
    try {
      Object result = apiInstance.addVoiceprintApiV1AiAudioGroupsGroupIdUsersPost(groupId, voiceprintFeatureCreate);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling AiVoiceprintApi#addVoiceprintApiV1AiAudioGroupsGroupIdUsersPost");
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
| **groupId** | **String**|  | |
| **voiceprintFeatureCreate** | [**VoiceprintFeatureCreate**](VoiceprintFeatureCreate.md)|  | |

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

<a id="addVoiceprintUploadApiV1AiAudioGroupsGroupIdUsersUploadPost"></a>
# **addVoiceprintUploadApiV1AiAudioGroupsGroupIdUsersUploadPost**
> Object addVoiceprintUploadApiV1AiAudioGroupsGroupIdUsersUploadPost(groupId, _file, name, desc)

Add voiceprint via file upload

Add a voiceprint feature by uploading an audio file.

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.AiVoiceprintApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    AiVoiceprintApi apiInstance = new AiVoiceprintApi(defaultClient);
    String groupId = "groupId_example"; // String | 
    File _file = new File("/path/to/file"); // File | 
    String name = "name_example"; // String | 
    String desc = "desc_example"; // String | 
    try {
      Object result = apiInstance.addVoiceprintUploadApiV1AiAudioGroupsGroupIdUsersUploadPost(groupId, _file, name, desc);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling AiVoiceprintApi#addVoiceprintUploadApiV1AiAudioGroupsGroupIdUsersUploadPost");
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
| **groupId** | **String**|  | |
| **_file** | **File**|  | |
| **name** | **String**|  | |
| **desc** | **String**|  | [optional] |

### Return type

**Object**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: multipart/form-data
 - **Accept**: application/json

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

<a id="createVoiceprintGroupApiV1AiAudioGroupsCreatePost"></a>
# **createVoiceprintGroupApiV1AiAudioGroupsCreatePost**
> Object createVoiceprintGroupApiV1AiAudioGroupsCreatePost(voiceprintGroupCreate)

Create voiceprint group

Create a new voiceprint group for organizing speaker profiles.

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.AiVoiceprintApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    AiVoiceprintApi apiInstance = new AiVoiceprintApi(defaultClient);
    VoiceprintGroupCreate voiceprintGroupCreate = new VoiceprintGroupCreate(); // VoiceprintGroupCreate | 
    try {
      Object result = apiInstance.createVoiceprintGroupApiV1AiAudioGroupsCreatePost(voiceprintGroupCreate);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling AiVoiceprintApi#createVoiceprintGroupApiV1AiAudioGroupsCreatePost");
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
| **voiceprintGroupCreate** | [**VoiceprintGroupCreate**](VoiceprintGroupCreate.md)|  | |

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

<a id="deleteVoiceprintApiV1AiAudioGroupsGroupIdUsersFeatureIdDelete"></a>
# **deleteVoiceprintApiV1AiAudioGroupsGroupIdUsersFeatureIdDelete**
> Object deleteVoiceprintApiV1AiAudioGroupsGroupIdUsersFeatureIdDelete(groupId, featureId)

Delete voiceprint from group

Delete a voiceprint feature from a group.

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.AiVoiceprintApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    AiVoiceprintApi apiInstance = new AiVoiceprintApi(defaultClient);
    String groupId = "groupId_example"; // String | 
    String featureId = "featureId_example"; // String | 
    try {
      Object result = apiInstance.deleteVoiceprintApiV1AiAudioGroupsGroupIdUsersFeatureIdDelete(groupId, featureId);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling AiVoiceprintApi#deleteVoiceprintApiV1AiAudioGroupsGroupIdUsersFeatureIdDelete");
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
| **groupId** | **String**|  | |
| **featureId** | **String**|  | |

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

<a id="identifySpeakerApiV1AiAudioIdentifyPost"></a>
# **identifySpeakerApiV1AiAudioIdentifyPost**
> Object identifySpeakerApiV1AiAudioIdentifyPost(speakerIdentifyRequest)

Identify speaker from audio

Identify a speaker by comparing audio against voiceprint group features.  Uses DashScope ASR to transcribe the audio, then compares against registered voiceprints in the specified group.

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.AiVoiceprintApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    AiVoiceprintApi apiInstance = new AiVoiceprintApi(defaultClient);
    SpeakerIdentifyRequest speakerIdentifyRequest = new SpeakerIdentifyRequest(); // SpeakerIdentifyRequest | 
    try {
      Object result = apiInstance.identifySpeakerApiV1AiAudioIdentifyPost(speakerIdentifyRequest);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling AiVoiceprintApi#identifySpeakerApiV1AiAudioIdentifyPost");
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
| **speakerIdentifyRequest** | [**SpeakerIdentifyRequest**](SpeakerIdentifyRequest.md)|  | |

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

<a id="identifySpeakerUploadApiV1AiAudioGroupsGroupIdIdentifyPost"></a>
# **identifySpeakerUploadApiV1AiAudioGroupsGroupIdIdentifyPost**
> Object identifySpeakerUploadApiV1AiAudioGroupsGroupIdIdentifyPost(groupId, _file)

Identify speaker (file upload)

Identify a speaker by uploading an audio file.

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.AiVoiceprintApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    AiVoiceprintApi apiInstance = new AiVoiceprintApi(defaultClient);
    String groupId = "groupId_example"; // String | 
    File _file = new File("/path/to/file"); // File | 
    try {
      Object result = apiInstance.identifySpeakerUploadApiV1AiAudioGroupsGroupIdIdentifyPost(groupId, _file);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling AiVoiceprintApi#identifySpeakerUploadApiV1AiAudioGroupsGroupIdIdentifyPost");
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
| **groupId** | **String**|  | |
| **_file** | **File**|  | |

### Return type

**Object**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: multipart/form-data
 - **Accept**: application/json

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

<a id="listVoiceprintGroupsApiV1AiAudioGroupsListGet"></a>
# **listVoiceprintGroupsApiV1AiAudioGroupsListGet**
> Object listVoiceprintGroupsApiV1AiAudioGroupsListGet()

List voiceprint groups

List all voiceprint groups.

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.AiVoiceprintApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    AiVoiceprintApi apiInstance = new AiVoiceprintApi(defaultClient);
    try {
      Object result = apiInstance.listVoiceprintGroupsApiV1AiAudioGroupsListGet();
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling AiVoiceprintApi#listVoiceprintGroupsApiV1AiAudioGroupsListGet");
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

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |

<a id="listVoiceprintsApiV1AiAudioGroupsGroupIdUsersGet"></a>
# **listVoiceprintsApiV1AiAudioGroupsGroupIdUsersGet**
> Object listVoiceprintsApiV1AiAudioGroupsGroupIdUsersGet(groupId)

List voiceprints in group

List all voiceprint features in a group.

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.AiVoiceprintApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    AiVoiceprintApi apiInstance = new AiVoiceprintApi(defaultClient);
    String groupId = "groupId_example"; // String | 
    try {
      Object result = apiInstance.listVoiceprintsApiV1AiAudioGroupsGroupIdUsersGet(groupId);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling AiVoiceprintApi#listVoiceprintsApiV1AiAudioGroupsGroupIdUsersGet");
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
| **groupId** | **String**|  | |

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

