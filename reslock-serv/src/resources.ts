
import { Mutex } from "async-mutex"
import { Db, ObjectId } from "mongodb"

import { Result, Ok, Err } from "ts-results"
import { useDatabase } from "./utils"
import { IResource, LockedResource, UnlockToken, LockState, ResourceAcquisitionOptions } from "@soundboks/reslock-common"




const serviceLock = new Mutex()


export async function unlockAll() {
    const release = await serviceLock.acquire()
    const db = await useDatabase()
    try {
        await db.collection("resources").updateMany({ lock_state: { $ne: LockState.Free }}, {
            $set: { lock_state: LockState.Free }
        })
    } finally {
        release()
    }
}

export async function requestResources(requested: IResource[], options: ResourceAcquisitionOptions): Promise<Result<UnlockToken<ObjectId>, IResource[]>> {
    const release = await serviceLock.acquire()
    let selected: LockedResource<ObjectId>[] = []
    let missing: IResource[] = []
    const db = await useDatabase()

    // yes
    const expire_date = options.expire_date ?
        new Date(options.expire_date) : 
        (options.expire_minutes ? 
            new Date((new Date()).getTime() + 1000 * 60 * options.expire_minutes) : 
            undefined)

    try {
        for(let i = 0; i < requested.length; i++) {
            let find = requested[i]
            let query: any = { 
                resource_set: find.resource_set,
                lock_state: LockState.Free,
            }
            if (find.properties && Object.keys(find.properties).length > 0) {
                query.$and = Object.keys(find.properties).map(k => ({ ["properties." + k]: (find.properties as any)[k]}))
        
            }
            let available = await db.collection("resources").findOneAndUpdate(query, { $set: { lock_state: LockState.Reserved }})

            if (!available.value) missing.push(find)
            else selected.push(available.value as LockedResource<ObjectId>)
        }

        if (missing.length > 0) return Err(missing)

        await db.collection("resources").updateMany({
            lock_state: LockState.Reserved,
        }, { $set: {
            lock_state: LockState.Locked,
        }})

        const lockDate = new Date()
        const unlockToken = await db.collection("unlock_tokens").insertOne({
            resources: selected,
            locked_at: lockDate,
            expire_date,
            unlock_set: options.unlock_set,
        })

        return Ok({
            resources: selected,
            locked_at: lockDate,
            _id: unlockToken.insertedId,
        })
    } finally {
        // unlock resources we didn't end up using
        await db.collection("resources").updateMany({
            lock_state: LockState.Reserved,
        }, { $set: { lock_state: LockState.Free }})
        release()
    }
}

export async function unlockResourcesFromToken(tokenId: ObjectId) {
    const db = await useDatabase()
    const { resources }: { resources: LockedResource<ObjectId>[] } = (await db.collection("unlock_tokens").findOneAndDelete({ _id: tokenId })).value as any

    await db.collection("resources").updateMany({
        _id: { $in: resources.map(r => r._id) }
    }, {
        $set: { lock_state: LockState.Free }
    })
}

export async function unlockResourcesFromSet(setId: string) {
    const db = await useDatabase()
    const tokens = await db.collection("unlock_tokens").find({ unlock_set: setId }).toArray()

    await Promise.all(tokens.map(t => unlockResourcesFromToken(t._id)))

    return tokens.length;
}