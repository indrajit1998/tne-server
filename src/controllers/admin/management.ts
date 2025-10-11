import type { Response } from "express";
import type { AdminAuthRequest } from "../../middlewares/adminAuthMiddleware";
import { AdminModel } from "../../models/admin.model";



export const addAdminUser = async (req: AdminAuthRequest, res: Response) => {
    try {
        const { name, email, password, phoneNumber, role } = req.body;
        if (!name || !email || !password || !role) {
            return res.status(400).json({ message: "Missing required fields." });
        }
        const existingAdmin = await AdminModel.findOne({ email });
        if (existingAdmin) {
            return res.status(409).json({ message: "Admin with this email already exists" });
        }
        const newAdmin = new AdminModel({ name, email, password, phoneNumber, role });
        await newAdmin.save(); 
        res.status(201).json({ message: "Admin created successfully" });
    } catch (error) {
        console.error("Error details in createAdmin:", error);
        res.status(500).json({ message: "Error creating admin" });
    }
};

export const getAdminUsers = async (req: AdminAuthRequest, res: Response) => {
    try {
        const searchQuery = (req.query.search as string) || "";
        const query = searchQuery
            ? {
                  $or: [
                      { name: { $regex: searchQuery, $options: "i" } },
                      { email: { $regex: searchQuery, $options: "i" } },
                      { role: { $regex: searchQuery, $options: "i" } },
                      { phoneNumber: { $regex: searchQuery, $options: "i" } },
                  ],
              }
            : {};
        const admins = await AdminModel.find(query).select("-password");
        res.status(200).json({ admins });
    } catch (error) {
        console.error("Error fetching admins:", error);
        res.status(500).json({ message: "Error fetching admins" });
    }
};

export const getAdminUserById = async (req: AdminAuthRequest, res: Response) => {
    try {
        const { id } = req.params;
        const admin = await AdminModel.findById(id).select("-password");
        if (!admin) {
            return res.status(404).json({ message: "Admin not found" });
        }
        res.status(200).json({ admin });
    } catch (error) {
        console.error("Error fetching admin by ID:", error);
        res.status(500).json({ message: "Error fetching admin details" });
    }
};

export const editAdminUser = async (req: AdminAuthRequest, res: Response) => {
    try {
        const { id } = req.params;
        
        const { name, email, phoneNumber, role } = req.body;

        const updatedAdmin = await AdminModel.findByIdAndUpdate(
            id,
            { name, email, phoneNumber, role },
            { new: true }
        ).select("-password");

        if (!updatedAdmin) {
            return res.status(404).json({ message: "Admin not found" });
        }
        res.status(200).json({ message: "Admin User updated successfully", user: updatedAdmin });
    } catch (error) {
        console.error("Error updating admin:", error);
        res.status(500).json({ message: "Error updating admin" });
    }
};

export const deleteAdminUser = async (req: AdminAuthRequest, res: Response) => {
    try {
        const { id } = req.params;
        const deletedAdmin = await AdminModel.findByIdAndDelete(id);
        if (!deletedAdmin) {
            return res.status(404).json({ message: "Admin not found" });
        }
        res.status(200).json({ message: "Admin User deleted successfully" });
    } catch (error) {
        console.error("Error deleting admin:", error);
        res.status(500).json({ message: "Error deleting admin" });
    }
};