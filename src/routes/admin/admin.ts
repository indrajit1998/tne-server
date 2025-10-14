import { application, Router } from "express";
import { adminLogin } from "../../controllers/admin/adminauth";
import { isAdminAuthMiddleware } from "../../middlewares/adminAuthMiddleware";
import { consignmentStats, getEarningsStats, requestStats, travelStats ,getDashboardStats, getTransactionHistory} from "../../controllers/admin/adminDashboard";
import { getUsersList, getUserDetails, deleteUser } from "../../controllers/admin/userManagement";
import { getPrices, managePrices } from "../../controllers/admin/priceManagement";
import { addAdminUser, deleteAdminUser, editAdminUser, getAdminUsers,getAdminUserById } from "../../controllers/admin/management";
import { getSenderReport, getTravellerReport } from "../../controllers/admin/report";
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
adminRouts.get("/getAdminUserById/:id", getAdminUserById)
adminRouts.delete("/deleteAdminUser/:id", deleteAdminUser)
adminRouts.patch("/editAdminUser/:id", editAdminUser)
adminRouts.post("/addAdminUser", addAdminUser)

//Reports
adminRouts.get("/getTravellerReport", getTravellerReport)
adminRouts.get("/getSenderReport", getSenderReport)

//Dashboard Stats
adminRouts.get("/getDashboardStats", getDashboardStats)

//Feedback and Contacts
adminRouts.get("/getFeedback", getFeedback)
adminRouts.get("/getSupportContacts", getSupportContacts)
export default adminRouts;