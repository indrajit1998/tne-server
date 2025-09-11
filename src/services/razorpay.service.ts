import axios from "axios";
import env from "../lib/env";
import logger from "../lib/logger";

const RAZORPAY_KEY_ID = env.RAZORPAY_KEY_ID!;
const RAZORPAY_KEY_SECRET = env.RAZORPAY_KEY_SECRET!;

export async function createRazorpayContactId(
  name: string,
  email: string,
  phone: string
): Promise<string> {
  try {
    const response = await axios.post(
      "https://api.razorpay.com/v1/contacts",
      {
        name,
        email,
        contact: phone,
        type: "customer",
      },
      {
        auth: {
          username: RAZORPAY_KEY_ID,
          password: RAZORPAY_KEY_SECRET,
        },
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    return response.data.id;
  } catch (error: any) {
    logger.error(
      `Error creating Razorpay contact: ${
        error.response?.data || error.message
      }`
    );
    throw new Error(
      error.response?.data?.error?.description ||
        "Failed to create Razorpay contact"
    );
  }
}

interface VpaValidationResult {
  success: boolean;
  customerName?: string;
}

export async function validateVpa(vpa: string): Promise<VpaValidationResult> {
  try {
    const response = await axios.post(
      "https://api.razorpay.com/v1/payments/validate/vpa",
      { vpa },
      {
        auth: {
          username: RAZORPAY_KEY_ID,
          password: RAZORPAY_KEY_SECRET,
        },
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    const { success, customer_name } = response.data;

    if (success) {
      return { success: true, customerName: customer_name };
    } else {
      return { success: false };
    }
  } catch (error: any) {
    console.error(
      "Error validating VPA:",
      error.response?.data || error.message
    );
    return { success: false };
  }
}
export async function createBankFundAccount(
  contactId: string,
  name: string,
  ifsc: string,
  accountNumber: string
): Promise<string> {
  try {
    const response = await axios.post(
      "https://api.razorpay.com/v1/fund_accounts",
      {
        contact_id: contactId,
        account_type: "bank_account",
        bank_account: {
          name,
          ifsc,
          account_number: accountNumber,
        },
      },
      {
        auth: {
          username: RAZORPAY_KEY_ID,
          password: RAZORPAY_KEY_SECRET,
        },
        headers: { "Content-Type": "application/json" },
      }
    );

    return response.data.id;
  } catch (error: any) {
    console.error(
      "Error creating Bank Fund Account:",
      error.response?.data || error.message
    );
    throw new Error(
      error.response?.data?.error?.description ||
        "Failed to create Bank Fund Account"
    );
  }
}

export async function createVpaFundAccount(
  contactId: string,
  vpaAddress: string
): Promise<string> {
  try {
    const response = await axios.post(
      "https://api.razorpay.com/v1/fund_accounts",
      {
        contact_id: contactId,
        account_type: "vpa",
        vpa: {
          address: vpaAddress,
        },
      },
      {
        auth: {
          username: RAZORPAY_KEY_ID,
          password: RAZORPAY_KEY_SECRET,
        },
        headers: { "Content-Type": "application/json" },
      }
    );

    return response.data.id;
  } catch (error: any) {
    console.error(
      "Error creating VPA Fund Account:",
      error.response?.data || error.message
    );
    throw new Error(
      error.response?.data?.error?.description ||
        "Failed to create VPA Fund Account"
    );
  }
}
