import mobngoose from "mongoose";
import dns from "node:dns";

dns.setServers(["1.1.1.1", "8.8.8.8"]);

const connectDb = async (url: string) => {
    try {
        const data = await mobngoose.connect(url)
        console.log("Database connected")
        return data
    } catch (error) {
        console.error("Database connection error:", error)
        throw error
    }
}

export default connectDb;