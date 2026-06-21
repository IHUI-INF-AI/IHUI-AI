# UpdateVarReq

## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**ConnectorId** | **string** |  | 
**VariableId** | **string** |  | 
**Value** | **string** |  | 

## Methods

### NewUpdateVarReq

`func NewUpdateVarReq(connectorId string, variableId string, value string, ) *UpdateVarReq`

NewUpdateVarReq instantiates a new UpdateVarReq object
This constructor will assign default values to properties that have it defined,
and makes sure properties required by API are set, but the set of arguments
will change when the set of required properties is changed

### NewUpdateVarReqWithDefaults

`func NewUpdateVarReqWithDefaults() *UpdateVarReq`

NewUpdateVarReqWithDefaults instantiates a new UpdateVarReq object
This constructor will only assign default values to properties that have it defined,
but it doesn't guarantee that properties required by API are set

### GetConnectorId

`func (o *UpdateVarReq) GetConnectorId() string`

GetConnectorId returns the ConnectorId field if non-nil, zero value otherwise.

### GetConnectorIdOk

`func (o *UpdateVarReq) GetConnectorIdOk() (*string, bool)`

GetConnectorIdOk returns a tuple with the ConnectorId field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetConnectorId

`func (o *UpdateVarReq) SetConnectorId(v string)`

SetConnectorId sets ConnectorId field to given value.


### GetVariableId

`func (o *UpdateVarReq) GetVariableId() string`

GetVariableId returns the VariableId field if non-nil, zero value otherwise.

### GetVariableIdOk

`func (o *UpdateVarReq) GetVariableIdOk() (*string, bool)`

GetVariableIdOk returns a tuple with the VariableId field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetVariableId

`func (o *UpdateVarReq) SetVariableId(v string)`

SetVariableId sets VariableId field to given value.


### GetValue

`func (o *UpdateVarReq) GetValue() string`

GetValue returns the Value field if non-nil, zero value otherwise.

### GetValueOk

`func (o *UpdateVarReq) GetValueOk() (*string, bool)`

GetValueOk returns a tuple with the Value field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetValue

`func (o *UpdateVarReq) SetValue(v string)`

SetValue sets Value field to given value.



[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


