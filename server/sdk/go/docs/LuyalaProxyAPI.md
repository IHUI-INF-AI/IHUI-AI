# \LuyalaProxyAPI

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**LuyalaChat**](LuyalaProxyAPI.md#LuyalaChat) | **Post** /api/v1/luyala-proxy/chat | 露雅拉对话
[**LuyalaChat_0**](LuyalaProxyAPI.md#LuyalaChat_0) | **Post** /api/v1/luyala-proxy/chat | 露雅拉对话
[**LuyalaCompletion**](LuyalaProxyAPI.md#LuyalaCompletion) | **Post** /api/v1/luyala-proxy/completion | 露雅拉文本补全
[**LuyalaCompletion_0**](LuyalaProxyAPI.md#LuyalaCompletion_0) | **Post** /api/v1/luyala-proxy/completion | 露雅拉文本补全
[**LuyalaEmbeddings**](LuyalaProxyAPI.md#LuyalaEmbeddings) | **Post** /api/v1/luyala-proxy/embeddings | 露雅拉Embedding
[**LuyalaEmbeddings_0**](LuyalaProxyAPI.md#LuyalaEmbeddings_0) | **Post** /api/v1/luyala-proxy/embeddings | 露雅拉Embedding
[**LuyalaModels**](LuyalaProxyAPI.md#LuyalaModels) | **Get** /api/v1/luyala-proxy/models | 可用模型列表
[**LuyalaModels_0**](LuyalaProxyAPI.md#LuyalaModels_0) | **Get** /api/v1/luyala-proxy/models | 可用模型列表



## LuyalaChat

> interface{} LuyalaChat(ctx).BodyLuyalaChat(bodyLuyalaChat).ApiKey(apiKey).Execute()

露雅拉对话

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
	bodyLuyalaChat := *openapiclient.NewBodyLuyalaChat([]interface{}{nil}) // BodyLuyalaChat | 
	apiKey := "apiKey_example" // string |  (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.LuyalaProxyAPI.LuyalaChat(context.Background()).BodyLuyalaChat(bodyLuyalaChat).ApiKey(apiKey).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `LuyalaProxyAPI.LuyalaChat``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `LuyalaChat`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `LuyalaProxyAPI.LuyalaChat`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiLuyalaChatRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **bodyLuyalaChat** | [**BodyLuyalaChat**](BodyLuyalaChat.md) |  | 
 **apiKey** | **string** |  | 

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


## LuyalaChat_0

> interface{} LuyalaChat_0(ctx).BodyLuyalaChat(bodyLuyalaChat).ApiKey(apiKey).Execute()

露雅拉对话

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
	bodyLuyalaChat := *openapiclient.NewBodyLuyalaChat([]interface{}{nil}) // BodyLuyalaChat | 
	apiKey := "apiKey_example" // string |  (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.LuyalaProxyAPI.LuyalaChat_0(context.Background()).BodyLuyalaChat(bodyLuyalaChat).ApiKey(apiKey).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `LuyalaProxyAPI.LuyalaChat_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `LuyalaChat_0`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `LuyalaProxyAPI.LuyalaChat_0`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiLuyalaChat_1Request struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **bodyLuyalaChat** | [**BodyLuyalaChat**](BodyLuyalaChat.md) |  | 
 **apiKey** | **string** |  | 

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


## LuyalaCompletion

> interface{} LuyalaCompletion(ctx).BodyLuyalaCompletion(bodyLuyalaCompletion).ApiKey(apiKey).Execute()

露雅拉文本补全

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
	bodyLuyalaCompletion := *openapiclient.NewBodyLuyalaCompletion("Prompt_example") // BodyLuyalaCompletion | 
	apiKey := "apiKey_example" // string |  (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.LuyalaProxyAPI.LuyalaCompletion(context.Background()).BodyLuyalaCompletion(bodyLuyalaCompletion).ApiKey(apiKey).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `LuyalaProxyAPI.LuyalaCompletion``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `LuyalaCompletion`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `LuyalaProxyAPI.LuyalaCompletion`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiLuyalaCompletionRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **bodyLuyalaCompletion** | [**BodyLuyalaCompletion**](BodyLuyalaCompletion.md) |  | 
 **apiKey** | **string** |  | 

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


## LuyalaCompletion_0

> interface{} LuyalaCompletion_0(ctx).BodyLuyalaCompletion(bodyLuyalaCompletion).ApiKey(apiKey).Execute()

露雅拉文本补全

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
	bodyLuyalaCompletion := *openapiclient.NewBodyLuyalaCompletion("Prompt_example") // BodyLuyalaCompletion | 
	apiKey := "apiKey_example" // string |  (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.LuyalaProxyAPI.LuyalaCompletion_0(context.Background()).BodyLuyalaCompletion(bodyLuyalaCompletion).ApiKey(apiKey).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `LuyalaProxyAPI.LuyalaCompletion_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `LuyalaCompletion_0`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `LuyalaProxyAPI.LuyalaCompletion_0`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiLuyalaCompletion_2Request struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **bodyLuyalaCompletion** | [**BodyLuyalaCompletion**](BodyLuyalaCompletion.md) |  | 
 **apiKey** | **string** |  | 

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


## LuyalaEmbeddings

> interface{} LuyalaEmbeddings(ctx).BodyLuyalaEmbeddings(bodyLuyalaEmbeddings).ApiKey(apiKey).Execute()

露雅拉Embedding

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
	bodyLuyalaEmbeddings := *openapiclient.NewBodyLuyalaEmbeddings("InputText_example") // BodyLuyalaEmbeddings | 
	apiKey := "apiKey_example" // string |  (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.LuyalaProxyAPI.LuyalaEmbeddings(context.Background()).BodyLuyalaEmbeddings(bodyLuyalaEmbeddings).ApiKey(apiKey).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `LuyalaProxyAPI.LuyalaEmbeddings``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `LuyalaEmbeddings`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `LuyalaProxyAPI.LuyalaEmbeddings`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiLuyalaEmbeddingsRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **bodyLuyalaEmbeddings** | [**BodyLuyalaEmbeddings**](BodyLuyalaEmbeddings.md) |  | 
 **apiKey** | **string** |  | 

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


## LuyalaEmbeddings_0

> interface{} LuyalaEmbeddings_0(ctx).BodyLuyalaEmbeddings(bodyLuyalaEmbeddings).ApiKey(apiKey).Execute()

露雅拉Embedding

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
	bodyLuyalaEmbeddings := *openapiclient.NewBodyLuyalaEmbeddings("InputText_example") // BodyLuyalaEmbeddings | 
	apiKey := "apiKey_example" // string |  (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.LuyalaProxyAPI.LuyalaEmbeddings_0(context.Background()).BodyLuyalaEmbeddings(bodyLuyalaEmbeddings).ApiKey(apiKey).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `LuyalaProxyAPI.LuyalaEmbeddings_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `LuyalaEmbeddings_0`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `LuyalaProxyAPI.LuyalaEmbeddings_0`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiLuyalaEmbeddings_3Request struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **bodyLuyalaEmbeddings** | [**BodyLuyalaEmbeddings**](BodyLuyalaEmbeddings.md) |  | 
 **apiKey** | **string** |  | 

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


## LuyalaModels

> interface{} LuyalaModels(ctx).Execute()

可用模型列表

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
	resp, r, err := apiClient.LuyalaProxyAPI.LuyalaModels(context.Background()).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `LuyalaProxyAPI.LuyalaModels``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `LuyalaModels`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `LuyalaProxyAPI.LuyalaModels`: %v\n", resp)
}
```

### Path Parameters

This endpoint does not need any parameter.

### Other Parameters

Other parameters are passed through a pointer to a apiLuyalaModelsRequest struct via the builder pattern


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


## LuyalaModels_0

> interface{} LuyalaModels_0(ctx).Execute()

可用模型列表

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
	resp, r, err := apiClient.LuyalaProxyAPI.LuyalaModels_0(context.Background()).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `LuyalaProxyAPI.LuyalaModels_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `LuyalaModels_0`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `LuyalaProxyAPI.LuyalaModels_0`: %v\n", resp)
}
```

### Path Parameters

This endpoint does not need any parameter.

### Other Parameters

Other parameters are passed through a pointer to a apiLuyalaModels_4Request struct via the builder pattern


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

