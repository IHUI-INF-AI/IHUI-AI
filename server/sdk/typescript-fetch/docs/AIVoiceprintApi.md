# AIVoiceprintApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**addVoiceprintApiV1AiAudioGroupsGroupIdUsersPost**](AIVoiceprintApi.md#addvoiceprintapiv1aiaudiogroupsgroupiduserspost) | **POST** /api/v1/ai/audio/groups/{group_id}/users | Add voiceprint to group |
| [**addVoiceprintUploadApiV1AiAudioGroupsGroupIdUsersUploadPost**](AIVoiceprintApi.md#addvoiceprintuploadapiv1aiaudiogroupsgroupidusersuploadpost) | **POST** /api/v1/ai/audio/groups/{group_id}/users/upload | Add voiceprint via file upload |
| [**createVoiceprintGroupApiV1AiAudioGroupsCreatePost**](AIVoiceprintApi.md#createvoiceprintgroupapiv1aiaudiogroupscreatepost) | **POST** /api/v1/ai/audio/groups/create | Create voiceprint group |
| [**deleteVoiceprintApiV1AiAudioGroupsGroupIdUsersFeatureIdDelete**](AIVoiceprintApi.md#deletevoiceprintapiv1aiaudiogroupsgroupidusersfeatureiddelete) | **DELETE** /api/v1/ai/audio/groups/{group_id}/users/{feature_id} | Delete voiceprint from group |
| [**identifySpeakerApiV1AiAudioIdentifyPost**](AIVoiceprintApi.md#identifyspeakerapiv1aiaudioidentifypost) | **POST** /api/v1/ai/audio/identify | Identify speaker from audio |
| [**identifySpeakerUploadApiV1AiAudioGroupsGroupIdIdentifyPost**](AIVoiceprintApi.md#identifyspeakeruploadapiv1aiaudiogroupsgroupididentifypost) | **POST** /api/v1/ai/audio/groups/{group_id}/identify | Identify speaker (file upload) |
| [**listVoiceprintGroupsApiV1AiAudioGroupsListGet**](AIVoiceprintApi.md#listvoiceprintgroupsapiv1aiaudiogroupslistget) | **GET** /api/v1/ai/audio/groups/list | List voiceprint groups |
| [**listVoiceprintsApiV1AiAudioGroupsGroupIdUsersGet**](AIVoiceprintApi.md#listvoiceprintsapiv1aiaudiogroupsgroupidusersget) | **GET** /api/v1/ai/audio/groups/{group_id}/users | List voiceprints in group |



## addVoiceprintApiV1AiAudioGroupsGroupIdUsersPost

> any addVoiceprintApiV1AiAudioGroupsGroupIdUsersPost(groupId, voiceprintFeatureCreate)

Add voiceprint to group

Add a voiceprint feature (speaker profile) to a group.  Provide either audio_url or audio_base64 containing the speaker\&#39;s voice sample. The audio will be processed by DashScope to extract voice characteristics.

### Example

```ts
import {
  Configuration,
  AIVoiceprintApi,
} from '';
import type { AddVoiceprintApiV1AiAudioGroupsGroupIdUsersPostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new AIVoiceprintApi(config);

  const body = {
    // string
    groupId: groupId_example,
    // VoiceprintFeatureCreate
    voiceprintFeatureCreate: ...,
  } satisfies AddVoiceprintApiV1AiAudioGroupsGroupIdUsersPostRequest;

  try {
    const data = await api.addVoiceprintApiV1AiAudioGroupsGroupIdUsersPost(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters


| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **groupId** | `string` |  | [Defaults to `undefined`] |
| **voiceprintFeatureCreate** | [VoiceprintFeatureCreate](VoiceprintFeatureCreate.md) |  | |

### Return type

**any**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

- **Content-Type**: `application/json`
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## addVoiceprintUploadApiV1AiAudioGroupsGroupIdUsersUploadPost

> any addVoiceprintUploadApiV1AiAudioGroupsGroupIdUsersUploadPost(groupId, file, name, desc)

Add voiceprint via file upload

Add a voiceprint feature by uploading an audio file.

### Example

```ts
import {
  Configuration,
  AIVoiceprintApi,
} from '';
import type { AddVoiceprintUploadApiV1AiAudioGroupsGroupIdUsersUploadPostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new AIVoiceprintApi(config);

  const body = {
    // string
    groupId: groupId_example,
    // Blob
    file: BINARY_DATA_HERE,
    // string
    name: name_example,
    // string (optional)
    desc: desc_example,
  } satisfies AddVoiceprintUploadApiV1AiAudioGroupsGroupIdUsersUploadPostRequest;

  try {
    const data = await api.addVoiceprintUploadApiV1AiAudioGroupsGroupIdUsersUploadPost(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters


| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **groupId** | `string` |  | [Defaults to `undefined`] |
| **file** | `Blob` |  | [Defaults to `undefined`] |
| **name** | `string` |  | [Defaults to `undefined`] |
| **desc** | `string` |  | [Optional] [Defaults to `undefined`] |

### Return type

**any**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

- **Content-Type**: `multipart/form-data`
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## createVoiceprintGroupApiV1AiAudioGroupsCreatePost

> any createVoiceprintGroupApiV1AiAudioGroupsCreatePost(voiceprintGroupCreate)

Create voiceprint group

Create a new voiceprint group for organizing speaker profiles.

### Example

```ts
import {
  Configuration,
  AIVoiceprintApi,
} from '';
import type { CreateVoiceprintGroupApiV1AiAudioGroupsCreatePostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new AIVoiceprintApi(config);

  const body = {
    // VoiceprintGroupCreate
    voiceprintGroupCreate: ...,
  } satisfies CreateVoiceprintGroupApiV1AiAudioGroupsCreatePostRequest;

  try {
    const data = await api.createVoiceprintGroupApiV1AiAudioGroupsCreatePost(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters


| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **voiceprintGroupCreate** | [VoiceprintGroupCreate](VoiceprintGroupCreate.md) |  | |

### Return type

**any**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

- **Content-Type**: `application/json`
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## deleteVoiceprintApiV1AiAudioGroupsGroupIdUsersFeatureIdDelete

> any deleteVoiceprintApiV1AiAudioGroupsGroupIdUsersFeatureIdDelete(groupId, featureId)

Delete voiceprint from group

Delete a voiceprint feature from a group.

### Example

```ts
import {
  Configuration,
  AIVoiceprintApi,
} from '';
import type { DeleteVoiceprintApiV1AiAudioGroupsGroupIdUsersFeatureIdDeleteRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new AIVoiceprintApi(config);

  const body = {
    // string
    groupId: groupId_example,
    // string
    featureId: featureId_example,
  } satisfies DeleteVoiceprintApiV1AiAudioGroupsGroupIdUsersFeatureIdDeleteRequest;

  try {
    const data = await api.deleteVoiceprintApiV1AiAudioGroupsGroupIdUsersFeatureIdDelete(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters


| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **groupId** | `string` |  | [Defaults to `undefined`] |
| **featureId** | `string` |  | [Defaults to `undefined`] |

### Return type

**any**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## identifySpeakerApiV1AiAudioIdentifyPost

> any identifySpeakerApiV1AiAudioIdentifyPost(speakerIdentifyRequest)

Identify speaker from audio

Identify a speaker by comparing audio against voiceprint group features.  Uses DashScope ASR to transcribe the audio, then compares against registered voiceprints in the specified group.

### Example

```ts
import {
  Configuration,
  AIVoiceprintApi,
} from '';
import type { IdentifySpeakerApiV1AiAudioIdentifyPostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new AIVoiceprintApi(config);

  const body = {
    // SpeakerIdentifyRequest
    speakerIdentifyRequest: ...,
  } satisfies IdentifySpeakerApiV1AiAudioIdentifyPostRequest;

  try {
    const data = await api.identifySpeakerApiV1AiAudioIdentifyPost(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters


| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **speakerIdentifyRequest** | [SpeakerIdentifyRequest](SpeakerIdentifyRequest.md) |  | |

### Return type

**any**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

- **Content-Type**: `application/json`
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## identifySpeakerUploadApiV1AiAudioGroupsGroupIdIdentifyPost

> any identifySpeakerUploadApiV1AiAudioGroupsGroupIdIdentifyPost(groupId, file)

Identify speaker (file upload)

Identify a speaker by uploading an audio file.

### Example

```ts
import {
  Configuration,
  AIVoiceprintApi,
} from '';
import type { IdentifySpeakerUploadApiV1AiAudioGroupsGroupIdIdentifyPostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new AIVoiceprintApi(config);

  const body = {
    // string
    groupId: groupId_example,
    // Blob
    file: BINARY_DATA_HERE,
  } satisfies IdentifySpeakerUploadApiV1AiAudioGroupsGroupIdIdentifyPostRequest;

  try {
    const data = await api.identifySpeakerUploadApiV1AiAudioGroupsGroupIdIdentifyPost(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters


| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **groupId** | `string` |  | [Defaults to `undefined`] |
| **file** | `Blob` |  | [Defaults to `undefined`] |

### Return type

**any**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

- **Content-Type**: `multipart/form-data`
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## listVoiceprintGroupsApiV1AiAudioGroupsListGet

> any listVoiceprintGroupsApiV1AiAudioGroupsListGet()

List voiceprint groups

List all voiceprint groups.

### Example

```ts
import {
  Configuration,
  AIVoiceprintApi,
} from '';
import type { ListVoiceprintGroupsApiV1AiAudioGroupsListGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new AIVoiceprintApi(config);

  try {
    const data = await api.listVoiceprintGroupsApiV1AiAudioGroupsListGet();
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters

This endpoint does not need any parameter.

### Return type

**any**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## listVoiceprintsApiV1AiAudioGroupsGroupIdUsersGet

> any listVoiceprintsApiV1AiAudioGroupsGroupIdUsersGet(groupId)

List voiceprints in group

List all voiceprint features in a group.

### Example

```ts
import {
  Configuration,
  AIVoiceprintApi,
} from '';
import type { ListVoiceprintsApiV1AiAudioGroupsGroupIdUsersGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new AIVoiceprintApi(config);

  const body = {
    // string
    groupId: groupId_example,
  } satisfies ListVoiceprintsApiV1AiAudioGroupsGroupIdUsersGetRequest;

  try {
    const data = await api.listVoiceprintsApiV1AiAudioGroupsGroupIdUsersGet(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters


| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **groupId** | `string` |  | [Defaults to `undefined`] |

### Return type

**any**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)

