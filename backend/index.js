const express = require("express");
const cors = require("cors");
const http = require("http");
const cookieParser = require("cookie-parser");
const path = require("path");
require("dotenv").config();

const connectDB = require("./config/db");
const router = require("./routes");
const chatAuthRoutes = require("./routes/chatAuthRoutes");
const chatRoutes = require("./routes/chatRoutes");

const app = express();
const server = http.createServer(app);

// Import Socket from controller
const { initSocket } = require("./controller/socket/initSocket");

// =====================================================
// ✅ 1️⃣ STABLE & FLEXIBLE CORS CONFIG (Render + Netlify)
// =====================================================
const allowedOrigins = [
  "https://shubhanshutiwari.com", // ✅ Your Netlify frontend
  "http://localhost:5173",                        // ✅ Local development
];

app.use(
  cors({
    origin: function (origin, callback) {
      // Allow requests with no origin (like Postman)
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        console.warn("❌ Blocked by CORS:", origin);
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// =====================================================
// ✅ 2️⃣ MIDDLEWARES
// =====================================================
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(cookieParser());

// Serve uploaded images safely
app.use("/uploads", express.static(path.resolve(__dirname, "uploads")));

// =====================================================
// ✅ ROUTES
// =====================================================
app.use("/api", router);
app.use("/api/auth", chatAuthRoutes);
app.use("/api/chat", chatRoutes);

// =====================================================
// ✅ SOCKET INITIALIZATION
// =====================================================
initSocket(server);

// =====================================================
// ✅ SERVER + DATABASE START
// =====================================================
const PORT = process.env.PORT || 8080;

connectDB()
  .then(() => {
    server.listen(PORT, () => {
      console.log("✅ MongoDB Connected");
      console.log("🚀 Server running on port", PORT);
      console.log("🌍 Allowed Origins:", allowedOrigins.join(", "));
    });
  })
  .catch((err) => console.error("❌ DB connection failed:", err));
