# reslock-client
A nodejs client library for interfacing with a relock server


### How to use
`yarn add @soundboks/reslock-client`

```ts
let client: ReslockClient = await ReslockClient.connect("http://<domain>:4000")

const { resources, _id } = (await client.acquire([
    { resource_set: "A" },
    { resource_set: "B", properties: { foo: "bar" }}
])).unwrap() // assume we got our stuff and throw if we didn't

await client.unlock(_id)
```

Check the test directory for more examples or just look at the type declarations for ReslockClient.