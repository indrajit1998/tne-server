import axios from "axios";
import type { Request, Response } from "express";
import FormData from "form-data";
import jwt from "jsonwebtoken";
import { emailSchema, phoneSchema } from "../../../validator.js";
import { cookiesOption } from "../../constants/constant";
import { CODES } from "../../constants/statusCodes";
import sendResponse from "../../lib/ApiResponse";
import env from "../../lib/env";
import type { AuthRequest } from "../../middlewares/authMiddleware.js";
import { User, type User as UserT } from "../../models/user.model";
import { Verification } from "../../models/verfiication.model";

const generateRandomOtp = () =>
  Math.floor(100000 + Math.random() * 900000).toString(); // 6 digit

export const generateOtp = async (req: Request, res: Response) => {
  try {
    const { phoneNumber } = req.body;

    const result = phoneSchema.safeParse(phoneNumber);

    if (!result.success) {
      return res
        .status(CODES.BAD_REQUEST)
        .json(
          sendResponse(
            CODES.BAD_REQUEST,
            null,
            result.error.issues[0]?.message || "Invalid phone number"
          )
        );
    }

    const validPhone = result.data;

    // Generate OTP
    const otp = generateRandomOtp();

    // ✅ Ensure user exists
    let user = await User.findOne({ phoneNumber: validPhone });
    if (!user) {
      try {
        user = await User.create({ phoneNumber: validPhone });
      } catch (error) {
        console.error("❌ Error creating user:", error);
        return res
          .status(CODES.INTERNAL_SERVER_ERROR)
          .json(
            sendResponse(
              CODES.INTERNAL_SERVER_ERROR,
              null,
              "Something went wrong while creating user"
            )
          );
      }
    }

    // ✅ Save/Update OTP in Verification collection
    let verification = await Verification.findOne({ phoneNumber: validPhone });

    if (verification) {
      verification.code = parseInt(otp, 10);
      verification.expiresAt = new Date(Date.now() + 5 * 60 * 1000);
      await verification.save();
    } else {
      try {
        verification = await Verification.create({
          phoneNumber: validPhone,
          code: parseInt(otp, 10),
          expiresAt: new Date(Date.now() + 5 * 60 * 1000),
        });
      } catch (error) {
        console.error("❌ Error creating verification:", error);
        return res
          .status(CODES.INTERNAL_SERVER_ERROR)
          .json(
            sendResponse(
              CODES.INTERNAL_SERVER_ERROR,
              null,
              "Something went wrong while creating verification"
            )
          );
      }
    }

    // ✅ Send SMS using Pingbix
    const message = `${otp} is OTP to Login to Timestrings System App. Do not share with anyone.`;

    const formData = new FormData();
    formData.append("userid", "timestrings");
    formData.append("password", "X82w2G4f");
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
      "https://app.pingbix.com/SMSApi/send",
      formData,
      {
        headers: {
          ...formData.getHeaders(),
          Cookie: "SERVERID=webC1",
        },
        maxBodyLength: Infinity,
      }
    );

    console.log("✅ SMS API Response:", smsResponse.data);

    if (smsResponse.data?.status === "success") {
      return res
        .status(CODES.OK)
        .json(
          sendResponse(
            CODES.OK,
            { phoneNumber: validPhone },
            "OTP sent successfully"
          )
        );
    } else {
      return res
        .status(CODES.INTERNAL_SERVER_ERROR)
        .json(
          sendResponse(CODES.INTERNAL_SERVER_ERROR, null, "Failed to send OTP")
        );
    }
  } catch (error: any) {
    console.error(
      "❌ Error generating OTP:",
      error.response?.data || error.message
    );
    return res
      .status(CODES.INTERNAL_SERVER_ERROR)
      .json(
        sendResponse(CODES.INTERNAL_SERVER_ERROR, null, "Something went wrong")
      );
  }
};

export const verifyOtp = async (req: Request, res: Response) => {
  try {
    const { phoneNumber, otp } = req.body;

    const result = phoneSchema.safeParse(phoneNumber);

    if (!result.success) {
      return res
        .status(CODES.BAD_REQUEST)
        .json(
          sendResponse(
            CODES.BAD_REQUEST,
            null,
            result.error.issues[0]?.message || "Invalid phone number"
          )
        );
    }

    const validPhone = result.data;

    // ✅ Dev mode shortcut (skip DB + OTP check)
    // if (env.NODE_ENV === "development" && otp === "123456") {
    //   console.log(`🔹 Dev mode OTP verified for ${validPhone}`);

    //   let user = await User.findOne({ phoneNumber: validPhone });
    //   if (!user) {
    //     user = await User.create({ phoneNumber: validPhone, isVerified: true });
    //   } else {
    //     user.isVerified = true;
    //     await user.save();
    //   }

    //   const token = jwt.sign(
    //     { _id: user._id, phoneNumber: validPhone },
    //     env.JWT_SECRET,
    //     { expiresIn: "7d" }
    //   );

    //   return res.status(CODES.OK).json(
    //     sendResponse(
    //       CODES.OK,
    //       {
    //         token,
    //         onboardingCompleted: user.onboardingCompleted,
    //       },
    //       "Phone number verified successfully (dev mode)"
    //     )
    //   );
    // }

    const verification = await Verification.findOne({
      phoneNumber: validPhone,
    });
    if (!verification) {
      return res
        .status(CODES.NOT_FOUND)
        .json(
          sendResponse(
            CODES.NOT_FOUND,
            null,
            "No OTP generated for this phone number"
          )
        );
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
    const user = await User.findOne({ phoneNumber: validPhone });
    if (!user) {
      return res
        .status(CODES.NOT_FOUND)
        .json(sendResponse(CODES.NOT_FOUND, null, "User not found"));
    }
    user.isVerified = true;
    await user.save();

    await Verification.deleteOne({ phoneNumber: validPhone });
    const token = jwt.sign(
      { _id: user._id, phoneNumber: validPhone },
      env.JWT_SECRET,
      { expiresIn: "7d" }
    );
    res.cookie("token", token, cookiesOption);

    return res.status(CODES.OK).json(
      sendResponse(
        CODES.OK,
        {
          token,
          onboardingCompleted: user.onboardingCompleted,
        },
        "Phone number verified successfully"
      )
    );
  } catch (error) {
    console.error("Error verifying OTP:", error);
    return res
      .status(CODES.INTERNAL_SERVER_ERROR)
      .json(
        sendResponse(CODES.INTERNAL_SERVER_ERROR, null, "Something went wrong")
      );
  }
};

export const registerUser = async (req: AuthRequest, res: Response) => {
  try {
    const userId = typeof req.user === "string" ? req.user : req.user?._id;
    if (!userId) {
      return res
        .status(CODES.UNAUTHORIZED)
        .json(sendResponse(CODES.UNAUTHORIZED, null, "Unauthorized"));
    }
    const { firstName, lastName, profilePictureUrl, email } = req.body;

    // ✅ Required fields check
    if (!firstName || !lastName) {
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
    if (email) {
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
    }
    // ✅ Check if user exists
    const user = await User.findById(userId);
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
        .json(
          sendResponse(CODES.BAD_REQUEST, null, "Onboarding already completed")
        );
    }

    const updateData: Partial<UserT> = {
      firstName,
      lastName,
      onboardingCompleted: true,
      profilePictureUrl: profilePictureUrl || undefined,
    };

    if (email) updateData.email = email;

    // ✅ Update user profile
    const onboardedUser = await User.findByIdAndUpdate(userId, updateData, {
      new: true,
    });

    const token = jwt.sign({ _id: user._id }, env.JWT_SECRET, {
      expiresIn: "7d",
    });
    res.cookie("token", token, cookiesOption);

    return res
      .status(CODES.OK)
      .json(
        sendResponse(CODES.OK, onboardedUser, "User onboarded successfully")
      );
  } catch (error) {
    console.error("Error registering user:", error);
    return res
      .status(CODES.INTERNAL_SERVER_ERROR)
      .json(
        sendResponse(CODES.INTERNAL_SERVER_ERROR, null, "Something went wrong")
      );
  }
};
