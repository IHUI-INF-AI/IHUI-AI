# \StockAnalyseAPI

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**StockAnalysePostApiV1CozeZhsApiStockAnalysePost**](StockAnalyseAPI.md#StockAnalysePostApiV1CozeZhsApiStockAnalysePost) | **Post** /api/v1/cozeZhsApi/stock/analyse | Stock Analyse Post
[**StockAnalysePostApiV1CozeZhsApiStockAnalysePost_0**](StockAnalyseAPI.md#StockAnalysePostApiV1CozeZhsApiStockAnalysePost_0) | **Post** /api/v1/cozeZhsApi/stock/analyse | Stock Analyse Post



## StockAnalysePostApiV1CozeZhsApiStockAnalysePost

> interface{} StockAnalysePostApiV1CozeZhsApiStockAnalysePost(ctx).StockAnalyseRequest(stockAnalyseRequest).Execute()

Stock Analyse Post

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
	stockAnalyseRequest := *openapiclient.NewStockAnalyseRequest("Prompt_example", "UserUuid_example") // StockAnalyseRequest | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.StockAnalyseAPI.StockAnalysePostApiV1CozeZhsApiStockAnalysePost(context.Background()).StockAnalyseRequest(stockAnalyseRequest).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `StockAnalyseAPI.StockAnalysePostApiV1CozeZhsApiStockAnalysePost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `StockAnalysePostApiV1CozeZhsApiStockAnalysePost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `StockAnalyseAPI.StockAnalysePostApiV1CozeZhsApiStockAnalysePost`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiStockAnalysePostApiV1CozeZhsApiStockAnalysePostRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **stockAnalyseRequest** | [**StockAnalyseRequest**](StockAnalyseRequest.md) |  | 

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


## StockAnalysePostApiV1CozeZhsApiStockAnalysePost_0

> interface{} StockAnalysePostApiV1CozeZhsApiStockAnalysePost_0(ctx).StockAnalyseRequest(stockAnalyseRequest).Execute()

Stock Analyse Post

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
	stockAnalyseRequest := *openapiclient.NewStockAnalyseRequest("Prompt_example", "UserUuid_example") // StockAnalyseRequest | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.StockAnalyseAPI.StockAnalysePostApiV1CozeZhsApiStockAnalysePost_0(context.Background()).StockAnalyseRequest(stockAnalyseRequest).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `StockAnalyseAPI.StockAnalysePostApiV1CozeZhsApiStockAnalysePost_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `StockAnalysePostApiV1CozeZhsApiStockAnalysePost_0`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `StockAnalyseAPI.StockAnalysePostApiV1CozeZhsApiStockAnalysePost_0`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiStockAnalysePostApiV1CozeZhsApiStockAnalysePost_1Request struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **stockAnalyseRequest** | [**StockAnalyseRequest**](StockAnalyseRequest.md) |  | 

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

