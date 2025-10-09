import { Router } from "express";
import { adminLogin } from "../../controllers/admin/adminauth";
import { consignmentStats, getEarningsStats, getTransactionHistory, getUsersStats, requestStats, travelStats } from "../../controllers/admin/adminDashboard";
import { addAdminUser, deleteAdminUser, editAdminUser, getAdminUsers } from "../../controllers/admin/management";
import { getPrices, managePrices } from "../../controllers/admin/priceManagement";
import { deleteUser, manageUsers } from "../../controllers/admin/userManagement";

const adminRouts = Router();
adminRouts.post("adminLogin", adminLogin)

// adminRouts.use(isAdminAuthMiddleware);
adminRouts.get("/getUserStats",getUsersStats)
adminRouts.get("/getConsignmentsStats", consignmentStats)
adminRouts.get("/getEarningsStats", getEarningsStats)
adminRouts.get("/getTravelStats", travelStats)
adminRouts.get("/getRequestStats", requestStats)
adminRouts.get("/getTransactionStats",getTransactionHistory)
adminRouts.delete("/deleteUser", deleteUser)
adminRouts.get("/manageUsers", manageUsers)
adminRouts.get("/getPriceConfig", getPrices)
adminRouts.patch("/managePrices", managePrices)
adminRouts.get("/getAdminUsers", getAdminUsers)
adminRouts.delete("/deleteAdminUser", deleteAdminUser)
adminRouts.patch("/editAdminUser", editAdminUser)
adminRouts.post("/addAdminUser",addAdminUser) 

export default adminRouts;