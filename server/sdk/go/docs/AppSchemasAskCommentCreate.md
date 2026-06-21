# AppSchemasAskCommentCreate

## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**TargetType** | **string** |  | 
**TargetId** | **int32** |  | 
**Content** | **string** |  | 
**Pid** | Pointer to **int32** |  | [optional] [default to 0]

## Methods

### NewAppSchemasAskCommentCreate

`func NewAppSchemasAskCommentCreate(targetType string, targetId int32, content string, ) *AppSchemasAskCommentCreate`

NewAppSchemasAskCommentCreate instantiates a new AppSchemasAskCommentCreate object
This constructor will assign default values to properties that have it defined,
and makes sure properties required by API are set, but the set of arguments
will change when the set of required properties is changed

### NewAppSchemasAskCommentCreateWithDefaults

`func NewAppSchemasAskCommentCreateWithDefaults() *AppSchemasAskCommentCreate`

NewAppSchemasAskCommentCreateWithDefaults instantiates a new AppSchemasAskCommentCreate object
This constructor will only assign default values to properties that have it defined,
but it doesn't guarantee that properties required by API are set

### GetTargetType

`func (o *AppSchemasAskCommentCreate) GetTargetType() string`

GetTargetType returns the TargetType field if non-nil, zero value otherwise.

### GetTargetTypeOk

`func (o *AppSchemasAskCommentCreate) GetTargetTypeOk() (*string, bool)`

GetTargetTypeOk returns a tuple with the TargetType field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetTargetType

`func (o *AppSchemasAskCommentCreate) SetTargetType(v string)`

SetTargetType sets TargetType field to given value.


### GetTargetId

`func (o *AppSchemasAskCommentCreate) GetTargetId() int32`

GetTargetId returns the TargetId field if non-nil, zero value otherwise.

### GetTargetIdOk

`func (o *AppSchemasAskCommentCreate) GetTargetIdOk() (*int32, bool)`

GetTargetIdOk returns a tuple with the TargetId field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetTargetId

`func (o *AppSchemasAskCommentCreate) SetTargetId(v int32)`

SetTargetId sets TargetId field to given value.


### GetContent

`func (o *AppSchemasAskCommentCreate) GetContent() string`

GetContent returns the Content field if non-nil, zero value otherwise.

### GetContentOk

`func (o *AppSchemasAskCommentCreate) GetContentOk() (*string, bool)`

GetContentOk returns a tuple with the Content field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetContent

`func (o *AppSchemasAskCommentCreate) SetContent(v string)`

SetContent sets Content field to given value.


### GetPid

`func (o *AppSchemasAskCommentCreate) GetPid() int32`

GetPid returns the Pid field if non-nil, zero value otherwise.

### GetPidOk

`func (o *AppSchemasAskCommentCreate) GetPidOk() (*int32, bool)`

GetPidOk returns a tuple with the Pid field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetPid

`func (o *AppSchemasAskCommentCreate) SetPid(v int32)`

SetPid sets Pid field to given value.

### HasPid

`func (o *AppSchemasAskCommentCreate) HasPid() bool`

HasPid returns a boolean if a field has been set.


[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


