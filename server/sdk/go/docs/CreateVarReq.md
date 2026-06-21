# CreateVarReq

## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**ConnectorId** | **string** |  | 
**Keyword** | **string** |  | 
**Value** | **string** |  | 
**Type** | Pointer to **NullableString** |  | [optional] 

## Methods

### NewCreateVarReq

`func NewCreateVarReq(connectorId string, keyword string, value string, ) *CreateVarReq`

NewCreateVarReq instantiates a new CreateVarReq object
This constructor will assign default values to properties that have it defined,
and makes sure properties required by API are set, but the set of arguments
will change when the set of required properties is changed

### NewCreateVarReqWithDefaults

`func NewCreateVarReqWithDefaults() *CreateVarReq`

NewCreateVarReqWithDefaults instantiates a new CreateVarReq object
This constructor will only assign default values to properties that have it defined,
but it doesn't guarantee that properties required by API are set

### GetConnectorId

`func (o *CreateVarReq) GetConnectorId() string`

GetConnectorId returns the ConnectorId field if non-nil, zero value otherwise.

### GetConnectorIdOk

`func (o *CreateVarReq) GetConnectorIdOk() (*string, bool)`

GetConnectorIdOk returns a tuple with the ConnectorId field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetConnectorId

`func (o *CreateVarReq) SetConnectorId(v string)`

SetConnectorId sets ConnectorId field to given value.


### GetKeyword

`func (o *CreateVarReq) GetKeyword() string`

GetKeyword returns the Keyword field if non-nil, zero value otherwise.

### GetKeywordOk

`func (o *CreateVarReq) GetKeywordOk() (*string, bool)`

GetKeywordOk returns a tuple with the Keyword field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetKeyword

`func (o *CreateVarReq) SetKeyword(v string)`

SetKeyword sets Keyword field to given value.


### GetValue

`func (o *CreateVarReq) GetValue() string`

GetValue returns the Value field if non-nil, zero value otherwise.

### GetValueOk

`func (o *CreateVarReq) GetValueOk() (*string, bool)`

GetValueOk returns a tuple with the Value field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetValue

`func (o *CreateVarReq) SetValue(v string)`

SetValue sets Value field to given value.


### GetType

`func (o *CreateVarReq) GetType() string`

GetType returns the Type field if non-nil, zero value otherwise.

### GetTypeOk

`func (o *CreateVarReq) GetTypeOk() (*string, bool)`

GetTypeOk returns a tuple with the Type field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetType

`func (o *CreateVarReq) SetType(v string)`

SetType sets Type field to given value.

### HasType

`func (o *CreateVarReq) HasType() bool`

HasType returns a boolean if a field has been set.

### SetTypeNil

`func (o *CreateVarReq) SetTypeNil(b bool)`

 SetTypeNil sets the value for Type to be an explicit nil

### UnsetType
`func (o *CreateVarReq) UnsetType()`

UnsetType ensures that no value is present for Type, not even an explicit nil

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


