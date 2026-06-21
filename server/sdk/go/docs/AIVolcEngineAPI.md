# \AIVolcEngineAPI

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**Jimeng31GenerateApiV1AiVolcengineJimengGeneratePost**](AIVolcEngineAPI.md#Jimeng31GenerateApiV1AiVolcengineJimengGeneratePost) | **Post** /api/v1/ai/volcengine/jimeng/generate | JiMeng 3.1 generation
[**Jimeng4ImageApiV1AiVolcengineJimengImagePost**](AIVolcEngineAPI.md#Jimeng4ImageApiV1AiVolcengineJimengImagePost) | **Post** /api/v1/ai/volcengine/jimeng/image | JiMeng 4.0 text-to-image (async)
[**Jimeng4ProcessApiV1AiVolcengineJimeng4ProcessPost**](AIVolcEngineAPI.md#Jimeng4ProcessApiV1AiVolcengineJimeng4ProcessPost) | **Post** /api/v1/ai/volcengine/jimeng4/process | 即梦4.0 CVProcess 通用转发
[**PingApiV1AiVolcenginePingGet**](AIVolcEngineAPI.md#PingApiV1AiVolcenginePingGet) | **Get** /api/v1/ai/volcengine/ping | Health check
[**VisualProxyApiV1AiVolcengineVisualReqKeyPost**](AIVolcEngineAPI.md#VisualProxyApiV1AiVolcengineVisualReqKeyPost) | **Post** /api/v1/ai/volcengine/visual/{req_key} | 火山视觉通用代理 (CVSync2Async async submit+poll)



## Jimeng31GenerateApiV1AiVolcengineJimengGeneratePost

> interface{} Jimeng31GenerateApiV1AiVolcengineJimengGeneratePost(ctx).Jimeng31Request(jimeng31Request).Execute()

JiMeng 3.1 generation



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
	jimeng31Request := *openapiclient.NewJimeng31Request("Prompt_example") // Jimeng31Request | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.AIVolcEngineAPI.Jimeng31GenerateApiV1AiVolcengineJimengGeneratePost(context.Background()).Jimeng31Request(jimeng31Request).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `AIVolcEngineAPI.Jimeng31GenerateApiV1AiVolcengineJimengGeneratePost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `Jimeng31GenerateApiV1AiVolcengineJimengGeneratePost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `AIVolcEngineAPI.Jimeng31GenerateApiV1AiVolcengineJimengGeneratePost`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiJimeng31GenerateApiV1AiVolcengineJimengGeneratePostRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **jimeng31Request** | [**Jimeng31Request**](Jimeng31Request.md) |  | 

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


## Jimeng4ImageApiV1AiVolcengineJimengImagePost

> interface{} Jimeng4ImageApiV1AiVolcengineJimengImagePost(ctx).Jimeng4ImageRequest(jimeng4ImageRequest).Execute()

JiMeng 4.0 text-to-image (async)



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
	jimeng4ImageRequest := *openapiclient.NewJimeng4ImageRequest("Prompt_example") // Jimeng4ImageRequest | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.AIVolcEngineAPI.Jimeng4ImageApiV1AiVolcengineJimengImagePost(context.Background()).Jimeng4ImageRequest(jimeng4ImageRequest).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `AIVolcEngineAPI.Jimeng4ImageApiV1AiVolcengineJimengImagePost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `Jimeng4ImageApiV1AiVolcengineJimengImagePost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `AIVolcEngineAPI.Jimeng4ImageApiV1AiVolcengineJimengImagePost`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiJimeng4ImageApiV1AiVolcengineJimengImagePostRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **jimeng4ImageRequest** | [**Jimeng4ImageRequest**](Jimeng4ImageRequest.md) |  | 

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


## Jimeng4ProcessApiV1AiVolcengineJimeng4ProcessPost

> interface{} Jimeng4ProcessApiV1AiVolcengineJimeng4ProcessPost(ctx).Jimeng4ProcessRequest(jimeng4ProcessRequest).Execute()

即梦4.0 CVProcess 通用转发



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
	jimeng4ProcessRequest := *openapiclient.NewJimeng4ProcessRequest("ReqKey_example") // Jimeng4ProcessRequest | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.AIVolcEngineAPI.Jimeng4ProcessApiV1AiVolcengineJimeng4ProcessPost(context.Background()).Jimeng4ProcessRequest(jimeng4ProcessRequest).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `AIVolcEngineAPI.Jimeng4ProcessApiV1AiVolcengineJimeng4ProcessPost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `Jimeng4ProcessApiV1AiVolcengineJimeng4ProcessPost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `AIVolcEngineAPI.Jimeng4ProcessApiV1AiVolcengineJimeng4ProcessPost`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiJimeng4ProcessApiV1AiVolcengineJimeng4ProcessPostRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **jimeng4ProcessRequest** | [**Jimeng4ProcessRequest**](Jimeng4ProcessRequest.md) |  | 

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


## PingApiV1AiVolcenginePingGet

> interface{} PingApiV1AiVolcenginePingGet(ctx).Execute()

Health check

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
	resp, r, err := apiClient.AIVolcEngineAPI.PingApiV1AiVolcenginePingGet(context.Background()).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `AIVolcEngineAPI.PingApiV1AiVolcenginePingGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `PingApiV1AiVolcenginePingGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `AIVolcEngineAPI.PingApiV1AiVolcenginePingGet`: %v\n", resp)
}
```

### Path Parameters

This endpoint does not need any parameter.

### Other Parameters

Other parameters are passed through a pointer to a apiPingApiV1AiVolcenginePingGetRequest struct via the builder pattern


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


## VisualProxyApiV1AiVolcengineVisualReqKeyPost

> interface{} VisualProxyApiV1AiVolcengineVisualReqKeyPost(ctx, reqKey).VisualGenericRequest(visualGenericRequest).Execute()

火山视觉通用代理 (CVSync2Async async submit+poll)



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
	reqKey := "reqKey_example" // string | 
	visualGenericRequest := *openapiclient.NewVisualGenericRequest("Prompt_example", "UserUuid_example") // VisualGenericRequest | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.AIVolcEngineAPI.VisualProxyApiV1AiVolcengineVisualReqKeyPost(context.Background(), reqKey).VisualGenericRequest(visualGenericRequest).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `AIVolcEngineAPI.VisualProxyApiV1AiVolcengineVisualReqKeyPost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `VisualProxyApiV1AiVolcengineVisualReqKeyPost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `AIVolcEngineAPI.VisualProxyApiV1AiVolcengineVisualReqKeyPost`: %v\n", resp)
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**reqKey** | **string** |  | 

### Other Parameters

Other parameters are passed through a pointer to a apiVisualProxyApiV1AiVolcengineVisualReqKeyPostRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------

 **visualGenericRequest** | [**VisualGenericRequest**](VisualGenericRequest.md) |  | 

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

