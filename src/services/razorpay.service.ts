import axios from "axios";
import env from "../lib/env";
import logger from "../lib/logger";

const RAZORPAY_KEY_ID = env.RAZORPAY_KEY_ID!;
const RAZORPAY_KEY_SECRET = env.RAZORPAY_KEY_SECRET!;

interface VpaValidationResult {
  success: boolean;
  customerName?: string;
}

export interface RazorpayPayoutResponse {
  id: string;
  entity: string;
  amount: number;
  currency: string;
  status: string;
  fund_account_id: string;
  mode: string;
  purpose: string;
  notes: Record<string, any>;
  created_at: number;
  failure_reason?: string;
  [key: string]: any; // allow extra fields
}

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

export async function createPayout(
  fundAccountId: string,
  amount: number,
  options?: {
    currency?: string;
    mode?: "IMPS" | "NEFT" | "UPI";
    notes?: Record<string, any>;
    idempotencyKey?: string;
  }
): Promise<RazorpayPayoutResponse> {
  const {
    currency = "INR",
    mode = "IMPS",
    notes = {},
    idempotencyKey,
  } = options || {};

  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    // Razorpay requires idempotency header for payouts (X-Payout-Idempotency)
    if (idempotencyKey) {
      headers["X-Payout-Idempotency"] = idempotencyKey;
    }

    const response = await axios.post(
      "https://api.razorpay.com/v1/payouts",
      {
        account_number: env.RAZORPAY_ACCOUNT_NUMBER, // RazorpayX account number
        fund_account_id: fundAccountId,
        amount: amount * 100, // paise
        currency,
        mode,
        purpose: "payout",
        queue_if_low_balance: true,
        notes,
      },
      {
        auth: {
          username: RAZORPAY_KEY_ID,
          password: RAZORPAY_KEY_SECRET,
        },
        headers,
      }
    );

    const data = response.data;

    // runtime validation
    if (
      !data ||
      typeof data.id !== "string" ||
      typeof data.status !== "string"
    ) {
      logger.error("Invalid payout response from Razorpay:", data);
      throw new Error("Invalid response from Razorpay payout API");
    }

    // safe to typecast now
    return data as RazorpayPayoutResponse; // returns payout object which includes id
  } catch (error: any) {
    const errData =
      error.response?.data ||
      error.response ||
      error.message ||
      error.toString();

    logger.error("Error creating payout: " + JSON.stringify(errData, null, 2));

    throw new Error(
      error.response?.data?.error?.description ||
        error.message ||
        "Failed to create payout"
    );
  }
}
