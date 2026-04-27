import Razorpay from "razorpay";
import crypto from "crypto";
import Donation from "../models/Donation.model.js";

const getRazorpay = () => {
  if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
    throw new Error("RAZORPAY_KEY_ID or RAZORPAY_KEY_SECRET is missing in .env");
  }
  return new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
  });
};

// POST /api/donation/create-order
export const createOrder = async (req, res) => {
  try {
    const { name, email, contact, amount } = req.body;

    if (!name || !email || !contact || !amount) {
      return res.status(400).json({ success: false, message: "All fields are required." });
    }

    if (isNaN(amount) || Number(amount) < 1) {
      return res.status(400).json({ success: false, message: "Invalid donation amount." });
    }

    const razorpay = getRazorpay();

    const options = {
      amount: Math.round(Number(amount) * 100),
      currency: "INR",
      receipt: `donation_${Date.now()}`,
      notes: { name, email, contact },
    };

    const order = await razorpay.orders.create(options);

    return res.status(201).json({
      success: true,
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: process.env.RAZORPAY_KEY_ID,
      donorInfo: { name, email, contact, amount: Number(amount) },
    });
  } catch (error) {
    console.error("Razorpay create order error:", error);
    return res.status(500).json({ success: false, message: "Failed to create payment order." });
  }
};

// POST /api/donation/verify-payment
export const verifyPayment = async (req, res) => {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      donorInfo,
    } = req.body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !donorInfo) {
      return res.status(400).json({ success: false, message: "Missing payment verification fields." });
    }

    const body = `${razorpay_order_id}|${razorpay_payment_id}`;
    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(body)
      .digest("hex");

    if (expectedSignature !== razorpay_signature) {
      return res.status(400).json({ success: false, message: "Payment verification failed. Signature mismatch." });
    }

    const donation = await Donation.create({
      name: donorInfo.name,
      email: donorInfo.email,
      contact: donorInfo.contact,
      amount: donorInfo.amount,
      razorpayOrderId: razorpay_order_id,
      razorpayPaymentId: razorpay_payment_id,
      razorpaySignature: razorpay_signature,
      status: "success",
    });

    return res.status(200).json({
      success: true,
      message: "Payment verified and donation saved successfully.",
      donation,
    });
  } catch (error) {
    console.error("Payment verification error:", error);
    return res.status(500).json({ success: false, message: "Internal server error during payment verification." });
  }
};



export const getAllDonations = async (req, res) => {
  try {
    const donations = await Donation.find({ status: "success" })
      .sort({ createdAt: -1 });
    return res.status(200).json({ success: true, donations });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Failed to fetch donations." });
  }
};