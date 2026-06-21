# \AIAudioAPI

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**AudioChatApiV1AiAudioChatPost**](AIAudioAPI.md#AudioChatApiV1AiAudioChatPost) | **Post** /api/v1/ai/audio/chat | Audio chat — voice/text in, text+voice out
[**CreateSpeechApiV1AiAudioSpeechPost**](AIAudioAPI.md#CreateSpeechApiV1AiAudioSpeechPost) | **Post** /api/v1/ai/audio/speech | Text-to-speech synthesis
[**DownloadAudioApiV1AiAudioAudioDownloadGet**](AIAudioAPI.md#DownloadAudioApiV1AiAudioAudioDownloadGet) | **Get** /api/v1/ai/audio/audio/download | Download audio by task_id
[**ListVoicesApiV1AiAudioVoicesGet**](AIAudioAPI.md#ListVoicesApiV1AiAudioVoicesGet) | **Get** /api/v1/ai/audio/voices | List available TTS voices
[**SpeechRecognizeApiV1AiAudioRecognizePost**](AIAudioAPI.md#SpeechRecognizeApiV1AiAudioRecognizePost) | **Post** /api/v1/ai/audio/recognize | Speech recognition (ASR)
[**UploadAudioForRecognitionApiV1AiAudioAudioUploadPost**](AIAudioAPI.md#UploadAudioForRecognitionApiV1AiAudioAudioUploadPost) | **Post** /api/v1/ai/audio/audio/upload | Upload audio file for speech recognition



## AudioChatApiV1AiAudioChatPost

> interface{} AudioChatApiV1AiAudioChatPost(ctx).AudioChatRequest(audioChatRequest).Execute()

Audio chat — voice/text in, text+voice out



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
	audioChatRequest := *openapiclient.NewAudioChatRequest() // AudioChatRequest | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.AIAudioAPI.AudioChatApiV1AiAudioChatPost(context.Background()).AudioChatRequest(audioChatRequest).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `AIAudioAPI.AudioChatApiV1AiAudioChatPost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `AudioChatApiV1AiAudioChatPost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `AIAudioAPI.AudioChatApiV1AiAudioChatPost`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiAudioChatApiV1AiAudioChatPostRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **audioChatRequest** | [**AudioChatRequest**](AudioChatRequest.md) |  | 

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


## CreateSpeechApiV1AiAudioSpeechPost

> interface{} CreateSpeechApiV1AiAudioSpeechPost(ctx).SpeechRequest(speechRequest).Execute()

Text-to-speech synthesis



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
	speechRequest := *openapiclient.NewSpeechRequest("Text_example") // SpeechRequest | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.AIAudioAPI.CreateSpeechApiV1AiAudioSpeechPost(context.Background()).SpeechRequest(speechRequest).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `AIAudioAPI.CreateSpeechApiV1AiAudioSpeechPost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `CreateSpeechApiV1AiAudioSpeechPost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `AIAudioAPI.CreateSpeechApiV1AiAudioSpeechPost`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiCreateSpeechApiV1AiAudioSpeechPostRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **speechRequest** | [**SpeechRequest**](SpeechRequest.md) |  | 

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


## DownloadAudioApiV1AiAudioAudioDownloadGet

> interface{} DownloadAudioApiV1AiAudioAudioDownloadGet(ctx).TaskId(taskId).Execute()

Download audio by task_id



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
	taskId := "taskId_example" // string | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.AIAudioAPI.DownloadAudioApiV1AiAudioAudioDownloadGet(context.Background()).TaskId(taskId).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `AIAudioAPI.DownloadAudioApiV1AiAudioAudioDownloadGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `DownloadAudioApiV1AiAudioAudioDownloadGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `AIAudioAPI.DownloadAudioApiV1AiAudioAudioDownloadGet`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiDownloadAudioApiV1AiAudioAudioDownloadGetRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **taskId** | **string** |  | 

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


## ListVoicesApiV1AiAudioVoicesGet

> interface{} ListVoicesApiV1AiAudioVoicesGet(ctx).Execute()

List available TTS voices



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
	resp, r, err := apiClient.AIAudioAPI.ListVoicesApiV1AiAudioVoicesGet(context.Background()).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `AIAudioAPI.ListVoicesApiV1AiAudioVoicesGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `ListVoicesApiV1AiAudioVoicesGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `AIAudioAPI.ListVoicesApiV1AiAudioVoicesGet`: %v\n", resp)
}
```

### Path Parameters

This endpoint does not need any parameter.

### Other Parameters

Other parameters are passed through a pointer to a apiListVoicesApiV1AiAudioVoicesGetRequest struct via the builder pattern


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


## SpeechRecognizeApiV1AiAudioRecognizePost

> interface{} SpeechRecognizeApiV1AiAudioRecognizePost(ctx).RecognizeRequest(recognizeRequest).Execute()

Speech recognition (ASR)



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
	recognizeRequest := *openapiclient.NewRecognizeRequest() // RecognizeRequest | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.AIAudioAPI.SpeechRecognizeApiV1AiAudioRecognizePost(context.Background()).RecognizeRequest(recognizeRequest).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `AIAudioAPI.SpeechRecognizeApiV1AiAudioRecognizePost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `SpeechRecognizeApiV1AiAudioRecognizePost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `AIAudioAPI.SpeechRecognizeApiV1AiAudioRecognizePost`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiSpeechRecognizeApiV1AiAudioRecognizePostRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **recognizeRequest** | [**RecognizeRequest**](RecognizeRequest.md) |  | 

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


## UploadAudioForRecognitionApiV1AiAudioAudioUploadPost

> interface{} UploadAudioForRecognitionApiV1AiAudioAudioUploadPost(ctx).File(file).Model(model).Language(language).Execute()

Upload audio file for speech recognition



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
	file := os.NewFile(1234, "some_file") // *os.File | 
	model := "model_example" // string |  (optional) (default to "paraformer-v2")
	language := "language_example" // string |  (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.AIAudioAPI.UploadAudioForRecognitionApiV1AiAudioAudioUploadPost(context.Background()).File(file).Model(model).Language(language).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `AIAudioAPI.UploadAudioForRecognitionApiV1AiAudioAudioUploadPost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `UploadAudioForRecognitionApiV1AiAudioAudioUploadPost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `AIAudioAPI.UploadAudioForRecognitionApiV1AiAudioAudioUploadPost`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiUploadAudioForRecognitionApiV1AiAudioAudioUploadPostRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **file** | ***os.File** |  | 
 **model** | **string** |  | [default to &quot;paraformer-v2&quot;]
 **language** | **string** |  | 

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

