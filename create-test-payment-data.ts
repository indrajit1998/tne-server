import dns from "dns";
dns.setServers(["8.8.8.8", "8.8.4.4"]);
import mongoose from "mongoose";
import env from "./src/lib/env";
import { User } from "./src/models/user.model";
import ConsignmentModel from "./src/models/consignment.model";
import { TravelModel } from "./src/models/travel.model";
import { CarryRequest } from "./src/models/carryRequest.model";
import NotificationModel from "./src/models/notification.model";
import Payment from "./src/models/payment.model";

async function main() {
  await mongoose.connect(env.DATABASE_URL);
  console.log("Connected to MongoDB Atlas");

  // 1. Find user with phone 7843835159
  const senderUser = await User.findOne({
    phoneNumber: { $regex: "7843835159" },
  });

  if (!senderUser) {
    throw new Error("Sender user 7843835159 not found in database!");
  }
  console.log(`Found sender user: ${senderUser.firstName} ${senderUser.lastName} (${senderUser._id})`);

  // 2. Find a traveller user (different from sender)
  const travellerUser = await User.findOne({
    _id: { $ne: senderUser._id },
    isVerified: true,
  });

  if (!travellerUser) {
    throw new Error("No other user found to act as traveller!");
  }
  console.log(`Found traveller user: ${travellerUser.firstName || "Traveller"} (${travellerUser._id})`);

  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const dayAfterTomorrow = new Date(Date.now() + 48 * 60 * 60 * 1000);

  // 3. Create active Travel record
  const travel = await TravelModel.create({
    travelerId: travellerUser._id,
    fromAddress: {
      street: "Andheri East",
      city: "Mumbai",
      state: "Maharashtra",
      postalCode: "400069",
      country: "India",
      flatNo: "204",
      landmark: "Near Metro",
    },
    toAddress: {
      street: "Connaught Place",
      city: "Delhi",
      state: "Delhi",
      postalCode: "110001",
      country: "India",
      flatNo: "502",
      landmark: "Inner Circle",
    },
    fromCoordinates: {
      type: "Point",
      coordinates: [72.8697, 19.1136],
    },
    toCoordinates: {
      type: "Point",
      coordinates: [77.2167, 28.6328],
    },
    distance: "1,400 km",
    expectedStartDate: tomorrow,
    expectedEndDate: dayAfterTomorrow,
    modeOfTravel: "air",
    durationOfStay: {
      days: 2,
      hours: 0,
    },
    durationOfTravel: "2 hours",
    status: "upcoming",
  });
  console.log(`✅ Created Travel: ${travel._id}`);

  // 4. Create active Consignment record for sender
  const consignment = await ConsignmentModel.create({
    senderId: senderUser._id,
    fromAddress: {
      street: "Andheri West",
      city: "Mumbai",
      state: "Maharashtra",
      postalCode: "400058",
      country: "India",
      flatNo: "101",
      landmark: "Near Station",
    },
    toAddress: {
      street: "Connaught Place",
      city: "Delhi",
      state: "Delhi",
      postalCode: "110001",
      country: "India",
      flatNo: "301",
      landmark: "Near Central Park",
    },
    fromCoordinates: {
      type: "Point",
      coordinates: [72.8363, 18.9385],
    },
    toCoordinates: {
      type: "Point",
      coordinates: [77.2225, 28.6323],
    },
    distance: "1,400 km",
    weight: 1,
    weightUnit: "kg",
    dimensions: {
      length: 10,
      width: 10,
      height: 5,
      unit: "cm",
    },
    flightPrice: {
      senderPay: 1,
      travelerEarn: 1,
    },
    trainPrice: {
      senderPay: 1,
      travelerEarn: 1,
    },
    roadWaysPrice: {
      senderPay: 1,
      travelerEarn: 1,
    },
    sendingDate: tomorrow,
    receiverName: "Test Receiver",
    receiverPhone: "+919876543210",
    category: "document",
    description: "Razorpay Test Package (₹1)",
    handleWithCare: true,
    images: [],
    status: "published",
  });
  console.log(`✅ Created Consignment: ${consignment._id}`);

  // 5. Create CarryRequest with status "accepted_pending_payment" and senderPayAmount: 1
  const carryRequest = await CarryRequest.create({
    consignmentId: consignment._id,
    travellerId: travellerUser._id,
    requestedBy: senderUser._id,
    travelId: travel._id,
    status: "accepted_pending_payment",
    senderPayAmount: 1, // ₹1 for test payment
    travellerEarning: 1,
  });
  console.log(`✅ Created CarryRequest: ${carryRequest._id} with senderPayAmount: ₹1`);

  // 6. Create high-priority Notification for the user
  const notification = await NotificationModel.create({
    userId: senderUser._id,
    title: "Payment Pending - Request Accepted",
    message: "Your carry request for \"Razorpay Test Package (₹1)\" has been accepted! Please pay ₹1 to confirm.",
    isRead: false,
    relatedConsignmentId: consignment._id,
    requestId: carryRequest._id,
    relatedTravelId: travel._id,
    typeOfNotif: "consignment",
  });
  console.log(`✅ Created Notification: ${notification._id}`);

  console.log("\n========================================================");
  console.log("🎉 TEST DATA CREATED SUCCESSFULLY FOR USER 7843835159!");
  console.log(`Sender User ID: ${senderUser._id}`);
  console.log(`Carry Request ID: ${carryRequest._id}`);
  console.log(`Consignment ID: ${consignment._id}`);
  console.log(`Amount to Pay: ₹1`);
  console.log("========================================================\n");

  await mongoose.disconnect();
}

main().catch(console.error);
