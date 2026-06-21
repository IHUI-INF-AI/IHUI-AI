# \AIVoiceprintAPI

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**AddVoiceprintApiV1AiAudioGroupsGroupIdUsersPost**](AIVoiceprintAPI.md#AddVoiceprintApiV1AiAudioGroupsGroupIdUsersPost) | **Post** /api/v1/ai/audio/groups/{group_id}/users | Add voiceprint to group
[**AddVoiceprintUploadApiV1AiAudioGroupsGroupIdUsersUploadPost**](AIVoiceprintAPI.md#AddVoiceprintUploadApiV1AiAudioGroupsGroupIdUsersUploadPost) | **Post** /api/v1/ai/audio/groups/{group_id}/users/upload | Add voiceprint via file upload
[**CreateVoiceprintGroupApiV1AiAudioGroupsCreatePost**](AIVoiceprintAPI.md#CreateVoiceprintGroupApiV1AiAudioGroupsCreatePost) | **Post** /api/v1/ai/audio/groups/create | Create voiceprint group
[**DeleteVoiceprintApiV1AiAudioGroupsGroupIdUsersFeatureIdDelete**](AIVoiceprintAPI.md#DeleteVoiceprintApiV1AiAudioGroupsGroupIdUsersFeatureIdDelete) | **Delete** /api/v1/ai/audio/groups/{group_id}/users/{feature_id} | Delete voiceprint from group
[**IdentifySpeakerApiV1AiAudioIdentifyPost**](AIVoiceprintAPI.md#IdentifySpeakerApiV1AiAudioIdentifyPost) | **Post** /api/v1/ai/audio/identify | Identify speaker from audio
[**IdentifySpeakerUploadApiV1AiAudioGroupsGroupIdIdentifyPost**](AIVoiceprintAPI.md#IdentifySpeakerUploadApiV1AiAudioGroupsGroupIdIdentifyPost) | **Post** /api/v1/ai/audio/groups/{group_id}/identify | Identify speaker (file upload)
[**ListVoiceprintGroupsApiV1AiAudioGroupsListGet**](AIVoiceprintAPI.md#ListVoiceprintGroupsApiV1AiAudioGroupsListGet) | **Get** /api/v1/ai/audio/groups/list | List voiceprint groups
[**ListVoiceprintsApiV1AiAudioGroupsGroupIdUsersGet**](AIVoiceprintAPI.md#ListVoiceprintsApiV1AiAudioGroupsGroupIdUsersGet) | **Get** /api/v1/ai/audio/groups/{group_id}/users | List voiceprints in group



## AddVoiceprintApiV1AiAudioGroupsGroupIdUsersPost

> interface{} AddVoiceprintApiV1AiAudioGroupsGroupIdUsersPost(ctx, groupId).VoiceprintFeatureCreate(voiceprintFeatureCreate).Execute()

Add voiceprint to group



### Example

```go
package main

import (
	"context"
	"fmt"
	"os"
	openapiclient "github.com/GIT_USER_ID/GIT_REPO_ID"
)

func main() {
	groupId := "groupId_example" // string | 
	voiceprintFeatureCreate := *openapiclient.NewVoiceprintFeatureCreate("Name_example") // VoiceprintFeatureCreate | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.AIVoiceprintAPI.AddVoiceprintApiV1AiAudioGroupsGroupIdUsersPost(context.Background(), groupId).VoiceprintFeatureCreate(voiceprintFeatureCreate).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `AIVoiceprintAPI.AddVoiceprintApiV1AiAudioGroupsGroupIdUsersPost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `AddVoiceprintApiV1AiAudioGroupsGroupIdUsersPost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `AIVoiceprintAPI.AddVoiceprintApiV1AiAudioGroupsGroupIdUsersPost`: %v\n", resp)
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**groupId** | **string** |  | 

### Other Parameters

Other parameters are passed through a pointer to a apiAddVoiceprintApiV1AiAudioGroupsGroupIdUsersPostRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------

 **voiceprintFeatureCreate** | [**VoiceprintFeatureCreate**](VoiceprintFeatureCreate.md) |  | 

### Return type

**interface{}**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

- **Content-Type**: application/json
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints)
[[Back to Model list]](../README.md#documentation-for-models)
[[Back to README]](../README.md)


## AddVoiceprintUploadApiV1AiAudioGroupsGroupIdUsersUploadPost

> interface{} AddVoiceprintUploadApiV1AiAudioGroupsGroupIdUsersUploadPost(ctx, groupId).File(file).Name(name).Desc(desc).Execute()

Add voiceprint via file upload



### Example

```go
package main

import (
	"context"
	"fmt"
	"os"
	openapiclient "github.com/GIT_USER_ID/GIT_REPO_ID"
)

func main() {
	groupId := "groupId_example" // string | 
	file := os.NewFile(1234, "some_file") // *os.File | 
	name := "name_example" // string | 
	desc := "desc_example" // string |  (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.AIVoiceprintAPI.AddVoiceprintUploadApiV1AiAudioGroupsGroupIdUsersUploadPost(context.Background(), groupId).File(file).Name(name).Desc(desc).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `AIVoiceprintAPI.AddVoiceprintUploadApiV1AiAudioGroupsGroupIdUsersUploadPost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `AddVoiceprintUploadApiV1AiAudioGroupsGroupIdUsersUploadPost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `AIVoiceprintAPI.AddVoiceprintUploadApiV1AiAudioGroupsGroupIdUsersUploadPost`: %v\n", resp)
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**groupId** | **string** |  | 

### Other Parameters

Other parameters are passed through a pointer to a apiAddVoiceprintUploadApiV1AiAudioGroupsGroupIdUsersUploadPostRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------

 **file** | ***os.File** |  | 
 **name** | **string** |  | 
 **desc** | **string** |  | 

### Return type

**interface{}**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

- **Content-Type**: multipart/form-data
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints)
[[Back to Model list]](../README.md#documentation-for-models)
[[Back to README]](../README.md)


## CreateVoiceprintGroupApiV1AiAudioGroupsCreatePost

> interface{} CreateVoiceprintGroupApiV1AiAudioGroupsCreatePost(ctx).VoiceprintGroupCreate(voiceprintGroupCreate).Execute()

Create voiceprint group



### Example

```go
package main

import (
	"context"
	"fmt"
	"os"
	openapiclient "github.com/GIT_USER_ID/GIT_REPO_ID"
)

func main() {
	voiceprintGroupCreate := *openapiclient.NewVoiceprintGroupCreate("Name_example") // VoiceprintGroupCreate | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.AIVoiceprintAPI.CreateVoiceprintGroupApiV1AiAudioGroupsCreatePost(context.Background()).VoiceprintGroupCreate(voiceprintGroupCreate).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `AIVoiceprintAPI.CreateVoiceprintGroupApiV1AiAudioGroupsCreatePost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `CreateVoiceprintGroupApiV1AiAudioGroupsCreatePost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `AIVoiceprintAPI.CreateVoiceprintGroupApiV1AiAudioGroupsCreatePost`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiCreateVoiceprintGroupApiV1AiAudioGroupsCreatePostRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **voiceprintGroupCreate** | [**VoiceprintGroupCreate**](VoiceprintGroupCreate.md) |  | 

### Return type

**interface{}**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

- **Content-Type**: application/json
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints)
[[Back to Model list]](../README.md#documentation-for-models)
[[Back to README]](../README.md)


## DeleteVoiceprintApiV1AiAudioGroupsGroupIdUsersFeatureIdDelete

> interface{} DeleteVoiceprintApiV1AiAudioGroupsGroupIdUsersFeatureIdDelete(ctx, groupId, featureId).Execute()

Delete voiceprint from group



### Example

```go
package main

import (
	"context"
	"fmt"
	"os"
	openapiclient "github.com/GIT_USER_ID/GIT_REPO_ID"
)

func main() {
	groupId := "groupId_example" // string | 
	featureId := "featureId_example" // string | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.AIVoiceprintAPI.DeleteVoiceprintApiV1AiAudioGroupsGroupIdUsersFeatureIdDelete(context.Background(), groupId, featureId).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `AIVoiceprintAPI.DeleteVoiceprintApiV1AiAudioGroupsGroupIdUsersFeatureIdDelete``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `DeleteVoiceprintApiV1AiAudioGroupsGroupIdUsersFeatureIdDelete`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `AIVoiceprintAPI.DeleteVoiceprintApiV1AiAudioGroupsGroupIdUsersFeatureIdDelete`: %v\n", resp)
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**groupId** | **string** |  | 
**featureId** | **string** |  | 

### Other Parameters

Other parameters are passed through a pointer to a apiDeleteVoiceprintApiV1AiAudioGroupsGroupIdUsersFeatureIdDeleteRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------



### Return type

**interface{}**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints)
[[Back to Model list]](../README.md#documentation-for-models)
[[Back to README]](../README.md)


## IdentifySpeakerApiV1AiAudioIdentifyPost

> interface{} IdentifySpeakerApiV1AiAudioIdentifyPost(ctx).SpeakerIdentifyRequest(speakerIdentifyRequest).Execute()

Identify speaker from audio



### Example

```go
package main

import (
	"context"
	"fmt"
	"os"
	openapiclient "github.com/GIT_USER_ID/GIT_REPO_ID"
)

func main() {
	speakerIdentifyRequest := *openapiclient.NewSpeakerIdentifyRequest("GroupId_example") // SpeakerIdentifyRequest | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.AIVoiceprintAPI.IdentifySpeakerApiV1AiAudioIdentifyPost(context.Background()).SpeakerIdentifyRequest(speakerIdentifyRequest).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `AIVoiceprintAPI.IdentifySpeakerApiV1AiAudioIdentifyPost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `IdentifySpeakerApiV1AiAudioIdentifyPost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `AIVoiceprintAPI.IdentifySpeakerApiV1AiAudioIdentifyPost`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiIdentifySpeakerApiV1AiAudioIdentifyPostRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **speakerIdentifyRequest** | [**SpeakerIdentifyRequest**](SpeakerIdentifyRequest.md) |  | 

### Return type

**interface{}**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

- **Content-Type**: application/json
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints)
[[Back to Model list]](../README.md#documentation-for-models)
[[Back to README]](../README.md)


## IdentifySpeakerUploadApiV1AiAudioGroupsGroupIdIdentifyPost

> interface{} IdentifySpeakerUploadApiV1AiAudioGroupsGroupIdIdentifyPost(ctx, groupId).File(file).Execute()

Identify speaker (file upload)



### Example

```go
package main

import (
	"context"
	"fmt"
	"os"
	openapiclient "github.com/GIT_USER_ID/GIT_REPO_ID"
)

func main() {
	groupId := "groupId_example" // string | 
	file := os.NewFile(1234, "some_file") // *os.File | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.AIVoiceprintAPI.IdentifySpeakerUploadApiV1AiAudioGroupsGroupIdIdentifyPost(context.Background(), groupId).File(file).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `AIVoiceprintAPI.IdentifySpeakerUploadApiV1AiAudioGroupsGroupIdIdentifyPost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `IdentifySpeakerUploadApiV1AiAudioGroupsGroupIdIdentifyPost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `AIVoiceprintAPI.IdentifySpeakerUploadApiV1AiAudioGroupsGroupIdIdentifyPost`: %v\n", resp)
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**groupId** | **string** |  | 

### Other Parameters

Other parameters are passed through a pointer to a apiIdentifySpeakerUploadApiV1AiAudioGroupsGroupIdIdentifyPostRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------

 **file** | ***os.File** |  | 

### Return type

**interface{}**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

- **Content-Type**: multipart/form-data
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints)
[[Back to Model list]](../README.md#documentation-for-models)
[[Back to README]](../README.md)


## ListVoiceprintGroupsApiV1AiAudioGroupsListGet

> interface{} ListVoiceprintGroupsApiV1AiAudioGroupsListGet(ctx).Execute()

List voiceprint groups



### Example

```go
package main

import (
	"context"
	"fmt"
	"os"
	openapiclient "github.com/GIT_USER_ID/GIT_REPO_ID"
)

func main() {

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.AIVoiceprintAPI.ListVoiceprintGroupsApiV1AiAudioGroupsListGet(context.Background()).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `AIVoiceprintAPI.ListVoiceprintGroupsApiV1AiAudioGroupsListGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `ListVoiceprintGroupsApiV1AiAudioGroupsListGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `AIVoiceprintAPI.ListVoiceprintGroupsApiV1AiAudioGroupsListGet`: %v\n", resp)
}
```

### Path Parameters

This endpoint does not need any parameter.

### Other Parameters

Other parameters are passed through a pointer to a apiListVoiceprintGroupsApiV1AiAudioGroupsListGetRequest struct via the builder pattern


### Return type

**interface{}**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints)
[[Back to Model list]](../README.md#documentation-for-models)
[[Back to README]](../README.md)


## ListVoiceprintsApiV1AiAudioGroupsGroupIdUsersGet

> interface{} ListVoiceprintsApiV1AiAudioGroupsGroupIdUsersGet(ctx, groupId).Execute()

List voiceprints in group



### Example

```go
package main

import (
	"context"
	"fmt"
	"os"
	openapiclient "github.com/GIT_USER_ID/GIT_REPO_ID"
)

func main() {
	groupId := "groupId_example" // string | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.AIVoiceprintAPI.ListVoiceprintsApiV1AiAudioGroupsGroupIdUsersGet(context.Background(), groupId).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `AIVoiceprintAPI.ListVoiceprintsApiV1AiAudioGroupsGroupIdUsersGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `ListVoiceprintsApiV1AiAudioGroupsGroupIdUsersGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `AIVoiceprintAPI.ListVoiceprintsApiV1AiAudioGroupsGroupIdUsersGet`: %v\n", resp)
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**groupId** | **string** |  | 

### Other Parameters

Other parameters are passed through a pointer to a apiListVoiceprintsApiV1AiAudioGroupsGroupIdUsersGetRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------


### Return type

**interface{}**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints)
[[Back to Model list]](../README.md#documentation-for-models)
[[Back to README]](../README.md)

