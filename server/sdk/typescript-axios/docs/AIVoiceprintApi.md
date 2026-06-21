# AIVoiceprintApi

All URIs are relative to *http://localhost*

|Method | HTTP request | Description|
|------------- | ------------- | -------------|
|[**addVoiceprintApiV1AiAudioGroupsGroupIdUsersPost**](#addvoiceprintapiv1aiaudiogroupsgroupiduserspost) | **POST** /api/v1/ai/audio/groups/{group_id}/users | Add voiceprint to group|
|[**addVoiceprintUploadApiV1AiAudioGroupsGroupIdUsersUploadPost**](#addvoiceprintuploadapiv1aiaudiogroupsgroupidusersuploadpost) | **POST** /api/v1/ai/audio/groups/{group_id}/users/upload | Add voiceprint via file upload|
|[**createVoiceprintGroupApiV1AiAudioGroupsCreatePost**](#createvoiceprintgroupapiv1aiaudiogroupscreatepost) | **POST** /api/v1/ai/audio/groups/create | Create voiceprint group|
|[**deleteVoiceprintApiV1AiAudioGroupsGroupIdUsersFeatureIdDelete**](#deletevoiceprintapiv1aiaudiogroupsgroupidusersfeatureiddelete) | **DELETE** /api/v1/ai/audio/groups/{group_id}/users/{feature_id} | Delete voiceprint from group|
|[**identifySpeakerApiV1AiAudioIdentifyPost**](#identifyspeakerapiv1aiaudioidentifypost) | **POST** /api/v1/ai/audio/identify | Identify speaker from audio|
|[**identifySpeakerUploadApiV1AiAudioGroupsGroupIdIdentifyPost**](#identifyspeakeruploadapiv1aiaudiogroupsgroupididentifypost) | **POST** /api/v1/ai/audio/groups/{group_id}/identify | Identify speaker (file upload)|
|[**listVoiceprintGroupsApiV1AiAudioGroupsListGet**](#listvoiceprintgroupsapiv1aiaudiogroupslistget) | **GET** /api/v1/ai/audio/groups/list | List voiceprint groups|
|[**listVoiceprintsApiV1AiAudioGroupsGroupIdUsersGet**](#listvoiceprintsapiv1aiaudiogroupsgroupidusersget) | **GET** /api/v1/ai/audio/groups/{group_id}/users | List voiceprints in group|

# **addVoiceprintApiV1AiAudioGroupsGroupIdUsersPost**
> any addVoiceprintApiV1AiAudioGroupsGroupIdUsersPost(voiceprintFeatureCreate)

Add a voiceprint feature (speaker profile) to a group.  Provide either audio_url or audio_base64 containing the speaker\'s voice sample. The audio will be processed by DashScope to extract voice characteristics.

### Example

```typescript
import {
    AIVoiceprintApi,
    Configuration,
    VoiceprintFeatureCreate
} from './api';

const configuration = new Configuration();
const apiInstance = new AIVoiceprintApi(configuration);

let groupId: string; // (default to undefined)
let voiceprintFeatureCreate: VoiceprintFeatureCreate; //

const { status, data } = await apiInstance.addVoiceprintApiV1AiAudioGroupsGroupIdUsersPost(
    groupId,
    voiceprintFeatureCreate
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **voiceprintFeatureCreate** | **VoiceprintFeatureCreate**|  | |
| **groupId** | [**string**] |  | defaults to undefined|


### Return type

**any**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |
|**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **addVoiceprintUploadApiV1AiAudioGroupsGroupIdUsersUploadPost**
> any addVoiceprintUploadApiV1AiAudioGroupsGroupIdUsersUploadPost()

Add a voiceprint feature by uploading an audio file.

### Example

```typescript
import {
    AIVoiceprintApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AIVoiceprintApi(configuration);

let groupId: string; // (default to undefined)
let file: File; // (default to undefined)
let name: string; // (default to undefined)
let desc: string; // (optional) (default to undefined)

const { status, data } = await apiInstance.addVoiceprintUploadApiV1AiAudioGroupsGroupIdUsersUploadPost(
    groupId,
    file,
    name,
    desc
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **groupId** | [**string**] |  | defaults to undefined|
| **file** | [**File**] |  | defaults to undefined|
| **name** | [**string**] |  | defaults to undefined|
| **desc** | [**string**] |  | (optional) defaults to undefined|


### Return type

**any**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: multipart/form-data
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |
|**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **createVoiceprintGroupApiV1AiAudioGroupsCreatePost**
> any createVoiceprintGroupApiV1AiAudioGroupsCreatePost(voiceprintGroupCreate)

Create a new voiceprint group for organizing speaker profiles.

### Example

```typescript
import {
    AIVoiceprintApi,
    Configuration,
    VoiceprintGroupCreate
} from './api';

const configuration = new Configuration();
const apiInstance = new AIVoiceprintApi(configuration);

let voiceprintGroupCreate: VoiceprintGroupCreate; //

const { status, data } = await apiInstance.createVoiceprintGroupApiV1AiAudioGroupsCreatePost(
    voiceprintGroupCreate
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **voiceprintGroupCreate** | **VoiceprintGroupCreate**|  | |


### Return type

**any**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |
|**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **deleteVoiceprintApiV1AiAudioGroupsGroupIdUsersFeatureIdDelete**
> any deleteVoiceprintApiV1AiAudioGroupsGroupIdUsersFeatureIdDelete()

Delete a voiceprint feature from a group.

### Example

```typescript
import {
    AIVoiceprintApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AIVoiceprintApi(configuration);

let groupId: string; // (default to undefined)
let featureId: string; // (default to undefined)

const { status, data } = await apiInstance.deleteVoiceprintApiV1AiAudioGroupsGroupIdUsersFeatureIdDelete(
    groupId,
    featureId
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **groupId** | [**string**] |  | defaults to undefined|
| **featureId** | [**string**] |  | defaults to undefined|


### Return type

**any**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |
|**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **identifySpeakerApiV1AiAudioIdentifyPost**
> any identifySpeakerApiV1AiAudioIdentifyPost(speakerIdentifyRequest)

Identify a speaker by comparing audio against voiceprint group features.  Uses DashScope ASR to transcribe the audio, then compares against registered voiceprints in the specified group.

### Example

```typescript
import {
    AIVoiceprintApi,
    Configuration,
    SpeakerIdentifyRequest
} from './api';

const configuration = new Configuration();
const apiInstance = new AIVoiceprintApi(configuration);

let speakerIdentifyRequest: SpeakerIdentifyRequest; //

const { status, data } = await apiInstance.identifySpeakerApiV1AiAudioIdentifyPost(
    speakerIdentifyRequest
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **speakerIdentifyRequest** | **SpeakerIdentifyRequest**|  | |


### Return type

**any**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |
|**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **identifySpeakerUploadApiV1AiAudioGroupsGroupIdIdentifyPost**
> any identifySpeakerUploadApiV1AiAudioGroupsGroupIdIdentifyPost()

Identify a speaker by uploading an audio file.

### Example

```typescript
import {
    AIVoiceprintApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AIVoiceprintApi(configuration);

let groupId: string; // (default to undefined)
let file: File; // (default to undefined)

const { status, data } = await apiInstance.identifySpeakerUploadApiV1AiAudioGroupsGroupIdIdentifyPost(
    groupId,
    file
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **groupId** | [**string**] |  | defaults to undefined|
| **file** | [**File**] |  | defaults to undefined|


### Return type

**any**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: multipart/form-data
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |
|**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **listVoiceprintGroupsApiV1AiAudioGroupsListGet**
> any listVoiceprintGroupsApiV1AiAudioGroupsListGet()

List all voiceprint groups.

### Example

```typescript
import {
    AIVoiceprintApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AIVoiceprintApi(configuration);

const { status, data } = await apiInstance.listVoiceprintGroupsApiV1AiAudioGroupsListGet();
```

### Parameters
This endpoint does not have any parameters.


### Return type

**any**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **listVoiceprintsApiV1AiAudioGroupsGroupIdUsersGet**
> any listVoiceprintsApiV1AiAudioGroupsGroupIdUsersGet()

List all voiceprint features in a group.

### Example

```typescript
import {
    AIVoiceprintApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AIVoiceprintApi(configuration);

let groupId: string; // (default to undefined)

const { status, data } = await apiInstance.listVoiceprintsApiV1AiAudioGroupsGroupIdUsersGet(
    groupId
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **groupId** | [**string**] |  | defaults to undefined|


### Return type

**any**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |
|**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

