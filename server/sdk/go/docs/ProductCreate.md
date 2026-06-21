# ProductCreate

## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**Id** | **string** |  | 
**Name** | **string** |  | 
**Price** | Pointer to **NullableInt32** |  | [optional] 
**TokenAmount** | Pointer to **NullableInt32** |  | [optional] 
**Type** | Pointer to **NullableString** |  | [optional] 
**Status** | Pointer to **NullableInt32** |  | [optional] 
**Sort** | Pointer to **NullableInt32** |  | [optional] 

## Methods

### NewProductCreate

`func NewProductCreate(id string, name string, ) *ProductCreate`

NewProductCreate instantiates a new ProductCreate object
This constructor will assign default values to properties that have it defined,
and makes sure properties required by API are set, but the set of arguments
will change when the set of required properties is changed

### NewProductCreateWithDefaults

`func NewProductCreateWithDefaults() *ProductCreate`

NewProductCreateWithDefaults instantiates a new ProductCreate object
This constructor will only assign default values to properties that have it defined,
but it doesn't guarantee that properties required by API are set

### GetId

`func (o *ProductCreate) GetId() string`

GetId returns the Id field if non-nil, zero value otherwise.

### GetIdOk

`func (o *ProductCreate) GetIdOk() (*string, bool)`

GetIdOk returns a tuple with the Id field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetId

`func (o *ProductCreate) SetId(v string)`

SetId sets Id field to given value.


### GetName

`func (o *ProductCreate) GetName() string`

GetName returns the Name field if non-nil, zero value otherwise.

### GetNameOk

`func (o *ProductCreate) GetNameOk() (*string, bool)`

GetNameOk returns a tuple with the Name field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetName

`func (o *ProductCreate) SetName(v string)`

SetName sets Name field to given value.


### GetPrice

`func (o *ProductCreate) GetPrice() int32`

GetPrice returns the Price field if non-nil, zero value otherwise.

### GetPriceOk

`func (o *ProductCreate) GetPriceOk() (*int32, bool)`

GetPriceOk returns a tuple with the Price field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetPrice

`func (o *ProductCreate) SetPrice(v int32)`

SetPrice sets Price field to given value.

### HasPrice

`func (o *ProductCreate) HasPrice() bool`

HasPrice returns a boolean if a field has been set.

### SetPriceNil

`func (o *ProductCreate) SetPriceNil(b bool)`

 SetPriceNil sets the value for Price to be an explicit nil

### UnsetPrice
`func (o *ProductCreate) UnsetPrice()`

UnsetPrice ensures that no value is present for Price, not even an explicit nil
### GetTokenAmount

`func (o *ProductCreate) GetTokenAmount() int32`

GetTokenAmount returns the TokenAmount field if non-nil, zero value otherwise.

### GetTokenAmountOk

`func (o *ProductCreate) GetTokenAmountOk() (*int32, bool)`

GetTokenAmountOk returns a tuple with the TokenAmount field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetTokenAmount

`func (o *ProductCreate) SetTokenAmount(v int32)`

SetTokenAmount sets TokenAmount field to given value.

### HasTokenAmount

`func (o *ProductCreate) HasTokenAmount() bool`

HasTokenAmount returns a boolean if a field has been set.

### SetTokenAmountNil

`func (o *ProductCreate) SetTokenAmountNil(b bool)`

 SetTokenAmountNil sets the value for TokenAmount to be an explicit nil

### UnsetTokenAmount
`func (o *ProductCreate) UnsetTokenAmount()`

UnsetTokenAmount ensures that no value is present for TokenAmount, not even an explicit nil
### GetType

`func (o *ProductCreate) GetType() string`

GetType returns the Type field if non-nil, zero value otherwise.

### GetTypeOk

`func (o *ProductCreate) GetTypeOk() (*string, bool)`

GetTypeOk returns a tuple with the Type field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetType

`func (o *ProductCreate) SetType(v string)`

SetType sets Type field to given value.

### HasType

`func (o *ProductCreate) HasType() bool`

HasType returns a boolean if a field has been set.

### SetTypeNil

`func (o *ProductCreate) SetTypeNil(b bool)`

 SetTypeNil sets the value for Type to be an explicit nil

### UnsetType
`func (o *ProductCreate) UnsetType()`

UnsetType ensures that no value is present for Type, not even an explicit nil
### GetStatus

`func (o *ProductCreate) GetStatus() int32`

GetStatus returns the Status field if non-nil, zero value otherwise.

### GetStatusOk

`func (o *ProductCreate) GetStatusOk() (*int32, bool)`

GetStatusOk returns a tuple with the Status field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetStatus

`func (o *ProductCreate) SetStatus(v int32)`

SetStatus sets Status field to given value.

### HasStatus

`func (o *ProductCreate) HasStatus() bool`

HasStatus returns a boolean if a field has been set.

### SetStatusNil

`func (o *ProductCreate) SetStatusNil(b bool)`

 SetStatusNil sets the value for Status to be an explicit nil

### UnsetStatus
`func (o *ProductCreate) UnsetStatus()`

UnsetStatus ensures that no value is present for Status, not even an explicit nil
### GetSort

`func (o *ProductCreate) GetSort() int32`

GetSort returns the Sort field if non-nil, zero value otherwise.

### GetSortOk

`func (o *ProductCreate) GetSortOk() (*int32, bool)`

GetSortOk returns a tuple with the Sort field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetSort

`func (o *ProductCreate) SetSort(v int32)`

SetSort sets Sort field to given value.

### HasSort

`func (o *ProductCreate) HasSort() bool`

HasSort returns a boolean if a field has been set.

### SetSortNil

`func (o *ProductCreate) SetSortNil(b bool)`

 SetSortNil sets the value for Sort to be an explicit nil

### UnsetSort
`func (o *ProductCreate) UnsetSort()`

UnsetSort ensures that no value is present for Sort, not even an explicit nil

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


