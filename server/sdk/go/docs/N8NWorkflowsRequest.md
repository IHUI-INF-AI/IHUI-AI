# N8NWorkflowsRequest

## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**N8nDomain** | **string** | N8N实例域名, e.g. &#39;zhangsan12.app.n8n.cloud&#39; | 
**ApiKey** | **string** | N8N API Key (X-N8N-API-KEY) | 

## Methods

### NewN8NWorkflowsRequest

`func NewN8NWorkflowsRequest(n8nDomain string, apiKey string, ) *N8NWorkflowsRequest`

NewN8NWorkflowsRequest instantiates a new N8NWorkflowsRequest object
This constructor will assign default values to properties that have it defined,
and makes sure properties required by API are set, but the set of arguments
will change when the set of required properties is changed

### NewN8NWorkflowsRequestWithDefaults

`func NewN8NWorkflowsRequestWithDefaults() *N8NWorkflowsRequest`

NewN8NWorkflowsRequestWithDefaults instantiates a new N8NWorkflowsRequest object
This constructor will only assign default values to properties that have it defined,
but it doesn't guarantee that properties required by API are set

### GetN8nDomain

`func (o *N8NWorkflowsRequest) GetN8nDomain() string`

GetN8nDomain returns the N8nDomain field if non-nil, zero value otherwise.

### GetN8nDomainOk

`func (o *N8NWorkflowsRequest) GetN8nDomainOk() (*string, bool)`

GetN8nDomainOk returns a tuple with the N8nDomain field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetN8nDomain

`func (o *N8NWorkflowsRequest) SetN8nDomain(v string)`

SetN8nDomain sets N8nDomain field to given value.


### GetApiKey

`func (o *N8NWorkflowsRequest) GetApiKey() string`

GetApiKey returns the ApiKey field if non-nil, zero value otherwise.

### GetApiKeyOk

`func (o *N8NWorkflowsRequest) GetApiKeyOk() (*string, bool)`

GetApiKeyOk returns a tuple with the ApiKey field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetApiKey

`func (o *N8NWorkflowsRequest) SetApiKey(v string)`

SetApiKey sets ApiKey field to given value.



[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


