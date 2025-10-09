import type { Response } from "express";
import type { AdminAuthRequest } from "../../middlewares/adminAuthMiddleware";
import { AdminModel } from "../../models/admin.model";



export const addAdminUser = async (req: AdminAuthRequest, res: Response) => {
    try {
        const { email, firstName, lastName, role, password } = req.body;
        const newAdminUser = await AdminModel.create({ email, firstName, lastName, role, password });
        return res.status(201).json({ message: "User added successfully", user: newAdminUser });
    } catch (error) {
        return res.status(500).json({ message: "An error occurred While creating Admin User", error });   
    }
}

export const getAdminUsers = async (req: AdminAuthRequest, res: Response) => {
    try {
        const admins = await AdminModel.find({}).select("-password -__v").lean();
        return res.status(200).json({ admins });
    } catch (error) {
        return res.status(500).json({ message: "An error occurred", error });
    }
}

export const editAdminUser = async (req: AdminAuthRequest, res: Response) => {
    try {
        const { adminId, email, firstName, lastName, role } = req.body;
        const updatedData: any = { email, firstName, lastName, role };
      
        const updatedAdmin = await AdminModel.findByIdAndUpdate(adminId, updatedData, { new: true });
        return res.status(200).json({ message: "Admin User updated successfully", user: updatedAdmin });
    } catch (error) {
        return res.status(500).json({ message: "An error occurred while editing admin ", error });
    }
}

export const deleteAdminUser = async (req: AdminAuthRequest, res: Response) => {
    try {
        const { adminId } = req.body;
        await AdminModel.findByIdAndDelete(adminId);
        return res.status(200).json({ message: "Admin User deleted successfully" });
    } catch (error) {
        return res.status(500).json({ message: "An error occurred", error });
    }
}