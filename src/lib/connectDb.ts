import { ur } from "zod/locales";
import mobngoose from "mongoose"
const connectDb=async(url:string)=>{
    try {
        const data=await mobngoose.connect(url)
        console.log("Database connected")
        return data
    } catch (error) {
        console.error("Database connection error:", error)
        throw error
    }
}

export default connectDb;