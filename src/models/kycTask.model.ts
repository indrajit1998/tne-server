import mongoose, { Schema } from "mongoose";

export type KycTaskType =
  | "ind_pan"
  | "ind_aadhaar"
  | "ind_driving_license"
  | "face";

export interface IKycTask {
  userId: mongoose.Types.ObjectId;
  groupId: string; // your generated group id (UUID)
  taskType: KycTaskType;
  taskId?: string; // your client-side task_id (optional)
  requestId?: string; // IDfy returned request_id
  status: "pending" | "in_progress" | "completed" | "failed";
  result?: any; // store response/result (no PII ideally)
  createdAt: Date;
  updatedAt: Date;
}

const KycTaskSchema = new Schema<IKycTask>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    groupId: { type: String, required: true, index: true },
    taskType: { type: String, required: true },
    taskId: { type: String },
    requestId: { type: String, index: true },
    status: { type: String, default: "pending" },
    result: { type: Schema.Types.Mixed },
  },
  { timestamps: true }
);

export const KycTask = mongoose.model<IKycTask>("KycTask", KycTaskSchema);
