import dotenv from "dotenv"
dotenv.config()

import express from "express"
import { useDatabase } from "./utils"
import morgan from "morgan"
import { requestResources, unlockResourcesFromSet, unlockResourcesFromToken } from "./resources"
import { ObjectId } from "mongodb"
import { IResource, LockedResource, LockState, ResourceAcquisitionOptions } from "@soundboks/reslock-common"

import { version } from "../package.json"
import assert from "assert"

async function initialize_service() {
    const db = await useDatabase()
    console.info("Connected to MongoDB")
}

const MAINTENANCE_INTERVAL = 1000 * 60

async function initialize_maintenance_routine() {
    async function maintenance() {
        const db = await useDatabase()
        const expiredTokens = (await db.collection("unlock_tokens").find({
            expire_date: { $lt: new Date() }
        }).toArray())

        if (expiredTokens.length === 0) return;

        console.info("[Maintenace] Unlocking '" + expiredTokens.length + "' expired tokens")

        expiredTokens.forEach(t => unlockResourcesFromToken(t._id))
    }

    setInterval(maintenance, MAINTENANCE_INTERVAL)
}



const serv = express()  
    .use(express.json())
    .use(morgan("tiny"))
    .get("/version", async (req, res) => {
        res.json({ version, serviceName: "reslock" })
    })
    .post("/api/resources/acquire", async (req, res) => {
        const { resources, options }: { resources: IResource[], options?: ResourceAcquisitionOptions } = req.body

        if (options?.expire_date && options.expire_minutes) {
            res.json({ error: "INVALID_OPTIONS", cause: "Don't set expire_date and expire_minutes" })
            return;
        }

        try {
            const lockedResources = await requestResources(resources, options || {})
            if (lockedResources.ok) {
                res.json(lockedResources.val)
            } else {
                res.json({
                    error: "MISSING_RESOURCES",
                    missing_resources: lockedResources.val
                })       
            }
        } catch (e) {
            res.json({ error: JSON.stringify(e) })
        }
        res.end()
    })
    .post("/api/resources/unlock", async (req, res) => {
        const { token }: { token: string } = req.body

        try {
            await unlockResourcesFromToken(new ObjectId(token))
            res.json({ ok: true })
        } catch (e) {
            res.json({ error: JSON.stringify(e) })
        }
        res.end()
    })
    .post("/api/resources/unlock_set", async (req, res) => {
        const { unlock_set }: { unlock_set: string } = req.body

        try {
            const count = await unlockResourcesFromSet(unlock_set)
            res.json({ ok: true, count })
        } catch (e) {
            res.json({ error: JSON.stringify(e) })
        }
        res.end()
    })
    .post("/api/resource/create", async (req, res) => {
        console.log(req.body)
        const { resource_set, properties } = req.body

        assert(resource_set, "Resource set must be not null")
        assert(properties, "Properties must be an object")
        

        const db = await useDatabase()
        const inserted = await db.collection("resources").insertOne({
            resource_set,
            properties,
            lock_state: LockState.Free
        })

        res.json({ _id: inserted.insertedId })
        res.end()
    })
    .post("/api/resource/:id/destroy", async (req, res) => {
        const db = await useDatabase()
        const resource = await db.collection("resources").findOne({
            _id: new ObjectId(req.params.id)
        })

        if (!resource) {
            res.json({ error: "RESOURCE_DOES_NOT_EXIST" })
            return;
        }
        if (resource.lock_state !== LockState.Free) {
            res.json({ error: "RESOURCE_LOCKED" })
            return;
        }

        await db.collection("resources").deleteOne({
            _id: new ObjectId(req.params.id)
        })

        res.json({ ok: true })
        res.end()
    })
    .get("/api/resources/list", async (req, res) => {
        const db = await useDatabase()
        res.json({
            resources: await db.collection("resources").find().toArray()
        })
        res.end()
    })
    .get("/api/resources/:set/list", async (req, res) => {
        const db = await useDatabase()
        res.json({
            resources: await db.collection("resources").find({
                resource_set: req.params.set
            }).toArray()
        })
        res.end()
    })


initialize_maintenance_routine()

initialize_service()
    .then(
        () => serv.listen(4000)
    )