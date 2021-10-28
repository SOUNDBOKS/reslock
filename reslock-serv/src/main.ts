import dotenv from "dotenv"
dotenv.config()

import express from "express"
import { useDatabase } from "./utils"
import morgan from "morgan"
import { unlockResourcesFromToken } from "./resources"

import { ApiRouter } from "./server"

async function initialize_service() {
    const db = await useDatabase()
    console.info("Connected to MongoDB")
}

const MAINTENANCE_INTERVAL = 1000 * 60

async function initialize_maintenance_routine() {
    async function cleanup_unlock_tokens() {
        const db = await useDatabase()
        const expiredTokens = (await db.collection("unlock_tokens").find({
            expire_date: { $lt: new Date() }
        }).toArray())
    
        if (expiredTokens.length === 0) return;
    
        console.info("[Maintenace] Unlocking '" + expiredTokens.length + "' expired tokens")
    
        expiredTokens.forEach(t => unlockResourcesFromToken(t._id))
    }

    async function cleanup_resource_hooks() {

    }

    async function maintenance() {
        cleanup_unlock_tokens()
    }

    setInterval(maintenance, MAINTENANCE_INTERVAL)
}



const serv = express()  
    .use(express.json())
    .use(morgan("tiny"))
    .use("/api", ApiRouter.router)

initialize_maintenance_routine()

initialize_service()
    .then(
        () => serv.listen(4000)
    )