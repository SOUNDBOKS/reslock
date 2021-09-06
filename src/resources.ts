
import { Mutex } from "async-mutex"
import { Db, ObjectId } from "mongodb"

import { Result, Ok, Err } from "ts-results"
import { useDatabase } from "./utils"

enum LockState {
    Free = 0,
    Reserved = 1,
    Locked = 2,
}

const serviceLock = new Mutex()

export interface IResource {
    resource_set: string,
    filters: object,
}

export interface LockedResource {
    _id: ObjectId,
    properties: object,
}

export interface UnlockToken {
    _id: ObjectId,
    resources: LockedResource[],
    locked_at: Date,
}

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

export async function requestResources(requested: IResource[]): Promise<Result<UnlockToken, IResource[]>> {
    const release = await serviceLock.acquire()
    let selected: LockedResource[] = []
    let missing: IResource[] = []
    const db = await useDatabase()

    try {
        for(let i = 0; i < requested.length; i++) {
            let find = requested[i]
            let query: any = { 
                resource_set: find.resource_set,
                lock_state: LockState.Free,
            }
            if (find.filters && Object.keys(find.filters).length > 0) {
                query.$and = Object.keys(find.filters).map(k => ({ ["properties." + k]: (find.filters as any)[k]}))
        
            }
            let available = await db.collection("resources").findOneAndUpdate(query, { $set: { lock_state: LockState.Reserved }})

            if (!available.value) missing.push(find)
            else selected.push(available.value as LockedResource)
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
    const { resources }: { resources: LockedResource[] } = (await db.collection("unlock_tokens").findOneAndDelete({ _id: tokenId })).value as any

    await db.collection("resources").updateMany({
        _id: { $in: resources.map(r => r._id) }
    }, {
        $set: { lock_state: LockState.Free }
    })
}
