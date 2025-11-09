const bcrypt = require("bcryptjs");
const userModel = require("../../models/userModel");
const jwt = require("jsonwebtoken");
const os = require("os");
const axios = require("axios");
const { io } = require("../socket/initSocket");

// =======================================================
// 🟢 USER SIGN-IN CONTROLLER (Render + Local Compatible)
// =======================================================
async function userSignInController(req, res) {
  try {
    const { email, password } = req.body;

    if (!email || !password) throw new Error("Email & Password required");

    // ✅ Find user
    const user = await userModel.findOne({ email });
    if (!user) throw new Error("User not found");

    // ✅ Validate password
    const checkPassword = await bcrypt.compare(password, user.password);
    if (!checkPassword) throw new Error("Incorrect password");

    // ✅ Get system/device name
    const deviceName = os.hostname();

    // ✅ Get real client IP
    let ipAddress =
      req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
      req.socket.remoteAddress ||
      "Unknown";

    // Normalize IPv4 if includes "::ffff:"
    if (ipAddress.includes("::ffff:")) ipAddress = ipAddress.replace("::ffff:", "");

    // ✅ Check if local
    const isLocal =
      ipAddress === "127.0.0.1" ||
      ipAddress === "::1" ||
      ipAddress === "Unknown";

    // Default location values
    let city = "Unknown",
      state = "Unknown",
      country = "Unknown",
      latitude = null,
      longitude = null;

    // ✅ Fetch Geo info (works both local + Render)
    if (!isLocal) {
      try {
        const geoRes = await axios.get(`https://ipapi.co/${ipAddress}/json/`);
        const geo = geoRes.data;

        if (geo && !geo.error) {
          city = geo.city || "Unknown";
          state = geo.region || "Unknown";
          country = geo.country_name || "Unknown";
          latitude = geo.latitude || null;
          longitude = geo.longitude || null;
        }

        // Fallback (OpenStreetMap)
        if ((latitude === null || longitude === null) && city !== "Unknown") {
          const osmRes = await axios.get("https://nominatim.openstreetmap.org/search", {
            params: { format: "json", q: `${city}, ${state}, ${country}` },
          });
          if (osmRes.data.length > 0) {
            latitude = parseFloat(osmRes.data[0].lat);
            longitude = parseFloat(osmRes.data[0].lon);
          }
        }
      } catch (geoErr) {
        console.error("🌍 Geo lookup error:", geoErr.message || geoErr);
      }
    } else {
      // Local fallback (Mumbai)
      city = "Local";
      state = "Local";
      country = "Local";
      latitude = 19.076;
      longitude = 72.8777;
    }

    // ✅ Track login history
    if (!Array.isArray(user.logins)) user.logins = [];
    user.loginCount = (user.loginCount || 0) + 1;

    user.logins.push({
      deviceName,
      ipAddress,
      city,
      state,
      country,
      latitude,
      longitude,
      loggedInAt: new Date(),
    });

    // ✅ Update status & save
    user.isOnline = true;
    await user.save();

    // ✅ Real-time socket broadcast
    if (io()) {
      io().emit("admin_status", {
        adminId: user._id.toString(),
        isOnline: true,
      });
      console.log("📢 Admin online broadcasted via socket");
    }

    // ✅ Generate JWT
    const tokenData = { _id: user._id, email: user.email, role: user.role };
    const token = jwt.sign(tokenData, process.env.TOKEN_SECRET_KEY, {
      expiresIn: "7d",
    });

    // ✅ Send cookie securely
    res
      .cookie("token", token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "None",
        maxAge: 7 * 24 * 60 * 60 * 1000,
      })
      .status(200)
      .json({
        success: true,
        message: "Login successful",
        data: {
          token,
          user: {
            _id: user._id,
            name: user.name,
            email: user.email,
            role: user.role,
            loginCount: user.loginCount,
            logins: user.logins,
            isOnline: true,
          },
        },
        error: false,
      });
  } catch (err) {
    console.error("❌ Signin error:", err.message || err);
    res
      .status(400)
      .json({ message: err.message || err, error: true, success: false });
  }
}

module.exports = userSignInController;
