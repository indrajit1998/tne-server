import type { Request, Response } from "express";
import { CODES } from "../../constants/statusCodes";
import { emailSchema, phoneSchema } from "../../middlewares/validator";
import sendResponse from "../../lib/ApiResponse";
import { Verification } from "../../models/verfiication.model";
import { User } from "../../models/user.model";
import axios from "axios";
import FormData from "form-data";
import env from "../../lib/env";
import jwt from "jsonwebtoken";
import { cookiesOption } from "../../constants/constant";



const generateRandomOtp = () =>
  Math.floor(100000 + Math.random() * 900000).toString(); // 6 digit

export const generateOtp = async (req: Request, res: Response) => {
  try {
    
    const { phoneNumber } = req.body;
    console.log("🔹 Received phone number:", phoneNumber);

    // ✅ Validate phone number
    const result = phoneSchema.safeParse(phoneNumber);
    if (!result.success) {
      return res.status(CODES.BAD_REQUEST).json(
        sendResponse(
          CODES.BAD_REQUEST,
          null,
          result.error.issues[0]?.message || "Invalid phone number"
        )
      );
    }

    const validPhone = result.data;
    const otp = generateRandomOtp();

    console.log(`🔹 Generated OTP for ${validPhone}: ${otp}`);

    // ✅ Ensure user exists
    let user = await User.findOne({ phoneNumber: validPhone });
    if (!user) {
      user = await User.create({ phoneNumber: validPhone });
    }

    // ✅ Save/Update OTP in Verification collection
    let verification = await Verification.findOne({ phoneNumber: validPhone });
    if (verification) {
      verification.code = parseInt(otp, 10);
      verification.expiresAt = new Date(Date.now() + 5 * 60 * 1000);
      await verification.save();
    } else {
      verification = await Verification.create({
        phoneNumber: validPhone,
        code: parseInt(otp, 10),
        expiresAt: new Date(Date.now() + 5 * 60 * 1000),
      });
    }

    // ✅ Send SMS using Pingbix
    const message = `${otp} is OTP to login. Do not share with anyone.`;

    const formData = new FormData();
    formData.append("userid", "timestrings"); // replace with env var
    formData.append("password", "X82w2G4f"); // replace with env var
    formData.append("mobile", validPhone);
    formData.append("senderid", "TMSSYS");
    formData.append("dltEntityId", "1701173330327453584");
    formData.append("msg", message);
    formData.append("sendMethod", "quick");
    formData.append("msgType", "text");
    formData.append("dltTemplateId", "1707173406941797486");
    formData.append("output", "json");
    formData.append("duplicatecheck", "true");
    formData.append("dlr", "1");

    const smsResponse = await axios.post(
      env.SEND_MESSAGE_API_KEY ,
      formData,
      {
        headers: {
          ...formData.getHeaders(),
          Cookie: "SERVERID=webC1",
        },
        maxBodyLength: Infinity,
      }
    );
    const token=jwt.sign({_id:user._id,phoneNumber:validPhone},env.JWT_SECRET,{expiresIn:"7d"});
    res.cookie("token",token,cookiesOption);

    console.log("✅ SMS API Response:", smsResponse.data);

    // ✅ Return API response
    if (smsResponse.data?.status === "success") {
      return res.status(CODES.OK).json(
        sendResponse(
          CODES.OK,
          { phoneNumber: validPhone },
          "OTP sent successfully"
        )
      );
    } else {
      return res.status(CODES.INTERNAL_SERVER_ERROR).json(
        sendResponse(
          CODES.INTERNAL_SERVER_ERROR,
          null,
          "Failed to send OTP"
        )
      );
    }
  } catch (error: any) {
    console.error("❌ Error generating OTP:", error.response?.data || error.message);
    return res
      .status(CODES.INTERNAL_SERVER_ERROR)
      .json(sendResponse(CODES.INTERNAL_SERVER_ERROR, null, "Something went wrong"));
  }
};



export const verifyOtp = async (req: Request, res: Response) => {
  try {
    const { phoneNumber, otp } = req.body;
    const result = phoneSchema.safeParse(phoneNumber);
    if (!result.success) {
      return res.status(CODES.BAD_REQUEST).json(
        sendResponse(
          CODES.BAD_REQUEST,
          null,
          result.error.issues[0]?.message || "Invalid phone number"
        )
      );
    }

    const validPhone = result.data;
    const verification = await Verification.findOne({ phoneNumber: validPhone });
    if (!verification) {
      return res
        .status(CODES.NOT_FOUND)
        .json(sendResponse(CODES.NOT_FOUND, null, "No OTP generated for this phone number"));
    }
    if (verification.expiresAt < new Date()) {
      await Verification.deleteOne({ phoneNumber: validPhone }); // cleanup expired OTP
      return res
        .status(CODES.GONE)
        .json(sendResponse(CODES.GONE, null, "OTP has expired"));
    }
    if (verification.code !== Number(otp)) {
      return res
        .status(CODES.UNAUTHORIZED)
        .json(sendResponse(CODES.UNAUTHORIZED, null, "Invalid OTP"));
    }
    const user=await User.findOne({phoneNumber:validPhone})
    if(!user){
      return res.status(CODES.NOT_FOUND).json(sendResponse(CODES.NOT_FOUND,null,"User not found"))
    }
    user.isVerified = true;
    await user.save();
    
    await Verification.deleteOne({ phoneNumber: validPhone });

    return res
      .status(CODES.OK)
      .json(sendResponse(CODES.OK, null, "Phone number verified successfully"));
  } catch (error) {
    console.error("Error verifying OTP:", error);
    return res
      .status(CODES.INTERNAL_SERVER_ERROR)
      .json(sendResponse(CODES.INTERNAL_SERVER_ERROR, null, "Something went wrong"));
  }
};


export const registerUser = async (req: Request, res: Response) => {
  try {
    const { phoneNumber, firstName, lastName, profilePictureUrl, email } = req.body;

    // ✅ Required fields check
    if (!phoneNumber || !firstName || !lastName) {
      return res
        .status(CODES.BAD_REQUEST)
        .json(
          sendResponse(
            CODES.BAD_REQUEST,
            null,
            "phoneNumber, firstName and lastName are required"
          )
        );
    }

    // ✅ Validate email
    const resultEmail = emailSchema.safeParse(email);
    if (!resultEmail.success) {
      return res
        .status(CODES.BAD_REQUEST)
        .json(
          sendResponse(
            CODES.BAD_REQUEST,
            null,
            resultEmail.error.issues[0]?.message || "Invalid email address"
          )
        );
    }

    // ✅ Validate phone
    const resultPhone = phoneSchema.safeParse(phoneNumber);
    if (!resultPhone.success) {
      return res
        .status(CODES.BAD_REQUEST)
        .json(
          sendResponse(
            CODES.BAD_REQUEST,
            null,
            resultPhone.error.issues[0]?.message || "Invalid phone number"
          )
        );
    }

    const validPhone = resultPhone.data;

    // ✅ Check if user exists
    const user = await User.findOne({ phoneNumber: validPhone });
    if (!user) {
      return res
        .status(CODES.NOT_FOUND)
        .json(sendResponse(CODES.NOT_FOUND, null, "User not found"));
    }

    // ✅ Check if verified
    if (!user.isVerified) {
      return res
        .status(CODES.FORBIDDEN)
        .json(sendResponse(CODES.FORBIDDEN, null, "Phone number not verified"));
    }

    // ✅ Prevent duplicate onboarding
    if (user.onboardingCompleted) {
      return res
        .status(CODES.BAD_REQUEST)
        .json(sendResponse(CODES.BAD_REQUEST, null, "Onboarding already completed"));
    }

    // ✅ Update user profile
    const onboardedUser = await User.findOneAndUpdate(
      { phoneNumber: validPhone },
      { firstName, lastName, profilePictureUrl, email, onboardingCompleted: true },
      { new: true } // <-- return updated user
    );
    const token=jwt.sign({_id:user._id,phoneNumber:validPhone},env.JWT_SECRET,{expiresIn:"7d"});
    res.cookie("token",token,cookiesOption);

    return res
      .status(CODES.OK)
      .json(sendResponse(CODES.OK, onboardedUser, "User onboarded successfully"));
  } catch (error) {
    console.error("Error registering user:", error);
    return res
      .status(CODES.INTERNAL_SERVER_ERROR)
      .json(
        sendResponse(
          CODES.INTERNAL_SERVER_ERROR,
          null,
          "Something went wrong"
        )
      );
  }
};
