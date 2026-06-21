# \OpenRouterProxyAPI

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**CreditsApiV1OpenrouterProxyCreditsGet**](OpenRouterProxyAPI.md#CreditsApiV1OpenrouterProxyCreditsGet) | **Get** /api/v1/openrouter-proxy/credits | 账户额度
[**CreditsApiV1OpenrouterProxyCreditsGet_0**](OpenRouterProxyAPI.md#CreditsApiV1OpenrouterProxyCreditsGet_0) | **Get** /api/v1/openrouter-proxy/credits | 账户额度
[**OpenrouterChat**](OpenRouterProxyAPI.md#OpenrouterChat) | **Post** /api/v1/openrouter-proxy/chat | OpenRouter对话
[**OpenrouterChat_0**](OpenRouterProxyAPI.md#OpenrouterChat_0) | **Post** /api/v1/openrouter-proxy/chat | OpenRouter对话
[**OpenrouterCompletion**](OpenRouterProxyAPI.md#OpenrouterCompletion) | **Post** /api/v1/openrouter-proxy/completion | OpenRouter文本补全
[**OpenrouterCompletion_0**](OpenRouterProxyAPI.md#OpenrouterCompletion_0) | **Post** /api/v1/openrouter-proxy/completion | OpenRouter文本补全
[**OpenrouterEmbeddings**](OpenRouterProxyAPI.md#OpenrouterEmbeddings) | **Post** /api/v1/openrouter-proxy/embeddings | OpenRouter Embeddings
[**OpenrouterEmbeddings_0**](OpenRouterProxyAPI.md#OpenrouterEmbeddings_0) | **Post** /api/v1/openrouter-proxy/embeddings | OpenRouter Embeddings
[**OpenrouterModels**](OpenRouterProxyAPI.md#OpenrouterModels) | **Get** /api/v1/openrouter-proxy/models | 可用模型列表
[**OpenrouterModels_0**](OpenRouterProxyAPI.md#OpenrouterModels_0) | **Get** /api/v1/openrouter-proxy/models | 可用模型列表



## CreditsApiV1OpenrouterProxyCreditsGet

> interface{} CreditsApiV1OpenrouterProxyCreditsGet(ctx).ApiKey(apiKey).Execute()

账户额度

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
	apiKey := "apiKey_example" // string |  (optional) (default to "")

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.OpenRouterProxyAPI.CreditsApiV1OpenrouterProxyCreditsGet(context.Background()).ApiKey(apiKey).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `OpenRouterProxyAPI.CreditsApiV1OpenrouterProxyCreditsGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `CreditsApiV1OpenrouterProxyCreditsGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `OpenRouterProxyAPI.CreditsApiV1OpenrouterProxyCreditsGet`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiCreditsApiV1OpenrouterProxyCreditsGetRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **apiKey** | **string** |  | [default to &quot;&quot;]

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


## CreditsApiV1OpenrouterProxyCreditsGet_0

> interface{} CreditsApiV1OpenrouterProxyCreditsGet_0(ctx).ApiKey(apiKey).Execute()

账户额度

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
	apiKey := "apiKey_example" // string |  (optional) (default to "")

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.OpenRouterProxyAPI.CreditsApiV1OpenrouterProxyCreditsGet_0(context.Background()).ApiKey(apiKey).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `OpenRouterProxyAPI.CreditsApiV1OpenrouterProxyCreditsGet_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `CreditsApiV1OpenrouterProxyCreditsGet_0`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `OpenRouterProxyAPI.CreditsApiV1OpenrouterProxyCreditsGet_0`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiCreditsApiV1OpenrouterProxyCreditsGet_1Request struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **apiKey** | **string** |  | [default to &quot;&quot;]

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


## OpenrouterChat

> interface{} OpenrouterChat(ctx).BodyOpenrouterChat(bodyOpenrouterChat).ApiKey(apiKey).Execute()

OpenRouter对话

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
	bodyOpenrouterChat := *openapiclient.NewBodyOpenrouterChat([]interface{}{nil}) // BodyOpenrouterChat | 
	apiKey := "apiKey_example" // string |  (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.OpenRouterProxyAPI.OpenrouterChat(context.Background()).BodyOpenrouterChat(bodyOpenrouterChat).ApiKey(apiKey).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `OpenRouterProxyAPI.OpenrouterChat``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `OpenrouterChat`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `OpenRouterProxyAPI.OpenrouterChat`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiOpenrouterChatRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **bodyOpenrouterChat** | [**BodyOpenrouterChat**](BodyOpenrouterChat.md) |  | 
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


## OpenrouterChat_0

> interface{} OpenrouterChat_0(ctx).BodyOpenrouterChat(bodyOpenrouterChat).ApiKey(apiKey).Execute()

OpenRouter对话

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
	bodyOpenrouterChat := *openapiclient.NewBodyOpenrouterChat([]interface{}{nil}) // BodyOpenrouterChat | 
	apiKey := "apiKey_example" // string |  (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.OpenRouterProxyAPI.OpenrouterChat_0(context.Background()).BodyOpenrouterChat(bodyOpenrouterChat).ApiKey(apiKey).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `OpenRouterProxyAPI.OpenrouterChat_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `OpenrouterChat_0`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `OpenRouterProxyAPI.OpenrouterChat_0`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiOpenrouterChat_2Request struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **bodyOpenrouterChat** | [**BodyOpenrouterChat**](BodyOpenrouterChat.md) |  | 
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


## OpenrouterCompletion

> interface{} OpenrouterCompletion(ctx).BodyOpenrouterCompletion(bodyOpenrouterCompletion).ApiKey(apiKey).Execute()

OpenRouter文本补全

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
	bodyOpenrouterCompletion := *openapiclient.NewBodyOpenrouterCompletion("Prompt_example") // BodyOpenrouterCompletion | 
	apiKey := "apiKey_example" // string |  (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.OpenRouterProxyAPI.OpenrouterCompletion(context.Background()).BodyOpenrouterCompletion(bodyOpenrouterCompletion).ApiKey(apiKey).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `OpenRouterProxyAPI.OpenrouterCompletion``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `OpenrouterCompletion`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `OpenRouterProxyAPI.OpenrouterCompletion`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiOpenrouterCompletionRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **bodyOpenrouterCompletion** | [**BodyOpenrouterCompletion**](BodyOpenrouterCompletion.md) |  | 
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


## OpenrouterCompletion_0

> interface{} OpenrouterCompletion_0(ctx).BodyOpenrouterCompletion(bodyOpenrouterCompletion).ApiKey(apiKey).Execute()

OpenRouter文本补全

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
	bodyOpenrouterCompletion := *openapiclient.NewBodyOpenrouterCompletion("Prompt_example") // BodyOpenrouterCompletion | 
	apiKey := "apiKey_example" // string |  (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.OpenRouterProxyAPI.OpenrouterCompletion_0(context.Background()).BodyOpenrouterCompletion(bodyOpenrouterCompletion).ApiKey(apiKey).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `OpenRouterProxyAPI.OpenrouterCompletion_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `OpenrouterCompletion_0`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `OpenRouterProxyAPI.OpenrouterCompletion_0`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiOpenrouterCompletion_3Request struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **bodyOpenrouterCompletion** | [**BodyOpenrouterCompletion**](BodyOpenrouterCompletion.md) |  | 
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


## OpenrouterEmbeddings

> interface{} OpenrouterEmbeddings(ctx).BodyOpenrouterEmbeddings(bodyOpenrouterEmbeddings).ApiKey(apiKey).Execute()

OpenRouter Embeddings

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
	bodyOpenrouterEmbeddings := *openapiclient.NewBodyOpenrouterEmbeddings("InputText_example") // BodyOpenrouterEmbeddings | 
	apiKey := "apiKey_example" // string |  (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.OpenRouterProxyAPI.OpenrouterEmbeddings(context.Background()).BodyOpenrouterEmbeddings(bodyOpenrouterEmbeddings).ApiKey(apiKey).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `OpenRouterProxyAPI.OpenrouterEmbeddings``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `OpenrouterEmbeddings`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `OpenRouterProxyAPI.OpenrouterEmbeddings`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiOpenrouterEmbeddingsRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **bodyOpenrouterEmbeddings** | [**BodyOpenrouterEmbeddings**](BodyOpenrouterEmbeddings.md) |  | 
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


## OpenrouterEmbeddings_0

> interface{} OpenrouterEmbeddings_0(ctx).BodyOpenrouterEmbeddings(bodyOpenrouterEmbeddings).ApiKey(apiKey).Execute()

OpenRouter Embeddings

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
	bodyOpenrouterEmbeddings := *openapiclient.NewBodyOpenrouterEmbeddings("InputText_example") // BodyOpenrouterEmbeddings | 
	apiKey := "apiKey_example" // string |  (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.OpenRouterProxyAPI.OpenrouterEmbeddings_0(context.Background()).BodyOpenrouterEmbeddings(bodyOpenrouterEmbeddings).ApiKey(apiKey).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `OpenRouterProxyAPI.OpenrouterEmbeddings_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `OpenrouterEmbeddings_0`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `OpenRouterProxyAPI.OpenrouterEmbeddings_0`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiOpenrouterEmbeddings_4Request struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **bodyOpenrouterEmbeddings** | [**BodyOpenrouterEmbeddings**](BodyOpenrouterEmbeddings.md) |  | 
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


## OpenrouterModels

> interface{} OpenrouterModels(ctx).Execute()

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
	resp, r, err := apiClient.OpenRouterProxyAPI.OpenrouterModels(context.Background()).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `OpenRouterProxyAPI.OpenrouterModels``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `OpenrouterModels`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `OpenRouterProxyAPI.OpenrouterModels`: %v\n", resp)
}
```

### Path Parameters

This endpoint does not need any parameter.

### Other Parameters

Other parameters are passed through a pointer to a apiOpenrouterModelsRequest struct via the builder pattern


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


## OpenrouterModels_0

> interface{} OpenrouterModels_0(ctx).Execute()

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
	resp, r, err := apiClient.OpenRouterProxyAPI.OpenrouterModels_0(context.Background()).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `OpenRouterProxyAPI.OpenrouterModels_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `OpenrouterModels_0`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `OpenRouterProxyAPI.OpenrouterModels_0`: %v\n", resp)
}
```

### Path Parameters

This endpoint does not need any parameter.

### Other Parameters

Other parameters are passed through a pointer to a apiOpenrouterModels_5Request struct via the builder pattern


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

