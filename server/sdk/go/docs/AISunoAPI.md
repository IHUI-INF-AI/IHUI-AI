# \AISunoAPI

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**GenerateMusicApiV1AiSunoGenerateMusicPost**](AISunoAPI.md#GenerateMusicApiV1AiSunoGenerateMusicPost) | **Post** /api/v1/ai/suno/generate/music | Suno AI 音乐生成
[**QueryMusicApiV1AiSunoQueryMusicTaskIdGet**](AISunoAPI.md#QueryMusicApiV1AiSunoQueryMusicTaskIdGet) | **Get** /api/v1/ai/suno/query/music/{task_id} | 查询Suno音乐任务状态



## GenerateMusicApiV1AiSunoGenerateMusicPost

> interface{} GenerateMusicApiV1AiSunoGenerateMusicPost(ctx).GenerateMusicRequest(generateMusicRequest).Execute()

Suno AI 音乐生成



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
	generateMusicRequest := *openapiclient.NewGenerateMusicRequest("Prompt_example") // GenerateMusicRequest | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.AISunoAPI.GenerateMusicApiV1AiSunoGenerateMusicPost(context.Background()).GenerateMusicRequest(generateMusicRequest).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `AISunoAPI.GenerateMusicApiV1AiSunoGenerateMusicPost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `GenerateMusicApiV1AiSunoGenerateMusicPost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `AISunoAPI.GenerateMusicApiV1AiSunoGenerateMusicPost`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiGenerateMusicApiV1AiSunoGenerateMusicPostRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **generateMusicRequest** | [**GenerateMusicRequest**](GenerateMusicRequest.md) |  | 

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


## QueryMusicApiV1AiSunoQueryMusicTaskIdGet

> interface{} QueryMusicApiV1AiSunoQueryMusicTaskIdGet(ctx, taskId).Execute()

查询Suno音乐任务状态



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
	resp, r, err := apiClient.AISunoAPI.QueryMusicApiV1AiSunoQueryMusicTaskIdGet(context.Background(), taskId).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `AISunoAPI.QueryMusicApiV1AiSunoQueryMusicTaskIdGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `QueryMusicApiV1AiSunoQueryMusicTaskIdGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `AISunoAPI.QueryMusicApiV1AiSunoQueryMusicTaskIdGet`: %v\n", resp)
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**taskId** | **string** |  | 

### Other Parameters

Other parameters are passed through a pointer to a apiQueryMusicApiV1AiSunoQueryMusicTaskIdGetRequest struct via the builder pattern


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

