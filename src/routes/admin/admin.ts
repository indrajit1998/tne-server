import { application, Router } from "express";
import { adminLogin } from "../../controllers/admin/adminauth";
import { isAdminAuthMiddleware } from "../../middlewares/adminAuthMiddleware";
import { consignmentStats, getEarningsStats, getUsersStats, requestStats, travelStats } from "../../controllers/admin/adminDashboard";
import { deleteUser, manageUsers } from "../../controllers/admin/userManagement";
import { getPrices, managePrices } from "../../controllers/admin/priceManagement";

const adminRouts = Router();
adminRouts.post("adminLogin", adminLogin)

adminRouts.use(isAdminAuthMiddleware);
adminRouts.get("/getUserStats",getUsersStats)
adminRouts.get("/getConsignmentsStats", consignmentStats)
adminRouts.get("/getEarningsStats", getEarningsStats)
adminRouts.get("/getTravelStats", travelStats)
adminRouts.get("/getRequestStats", requestStats)
adminRouts.delete("/deleteUser", deleteUser)
adminRouts.get("/manageUsers", manageUsers)
adminRouts.get("/getPriceConfig", getPrices)
adminRouts.patch("/managePrices", managePrices)
export default adminRouts;