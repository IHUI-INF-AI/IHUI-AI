# \CozeAudioAPI

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**ChatAudioApiV1CozeAudioAudioChatAudioPost**](CozeAudioAPI.md#ChatAudioApiV1CozeAudioAudioChatAudioPost) | **Post** /api/v1/coze/audio/audio/chat-audio | Chat Audio
[**ChatAudioApiV1CozeAudioAudioChatAudioPost_0**](CozeAudioAPI.md#ChatAudioApiV1CozeAudioAudioChatAudioPost_0) | **Post** /api/v1/coze/audio/audio/chat-audio | Chat Audio
[**CreateSpeechApiV1CozeAudioAudioSpeechPost**](CozeAudioAPI.md#CreateSpeechApiV1CozeAudioAudioSpeechPost) | **Post** /api/v1/coze/audio/audio/speech | Create Speech
[**CreateSpeechApiV1CozeAudioAudioSpeechPost_0**](CozeAudioAPI.md#CreateSpeechApiV1CozeAudioAudioSpeechPost_0) | **Post** /api/v1/coze/audio/audio/speech | Create Speech
[**CreateVoiceprintApiV1CozeAudioAudioVoiceprintsPost**](CozeAudioAPI.md#CreateVoiceprintApiV1CozeAudioAudioVoiceprintsPost) | **Post** /api/v1/coze/audio/audio/voiceprints | Create Voiceprint
[**CreateVoiceprintApiV1CozeAudioAudioVoiceprintsPost_0**](CozeAudioAPI.md#CreateVoiceprintApiV1CozeAudioAudioVoiceprintsPost_0) | **Post** /api/v1/coze/audio/audio/voiceprints | Create Voiceprint
[**DeleteVoiceprintApiV1CozeAudioAudioVoiceprintsDelete**](CozeAudioAPI.md#DeleteVoiceprintApiV1CozeAudioAudioVoiceprintsDelete) | **Delete** /api/v1/coze/audio/audio/voiceprints | Delete Voiceprint
[**DeleteVoiceprintApiV1CozeAudioAudioVoiceprintsDelete_0**](CozeAudioAPI.md#DeleteVoiceprintApiV1CozeAudioAudioVoiceprintsDelete_0) | **Delete** /api/v1/coze/audio/audio/voiceprints | Delete Voiceprint
[**ListVoiceprintsApiV1CozeAudioAudioVoiceprintsGet**](CozeAudioAPI.md#ListVoiceprintsApiV1CozeAudioAudioVoiceprintsGet) | **Get** /api/v1/coze/audio/audio/voiceprints | List Voiceprints
[**ListVoiceprintsApiV1CozeAudioAudioVoiceprintsGet_0**](CozeAudioAPI.md#ListVoiceprintsApiV1CozeAudioAudioVoiceprintsGet_0) | **Get** /api/v1/coze/audio/audio/voiceprints | List Voiceprints
[**ListVoicesApiV1CozeAudioAudioVoicesGet**](CozeAudioAPI.md#ListVoicesApiV1CozeAudioAudioVoicesGet) | **Get** /api/v1/coze/audio/audio/voices | List Voices
[**ListVoicesApiV1CozeAudioAudioVoicesGet_0**](CozeAudioAPI.md#ListVoicesApiV1CozeAudioAudioVoicesGet_0) | **Get** /api/v1/coze/audio/audio/voices | List Voices
[**UpdateVoiceprintApiV1CozeAudioAudioVoiceprintsPut**](CozeAudioAPI.md#UpdateVoiceprintApiV1CozeAudioAudioVoiceprintsPut) | **Put** /api/v1/coze/audio/audio/voiceprints | Update Voiceprint
[**UpdateVoiceprintApiV1CozeAudioAudioVoiceprintsPut_0**](CozeAudioAPI.md#UpdateVoiceprintApiV1CozeAudioAudioVoiceprintsPut_0) | **Put** /api/v1/coze/audio/audio/voiceprints | Update Voiceprint



## ChatAudioApiV1CozeAudioAudioChatAudioPost

> interface{} ChatAudioApiV1CozeAudioAudioChatAudioPost(ctx).ChatAudioReq(chatAudioReq).Execute()

Chat Audio

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
	chatAudioReq := *openapiclient.NewChatAudioReq("BotId_example", "AudioData_example") // ChatAudioReq | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.CozeAudioAPI.ChatAudioApiV1CozeAudioAudioChatAudioPost(context.Background()).ChatAudioReq(chatAudioReq).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `CozeAudioAPI.ChatAudioApiV1CozeAudioAudioChatAudioPost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `ChatAudioApiV1CozeAudioAudioChatAudioPost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `CozeAudioAPI.ChatAudioApiV1CozeAudioAudioChatAudioPost`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiChatAudioApiV1CozeAudioAudioChatAudioPostRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **chatAudioReq** | [**ChatAudioReq**](ChatAudioReq.md) |  | 

### Return type

**interface{}**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: application/json
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints)
[[Back to Model list]](../README.md#documentation-for-models)
[[Back to README]](../README.md)


## ChatAudioApiV1CozeAudioAudioChatAudioPost_0

> interface{} ChatAudioApiV1CozeAudioAudioChatAudioPost_0(ctx).ChatAudioReq(chatAudioReq).Execute()

Chat Audio

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
	chatAudioReq := *openapiclient.NewChatAudioReq("BotId_example", "AudioData_example") // ChatAudioReq | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.CozeAudioAPI.ChatAudioApiV1CozeAudioAudioChatAudioPost_0(context.Background()).ChatAudioReq(chatAudioReq).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `CozeAudioAPI.ChatAudioApiV1CozeAudioAudioChatAudioPost_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `ChatAudioApiV1CozeAudioAudioChatAudioPost_0`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `CozeAudioAPI.ChatAudioApiV1CozeAudioAudioChatAudioPost_0`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiChatAudioApiV1CozeAudioAudioChatAudioPost_1Request struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **chatAudioReq** | [**ChatAudioReq**](ChatAudioReq.md) |  | 

### Return type

**interface{}**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: application/json
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints)
[[Back to Model list]](../README.md#documentation-for-models)
[[Back to README]](../README.md)


## CreateSpeechApiV1CozeAudioAudioSpeechPost

> interface{} CreateSpeechApiV1CozeAudioAudioSpeechPost(ctx).SpeechReq(speechReq).Execute()

Create Speech

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
	speechReq := *openapiclient.NewSpeechReq("Input_example", "VoiceId_example") // SpeechReq | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.CozeAudioAPI.CreateSpeechApiV1CozeAudioAudioSpeechPost(context.Background()).SpeechReq(speechReq).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `CozeAudioAPI.CreateSpeechApiV1CozeAudioAudioSpeechPost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `CreateSpeechApiV1CozeAudioAudioSpeechPost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `CozeAudioAPI.CreateSpeechApiV1CozeAudioAudioSpeechPost`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiCreateSpeechApiV1CozeAudioAudioSpeechPostRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **speechReq** | [**SpeechReq**](SpeechReq.md) |  | 

### Return type

**interface{}**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: application/json
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints)
[[Back to Model list]](../README.md#documentation-for-models)
[[Back to README]](../README.md)


## CreateSpeechApiV1CozeAudioAudioSpeechPost_0

> interface{} CreateSpeechApiV1CozeAudioAudioSpeechPost_0(ctx).SpeechReq(speechReq).Execute()

Create Speech

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
	speechReq := *openapiclient.NewSpeechReq("Input_example", "VoiceId_example") // SpeechReq | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.CozeAudioAPI.CreateSpeechApiV1CozeAudioAudioSpeechPost_0(context.Background()).SpeechReq(speechReq).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `CozeAudioAPI.CreateSpeechApiV1CozeAudioAudioSpeechPost_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `CreateSpeechApiV1CozeAudioAudioSpeechPost_0`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `CozeAudioAPI.CreateSpeechApiV1CozeAudioAudioSpeechPost_0`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiCreateSpeechApiV1CozeAudioAudioSpeechPost_2Request struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **speechReq** | [**SpeechReq**](SpeechReq.md) |  | 

### Return type

**interface{}**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: application/json
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints)
[[Back to Model list]](../README.md#documentation-for-models)
[[Back to README]](../README.md)


## CreateVoiceprintApiV1CozeAudioAudioVoiceprintsPost

> interface{} CreateVoiceprintApiV1CozeAudioAudioVoiceprintsPost(ctx).VoiceprintCreateReq(voiceprintCreateReq).Execute()

Create Voiceprint

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
	voiceprintCreateReq := *openapiclient.NewVoiceprintCreateReq("Name_example") // VoiceprintCreateReq | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.CozeAudioAPI.CreateVoiceprintApiV1CozeAudioAudioVoiceprintsPost(context.Background()).VoiceprintCreateReq(voiceprintCreateReq).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `CozeAudioAPI.CreateVoiceprintApiV1CozeAudioAudioVoiceprintsPost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `CreateVoiceprintApiV1CozeAudioAudioVoiceprintsPost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `CozeAudioAPI.CreateVoiceprintApiV1CozeAudioAudioVoiceprintsPost`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiCreateVoiceprintApiV1CozeAudioAudioVoiceprintsPostRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **voiceprintCreateReq** | [**VoiceprintCreateReq**](VoiceprintCreateReq.md) |  | 

### Return type

**interface{}**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: application/json
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints)
[[Back to Model list]](../README.md#documentation-for-models)
[[Back to README]](../README.md)


## CreateVoiceprintApiV1CozeAudioAudioVoiceprintsPost_0

> interface{} CreateVoiceprintApiV1CozeAudioAudioVoiceprintsPost_0(ctx).VoiceprintCreateReq(voiceprintCreateReq).Execute()

Create Voiceprint

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
	voiceprintCreateReq := *openapiclient.NewVoiceprintCreateReq("Name_example") // VoiceprintCreateReq | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.CozeAudioAPI.CreateVoiceprintApiV1CozeAudioAudioVoiceprintsPost_0(context.Background()).VoiceprintCreateReq(voiceprintCreateReq).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `CozeAudioAPI.CreateVoiceprintApiV1CozeAudioAudioVoiceprintsPost_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `CreateVoiceprintApiV1CozeAudioAudioVoiceprintsPost_0`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `CozeAudioAPI.CreateVoiceprintApiV1CozeAudioAudioVoiceprintsPost_0`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiCreateVoiceprintApiV1CozeAudioAudioVoiceprintsPost_3Request struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **voiceprintCreateReq** | [**VoiceprintCreateReq**](VoiceprintCreateReq.md) |  | 

### Return type

**interface{}**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: application/json
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints)
[[Back to Model list]](../README.md#documentation-for-models)
[[Back to README]](../README.md)


## DeleteVoiceprintApiV1CozeAudioAudioVoiceprintsDelete

> interface{} DeleteVoiceprintApiV1CozeAudioAudioVoiceprintsDelete(ctx).VoiceprintDeleteReq(voiceprintDeleteReq).Execute()

Delete Voiceprint

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
	voiceprintDeleteReq := *openapiclient.NewVoiceprintDeleteReq("VoiceprintId_example") // VoiceprintDeleteReq | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.CozeAudioAPI.DeleteVoiceprintApiV1CozeAudioAudioVoiceprintsDelete(context.Background()).VoiceprintDeleteReq(voiceprintDeleteReq).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `CozeAudioAPI.DeleteVoiceprintApiV1CozeAudioAudioVoiceprintsDelete``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `DeleteVoiceprintApiV1CozeAudioAudioVoiceprintsDelete`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `CozeAudioAPI.DeleteVoiceprintApiV1CozeAudioAudioVoiceprintsDelete`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiDeleteVoiceprintApiV1CozeAudioAudioVoiceprintsDeleteRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **voiceprintDeleteReq** | [**VoiceprintDeleteReq**](VoiceprintDeleteReq.md) |  | 

### Return type

**interface{}**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: application/json
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints)
[[Back to Model list]](../README.md#documentation-for-models)
[[Back to README]](../README.md)


## DeleteVoiceprintApiV1CozeAudioAudioVoiceprintsDelete_0

> interface{} DeleteVoiceprintApiV1CozeAudioAudioVoiceprintsDelete_0(ctx).VoiceprintDeleteReq(voiceprintDeleteReq).Execute()

Delete Voiceprint

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
	voiceprintDeleteReq := *openapiclient.NewVoiceprintDeleteReq("VoiceprintId_example") // VoiceprintDeleteReq | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.CozeAudioAPI.DeleteVoiceprintApiV1CozeAudioAudioVoiceprintsDelete_0(context.Background()).VoiceprintDeleteReq(voiceprintDeleteReq).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `CozeAudioAPI.DeleteVoiceprintApiV1CozeAudioAudioVoiceprintsDelete_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `DeleteVoiceprintApiV1CozeAudioAudioVoiceprintsDelete_0`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `CozeAudioAPI.DeleteVoiceprintApiV1CozeAudioAudioVoiceprintsDelete_0`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiDeleteVoiceprintApiV1CozeAudioAudioVoiceprintsDelete_4Request struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **voiceprintDeleteReq** | [**VoiceprintDeleteReq**](VoiceprintDeleteReq.md) |  | 

### Return type

**interface{}**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: application/json
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints)
[[Back to Model list]](../README.md#documentation-for-models)
[[Back to README]](../README.md)


## ListVoiceprintsApiV1CozeAudioAudioVoiceprintsGet

> interface{} ListVoiceprintsApiV1CozeAudioAudioVoiceprintsGet(ctx).Execute()

List Voiceprints

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
	resp, r, err := apiClient.CozeAudioAPI.ListVoiceprintsApiV1CozeAudioAudioVoiceprintsGet(context.Background()).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `CozeAudioAPI.ListVoiceprintsApiV1CozeAudioAudioVoiceprintsGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `ListVoiceprintsApiV1CozeAudioAudioVoiceprintsGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `CozeAudioAPI.ListVoiceprintsApiV1CozeAudioAudioVoiceprintsGet`: %v\n", resp)
}
```

### Path Parameters

This endpoint does not need any parameter.

### Other Parameters

Other parameters are passed through a pointer to a apiListVoiceprintsApiV1CozeAudioAudioVoiceprintsGetRequest struct via the builder pattern


### Return type

**interface{}**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints)
[[Back to Model list]](../README.md#documentation-for-models)
[[Back to README]](../README.md)


## ListVoiceprintsApiV1CozeAudioAudioVoiceprintsGet_0

> interface{} ListVoiceprintsApiV1CozeAudioAudioVoiceprintsGet_0(ctx).Execute()

List Voiceprints

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
	resp, r, err := apiClient.CozeAudioAPI.ListVoiceprintsApiV1CozeAudioAudioVoiceprintsGet_0(context.Background()).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `CozeAudioAPI.ListVoiceprintsApiV1CozeAudioAudioVoiceprintsGet_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `ListVoiceprintsApiV1CozeAudioAudioVoiceprintsGet_0`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `CozeAudioAPI.ListVoiceprintsApiV1CozeAudioAudioVoiceprintsGet_0`: %v\n", resp)
}
```

### Path Parameters

This endpoint does not need any parameter.

### Other Parameters

Other parameters are passed through a pointer to a apiListVoiceprintsApiV1CozeAudioAudioVoiceprintsGet_5Request struct via the builder pattern


### Return type

**interface{}**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints)
[[Back to Model list]](../README.md#documentation-for-models)
[[Back to README]](../README.md)


## ListVoicesApiV1CozeAudioAudioVoicesGet

> interface{} ListVoicesApiV1CozeAudioAudioVoicesGet(ctx).FilterType(filterType).Execute()

List Voices

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
	filterType := "filterType_example" // string |  (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.CozeAudioAPI.ListVoicesApiV1CozeAudioAudioVoicesGet(context.Background()).FilterType(filterType).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `CozeAudioAPI.ListVoicesApiV1CozeAudioAudioVoicesGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `ListVoicesApiV1CozeAudioAudioVoicesGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `CozeAudioAPI.ListVoicesApiV1CozeAudioAudioVoicesGet`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiListVoicesApiV1CozeAudioAudioVoicesGetRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **filterType** | **string** |  | 

### Return type

**interface{}**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints)
[[Back to Model list]](../README.md#documentation-for-models)
[[Back to README]](../README.md)


## ListVoicesApiV1CozeAudioAudioVoicesGet_0

> interface{} ListVoicesApiV1CozeAudioAudioVoicesGet_0(ctx).FilterType(filterType).Execute()

List Voices

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
	filterType := "filterType_example" // string |  (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.CozeAudioAPI.ListVoicesApiV1CozeAudioAudioVoicesGet_0(context.Background()).FilterType(filterType).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `CozeAudioAPI.ListVoicesApiV1CozeAudioAudioVoicesGet_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `ListVoicesApiV1CozeAudioAudioVoicesGet_0`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `CozeAudioAPI.ListVoicesApiV1CozeAudioAudioVoicesGet_0`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiListVoicesApiV1CozeAudioAudioVoicesGet_6Request struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **filterType** | **string** |  | 

### Return type

**interface{}**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints)
[[Back to Model list]](../README.md#documentation-for-models)
[[Back to README]](../README.md)


## UpdateVoiceprintApiV1CozeAudioAudioVoiceprintsPut

> interface{} UpdateVoiceprintApiV1CozeAudioAudioVoiceprintsPut(ctx).VoiceprintUpdateReq(voiceprintUpdateReq).Execute()

Update Voiceprint

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
	voiceprintUpdateReq := *openapiclient.NewVoiceprintUpdateReq("VoiceprintId_example") // VoiceprintUpdateReq | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.CozeAudioAPI.UpdateVoiceprintApiV1CozeAudioAudioVoiceprintsPut(context.Background()).VoiceprintUpdateReq(voiceprintUpdateReq).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `CozeAudioAPI.UpdateVoiceprintApiV1CozeAudioAudioVoiceprintsPut``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `UpdateVoiceprintApiV1CozeAudioAudioVoiceprintsPut`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `CozeAudioAPI.UpdateVoiceprintApiV1CozeAudioAudioVoiceprintsPut`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiUpdateVoiceprintApiV1CozeAudioAudioVoiceprintsPutRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **voiceprintUpdateReq** | [**VoiceprintUpdateReq**](VoiceprintUpdateReq.md) |  | 

### Return type

**interface{}**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: application/json
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints)
[[Back to Model list]](../README.md#documentation-for-models)
[[Back to README]](../README.md)


## UpdateVoiceprintApiV1CozeAudioAudioVoiceprintsPut_0

> interface{} UpdateVoiceprintApiV1CozeAudioAudioVoiceprintsPut_0(ctx).VoiceprintUpdateReq(voiceprintUpdateReq).Execute()

Update Voiceprint

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
	voiceprintUpdateReq := *openapiclient.NewVoiceprintUpdateReq("VoiceprintId_example") // VoiceprintUpdateReq | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.CozeAudioAPI.UpdateVoiceprintApiV1CozeAudioAudioVoiceprintsPut_0(context.Background()).VoiceprintUpdateReq(voiceprintUpdateReq).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `CozeAudioAPI.UpdateVoiceprintApiV1CozeAudioAudioVoiceprintsPut_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `UpdateVoiceprintApiV1CozeAudioAudioVoiceprintsPut_0`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `CozeAudioAPI.UpdateVoiceprintApiV1CozeAudioAudioVoiceprintsPut_0`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiUpdateVoiceprintApiV1CozeAudioAudioVoiceprintsPut_7Request struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **voiceprintUpdateReq** | [**VoiceprintUpdateReq**](VoiceprintUpdateReq.md) |  | 

### Return type

**interface{}**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: application/json
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints)
[[Back to Model list]](../README.md#documentation-for-models)
[[Back to README]](../README.md)

