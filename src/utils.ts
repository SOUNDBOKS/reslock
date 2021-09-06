import { MongoClient, Db } from "mongodb";
import { env } from "process";


let __mongo_handle: MongoClient;
let __database_handle: Db;
export const useDatabase = async () => {
    return __database_handle || await (async () => {
        __mongo_handle = new MongoClient("mongodb://" + env["MONGO_SERVER_URL"])
        await __mongo_handle.connect()
        __database_handle = __mongo_handle.db(env["MONGO_DB_NAME"])
        console.assert(__database_handle, `Database ${env["MONGO_DB_NAME"]} does not seem to exist!`)
        return __database_handle
    })()
}