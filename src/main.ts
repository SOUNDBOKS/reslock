import dotenv from "dotenv"
dotenv.config()

import express from "express"
import { useDatabase } from "./utils"
import morgan from "morgan"
import { IResource, requestResources, unlockResourcesFromToken } from "./resources"
import { ObjectId } from "mongodb"


async function initialize_service() {
    const db = await useDatabase()
    console.info("Connected to MongoDB")
}

const serv = express()  
    .use(express.json())
    .use(morgan("tiny"))
    .post("/api/resources/acquire", async (req, res) => {
        const { resources }: { resources: IResource[] } = req.body

        try {
            const lockedResources = await requestResources(resources)
            if (lockedResources.ok) {
                res.json(lockedResources.val)
            } else {
                res.json({ error: {
                    cause: "Failed to lock some resources",
                    missing_resources: lockedResources.val
                }})       
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
    .get("/api/resources/list", async (req, res) => {
        const db = await useDatabase()
        res.json({
            resources: await db.collection("resources").find().toArray()
        })
        res.end()
    })


initialize_service()
    .then(
        () => serv.listen(4000)
    )