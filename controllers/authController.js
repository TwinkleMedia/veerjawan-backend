import Admin from "../models/Admin.js";

export const loginAdmin = async (req, res) => {
  try {
    const { email, password } = req.body;

    const admin = await Admin.findOne({ email, password });

    if (!admin) {
      return res.status(401).json({
        message: "Invalid credentials",
      });
    }

    res.cookie("admin", "true", {
      httpOnly: true,
      path: "/",
    });

    res.json({
      message: "Login successful",
    });

  } catch (error) {
    res.status(500).json({
      message: "Server error",
    });
  }
};