import { application, Router } from "express";
import { adminLogin } from "../../controllers/admin/adminauth";
import { isAdminAuthMiddleware } from "../../middlewares/adminAuthMiddleware";
import { consignmentStats, getEarningsStats, requestStats, travelStats ,getDashboardStats, getTransactionHistory} from "../../controllers/admin/adminDashboard";
import { getUsersList, getUserDetails, deleteUser } from "../../controllers/admin/userManagement";
import { getPrices, managePrices } from "../../controllers/admin/priceManagement";
import { addAdminUser, deleteAdminUser, editAdminUser, getAdminUsers,getAdminUserById } from "../../controllers/admin/management";
import { getConsolidateConsignment, getSenderReport, getSenderReport, getTravellerReport } from "../../controllers/admin/report";
import {getFeedback, getSupportContacts} from "../../controllers/admin/feedbackAndContacts";

const adminRouts = Router();
adminRouts.post("/adminLogin", adminLogin)

adminRouts.use(isAdminAuthMiddleware);
adminRouts.get("/getTransactionHistory",getTransactionHistory)
adminRouts.get("/getConsignmentsStats", consignmentStats)
adminRouts.get("/getEarningsStats", getEarningsStats)
adminRouts.get("/getTravelStats", travelStats)
adminRouts.get("/getRequestStats", requestStats)
adminRouts.delete("/deleteUser", deleteUser)

//User Management
adminRouts.get("/manageUsers", getUsersList);
adminRouts.get("/userDetails/:userId", getUserDetails);
adminRouts.delete("/deleteUser/:userId", deleteUser);

//Price Management
adminRouts.get("/getPriceConfig", getPrices)
adminRouts.patch("/managePrices", managePrices)

//Admin Management
adminRouts.get("/getAdminUsers", getAdminUsers)
adminRouts.delete("/deleteAdminUser", deleteAdminUser)
adminRouts.patch("/editAdminUser", editAdminUser)
adminRouts.post("/addAdminUser", addAdminUser) 
adminRouts.get("/getTravellerReport",getTravellerReport)

export default adminRouts;