# \CozeDatasetsAPI

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**CreateDatasetApiV1CozeDatasetsDatasetsPost**](CozeDatasetsAPI.md#CreateDatasetApiV1CozeDatasetsDatasetsPost) | **Post** /api/v1/coze/datasets/datasets | Create Dataset
[**CreateDatasetApiV1CozeDatasetsDatasetsPost_0**](CozeDatasetsAPI.md#CreateDatasetApiV1CozeDatasetsDatasetsPost_0) | **Post** /api/v1/coze/datasets/datasets | Create Dataset
[**ListDatasetsApiV1CozeDatasetsDatasetsListPost**](CozeDatasetsAPI.md#ListDatasetsApiV1CozeDatasetsDatasetsListPost) | **Post** /api/v1/coze/datasets/datasets/list | List Datasets
[**ListDatasetsApiV1CozeDatasetsDatasetsListPost_0**](CozeDatasetsAPI.md#ListDatasetsApiV1CozeDatasetsDatasetsListPost_0) | **Post** /api/v1/coze/datasets/datasets/list | List Datasets
[**ListDocumentsApiV1CozeDatasetsDatasetsDocumentsListPost**](CozeDatasetsAPI.md#ListDocumentsApiV1CozeDatasetsDatasetsDocumentsListPost) | **Post** /api/v1/coze/datasets/datasets/documents/list | List Documents
[**ListDocumentsApiV1CozeDatasetsDatasetsDocumentsListPost_0**](CozeDatasetsAPI.md#ListDocumentsApiV1CozeDatasetsDatasetsDocumentsListPost_0) | **Post** /api/v1/coze/datasets/datasets/documents/list | List Documents
[**ListImagesApiV1CozeDatasetsDatasetsImagesListPost**](CozeDatasetsAPI.md#ListImagesApiV1CozeDatasetsDatasetsImagesListPost) | **Post** /api/v1/coze/datasets/datasets/images/list | List Images
[**ListImagesApiV1CozeDatasetsDatasetsImagesListPost_0**](CozeDatasetsAPI.md#ListImagesApiV1CozeDatasetsDatasetsImagesListPost_0) | **Post** /api/v1/coze/datasets/datasets/images/list | List Images
[**UploadDocumentApiV1CozeDatasetsDatasetsDocumentsUploadPost**](CozeDatasetsAPI.md#UploadDocumentApiV1CozeDatasetsDatasetsDocumentsUploadPost) | **Post** /api/v1/coze/datasets/datasets/documents/upload | Upload Document
[**UploadDocumentApiV1CozeDatasetsDatasetsDocumentsUploadPost_0**](CozeDatasetsAPI.md#UploadDocumentApiV1CozeDatasetsDatasetsDocumentsUploadPost_0) | **Post** /api/v1/coze/datasets/datasets/documents/upload | Upload Document
[**UploadImageApiV1CozeDatasetsDatasetsImagesUploadPost**](CozeDatasetsAPI.md#UploadImageApiV1CozeDatasetsDatasetsImagesUploadPost) | **Post** /api/v1/coze/datasets/datasets/images/upload | Upload Image
[**UploadImageApiV1CozeDatasetsDatasetsImagesUploadPost_0**](CozeDatasetsAPI.md#UploadImageApiV1CozeDatasetsDatasetsImagesUploadPost_0) | **Post** /api/v1/coze/datasets/datasets/images/upload | Upload Image



## CreateDatasetApiV1CozeDatasetsDatasetsPost

> interface{} CreateDatasetApiV1CozeDatasetsDatasetsPost(ctx).DatasetCreateReq(datasetCreateReq).Execute()

Create Dataset

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
	datasetCreateReq := *openapiclient.NewDatasetCreateReq("Name_example", "SpaceId_example") // DatasetCreateReq | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.CozeDatasetsAPI.CreateDatasetApiV1CozeDatasetsDatasetsPost(context.Background()).DatasetCreateReq(datasetCreateReq).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `CozeDatasetsAPI.CreateDatasetApiV1CozeDatasetsDatasetsPost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `CreateDatasetApiV1CozeDatasetsDatasetsPost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `CozeDatasetsAPI.CreateDatasetApiV1CozeDatasetsDatasetsPost`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiCreateDatasetApiV1CozeDatasetsDatasetsPostRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **datasetCreateReq** | [**DatasetCreateReq**](DatasetCreateReq.md) |  | 

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


## CreateDatasetApiV1CozeDatasetsDatasetsPost_0

> interface{} CreateDatasetApiV1CozeDatasetsDatasetsPost_0(ctx).DatasetCreateReq(datasetCreateReq).Execute()

Create Dataset

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
	datasetCreateReq := *openapiclient.NewDatasetCreateReq("Name_example", "SpaceId_example") // DatasetCreateReq | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.CozeDatasetsAPI.CreateDatasetApiV1CozeDatasetsDatasetsPost_0(context.Background()).DatasetCreateReq(datasetCreateReq).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `CozeDatasetsAPI.CreateDatasetApiV1CozeDatasetsDatasetsPost_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `CreateDatasetApiV1CozeDatasetsDatasetsPost_0`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `CozeDatasetsAPI.CreateDatasetApiV1CozeDatasetsDatasetsPost_0`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiCreateDatasetApiV1CozeDatasetsDatasetsPost_1Request struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **datasetCreateReq** | [**DatasetCreateReq**](DatasetCreateReq.md) |  | 

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


## ListDatasetsApiV1CozeDatasetsDatasetsListPost

> interface{} ListDatasetsApiV1CozeDatasetsDatasetsListPost(ctx).DatasetListReq(datasetListReq).Execute()

List Datasets

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
	datasetListReq := *openapiclient.NewDatasetListReq("SpaceId_example") // DatasetListReq | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.CozeDatasetsAPI.ListDatasetsApiV1CozeDatasetsDatasetsListPost(context.Background()).DatasetListReq(datasetListReq).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `CozeDatasetsAPI.ListDatasetsApiV1CozeDatasetsDatasetsListPost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `ListDatasetsApiV1CozeDatasetsDatasetsListPost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `CozeDatasetsAPI.ListDatasetsApiV1CozeDatasetsDatasetsListPost`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiListDatasetsApiV1CozeDatasetsDatasetsListPostRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **datasetListReq** | [**DatasetListReq**](DatasetListReq.md) |  | 

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


## ListDatasetsApiV1CozeDatasetsDatasetsListPost_0

> interface{} ListDatasetsApiV1CozeDatasetsDatasetsListPost_0(ctx).DatasetListReq(datasetListReq).Execute()

List Datasets

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
	datasetListReq := *openapiclient.NewDatasetListReq("SpaceId_example") // DatasetListReq | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.CozeDatasetsAPI.ListDatasetsApiV1CozeDatasetsDatasetsListPost_0(context.Background()).DatasetListReq(datasetListReq).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `CozeDatasetsAPI.ListDatasetsApiV1CozeDatasetsDatasetsListPost_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `ListDatasetsApiV1CozeDatasetsDatasetsListPost_0`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `CozeDatasetsAPI.ListDatasetsApiV1CozeDatasetsDatasetsListPost_0`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiListDatasetsApiV1CozeDatasetsDatasetsListPost_2Request struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **datasetListReq** | [**DatasetListReq**](DatasetListReq.md) |  | 

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


## ListDocumentsApiV1CozeDatasetsDatasetsDocumentsListPost

> interface{} ListDocumentsApiV1CozeDatasetsDatasetsDocumentsListPost(ctx).DocListReq(docListReq).Execute()

List Documents

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
	docListReq := *openapiclient.NewDocListReq("DatasetId_example") // DocListReq | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.CozeDatasetsAPI.ListDocumentsApiV1CozeDatasetsDatasetsDocumentsListPost(context.Background()).DocListReq(docListReq).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `CozeDatasetsAPI.ListDocumentsApiV1CozeDatasetsDatasetsDocumentsListPost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `ListDocumentsApiV1CozeDatasetsDatasetsDocumentsListPost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `CozeDatasetsAPI.ListDocumentsApiV1CozeDatasetsDatasetsDocumentsListPost`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiListDocumentsApiV1CozeDatasetsDatasetsDocumentsListPostRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **docListReq** | [**DocListReq**](DocListReq.md) |  | 

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


## ListDocumentsApiV1CozeDatasetsDatasetsDocumentsListPost_0

> interface{} ListDocumentsApiV1CozeDatasetsDatasetsDocumentsListPost_0(ctx).DocListReq(docListReq).Execute()

List Documents

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
	docListReq := *openapiclient.NewDocListReq("DatasetId_example") // DocListReq | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.CozeDatasetsAPI.ListDocumentsApiV1CozeDatasetsDatasetsDocumentsListPost_0(context.Background()).DocListReq(docListReq).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `CozeDatasetsAPI.ListDocumentsApiV1CozeDatasetsDatasetsDocumentsListPost_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `ListDocumentsApiV1CozeDatasetsDatasetsDocumentsListPost_0`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `CozeDatasetsAPI.ListDocumentsApiV1CozeDatasetsDatasetsDocumentsListPost_0`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiListDocumentsApiV1CozeDatasetsDatasetsDocumentsListPost_3Request struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **docListReq** | [**DocListReq**](DocListReq.md) |  | 

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


## ListImagesApiV1CozeDatasetsDatasetsImagesListPost

> interface{} ListImagesApiV1CozeDatasetsDatasetsImagesListPost(ctx).ImageListReq(imageListReq).Execute()

List Images

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
	imageListReq := *openapiclient.NewImageListReq("DatasetId_example") // ImageListReq | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.CozeDatasetsAPI.ListImagesApiV1CozeDatasetsDatasetsImagesListPost(context.Background()).ImageListReq(imageListReq).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `CozeDatasetsAPI.ListImagesApiV1CozeDatasetsDatasetsImagesListPost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `ListImagesApiV1CozeDatasetsDatasetsImagesListPost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `CozeDatasetsAPI.ListImagesApiV1CozeDatasetsDatasetsImagesListPost`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiListImagesApiV1CozeDatasetsDatasetsImagesListPostRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **imageListReq** | [**ImageListReq**](ImageListReq.md) |  | 

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


## ListImagesApiV1CozeDatasetsDatasetsImagesListPost_0

> interface{} ListImagesApiV1CozeDatasetsDatasetsImagesListPost_0(ctx).ImageListReq(imageListReq).Execute()

List Images

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
	imageListReq := *openapiclient.NewImageListReq("DatasetId_example") // ImageListReq | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.CozeDatasetsAPI.ListImagesApiV1CozeDatasetsDatasetsImagesListPost_0(context.Background()).ImageListReq(imageListReq).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `CozeDatasetsAPI.ListImagesApiV1CozeDatasetsDatasetsImagesListPost_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `ListImagesApiV1CozeDatasetsDatasetsImagesListPost_0`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `CozeDatasetsAPI.ListImagesApiV1CozeDatasetsDatasetsImagesListPost_0`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiListImagesApiV1CozeDatasetsDatasetsImagesListPost_4Request struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **imageListReq** | [**ImageListReq**](ImageListReq.md) |  | 

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


## UploadDocumentApiV1CozeDatasetsDatasetsDocumentsUploadPost

> interface{} UploadDocumentApiV1CozeDatasetsDatasetsDocumentsUploadPost(ctx).DatasetId(datasetId).File(file).Execute()

Upload Document

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
	datasetId := "datasetId_example" // string | 
	file := os.NewFile(1234, "some_file") // *os.File | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.CozeDatasetsAPI.UploadDocumentApiV1CozeDatasetsDatasetsDocumentsUploadPost(context.Background()).DatasetId(datasetId).File(file).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `CozeDatasetsAPI.UploadDocumentApiV1CozeDatasetsDatasetsDocumentsUploadPost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `UploadDocumentApiV1CozeDatasetsDatasetsDocumentsUploadPost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `CozeDatasetsAPI.UploadDocumentApiV1CozeDatasetsDatasetsDocumentsUploadPost`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiUploadDocumentApiV1CozeDatasetsDatasetsDocumentsUploadPostRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **datasetId** | **string** |  | 
 **file** | ***os.File** |  | 

### Return type

**interface{}**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: multipart/form-data
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints)
[[Back to Model list]](../README.md#documentation-for-models)
[[Back to README]](../README.md)


## UploadDocumentApiV1CozeDatasetsDatasetsDocumentsUploadPost_0

> interface{} UploadDocumentApiV1CozeDatasetsDatasetsDocumentsUploadPost_0(ctx).DatasetId(datasetId).File(file).Execute()

Upload Document

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
	datasetId := "datasetId_example" // string | 
	file := os.NewFile(1234, "some_file") // *os.File | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.CozeDatasetsAPI.UploadDocumentApiV1CozeDatasetsDatasetsDocumentsUploadPost_0(context.Background()).DatasetId(datasetId).File(file).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `CozeDatasetsAPI.UploadDocumentApiV1CozeDatasetsDatasetsDocumentsUploadPost_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `UploadDocumentApiV1CozeDatasetsDatasetsDocumentsUploadPost_0`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `CozeDatasetsAPI.UploadDocumentApiV1CozeDatasetsDatasetsDocumentsUploadPost_0`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiUploadDocumentApiV1CozeDatasetsDatasetsDocumentsUploadPost_5Request struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **datasetId** | **string** |  | 
 **file** | ***os.File** |  | 

### Return type

**interface{}**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: multipart/form-data
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints)
[[Back to Model list]](../README.md#documentation-for-models)
[[Back to README]](../README.md)


## UploadImageApiV1CozeDatasetsDatasetsImagesUploadPost

> interface{} UploadImageApiV1CozeDatasetsDatasetsImagesUploadPost(ctx).DatasetId(datasetId).File(file).Execute()

Upload Image

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
	datasetId := "datasetId_example" // string | 
	file := os.NewFile(1234, "some_file") // *os.File | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.CozeDatasetsAPI.UploadImageApiV1CozeDatasetsDatasetsImagesUploadPost(context.Background()).DatasetId(datasetId).File(file).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `CozeDatasetsAPI.UploadImageApiV1CozeDatasetsDatasetsImagesUploadPost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `UploadImageApiV1CozeDatasetsDatasetsImagesUploadPost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `CozeDatasetsAPI.UploadImageApiV1CozeDatasetsDatasetsImagesUploadPost`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiUploadImageApiV1CozeDatasetsDatasetsImagesUploadPostRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **datasetId** | **string** |  | 
 **file** | ***os.File** |  | 

### Return type

**interface{}**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: multipart/form-data
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints)
[[Back to Model list]](../README.md#documentation-for-models)
[[Back to README]](../README.md)


## UploadImageApiV1CozeDatasetsDatasetsImagesUploadPost_0

> interface{} UploadImageApiV1CozeDatasetsDatasetsImagesUploadPost_0(ctx).DatasetId(datasetId).File(file).Execute()

Upload Image

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
	datasetId := "datasetId_example" // string | 
	file := os.NewFile(1234, "some_file") // *os.File | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.CozeDatasetsAPI.UploadImageApiV1CozeDatasetsDatasetsImagesUploadPost_0(context.Background()).DatasetId(datasetId).File(file).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `CozeDatasetsAPI.UploadImageApiV1CozeDatasetsDatasetsImagesUploadPost_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `UploadImageApiV1CozeDatasetsDatasetsImagesUploadPost_0`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `CozeDatasetsAPI.UploadImageApiV1CozeDatasetsDatasetsImagesUploadPost_0`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiUploadImageApiV1CozeDatasetsDatasetsImagesUploadPost_6Request struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **datasetId** | **string** |  | 
 **file** | ***os.File** |  | 

### Return type

**interface{}**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: multipart/form-data
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints)
[[Back to Model list]](../README.md#documentation-for-models)
[[Back to README]](../README.md)

