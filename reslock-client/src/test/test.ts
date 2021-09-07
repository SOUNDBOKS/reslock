

import ReslockClient from "../index"
import assert from "assert"
import { UnlockToken } from "@soundboks/reslock-common"


describe("Reslock Client", async () => {
    let client: ReslockClient;

    it("should connect to the local reslock server", async () => {
        client = await ReslockClient.connect("http://localhost:4000")
    })

    it("should return an empty list of resources", async () => {
        const resources = await client.list_resources()
        assert.equal(resources.length, 0)
    })

    
    describe("Create, lock, unlock and delete a resource", async () => {
        let resourceId: string;
        let unlockToken: UnlockToken<string>;

        it("should create a resource", async () => {
            resourceId = await client.create_resource("test", { })
        })

        it("should show 1 resource in total", async () => assert.equal((await client.list_resources()).length, 1))
        it("should show 1 resource in the test set", async () => assert.equal((await client.list_resources("test")).length, 1))
        
        it("should acquire a lock on that resource", async () => {
            unlockToken = (await client.acquire([
                { resource_set: "test" }
            ])).unwrap()
        })

        it("should fail to grab another lock", async () => {
            assert.equal((await client.acquire([
                { resource_set: "test" }
            ])).ok, false)
        })

        it("should fail when trying to delete the resource while locked", async () => {
            await assert.rejects(async () => {
                await client.destroy_resource(resourceId)
            })
        })

        it("should unlock the resource", async () => {
            await client.unlock(unlockToken)
        })

        it("should delete the resource", async () => {
            await client.destroy_resource(resourceId)

            assert.equal((await client.list_resources()).length, 0)
            assert.equal((await client.list_resources("test")).length, 0)
        })
    })
})
