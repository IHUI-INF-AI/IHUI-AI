
# ProductCreate


## Properties

Name | Type
------------ | -------------
`id` | string
`name` | string
`price` | number
`tokenAmount` | number
`type` | string
`status` | number
`sort` | number

## Example

```typescript
import type { ProductCreate } from ''

// TODO: Update the object below with actual values
const example = {
  "id": null,
  "name": null,
  "price": null,
  "tokenAmount": null,
  "type": null,
  "status": null,
  "sort": null,
} satisfies ProductCreate

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as ProductCreate
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


