import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import dotenv from "dotenv";
import multer from "multer";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const PORT = process.env.PORT || 4000;
const MONGODB_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/ai_resume_screening";

app.use(cors({ origin: true }));
app.use(express.json());

const distPath = path.join(__dirname, "dist");
app.use(express.static(distPath));

// ensure uploads directory
const uploadsDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// multer setup
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadsDir);
  },
  filename: function (req, file, cb) {
    const unique = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, `${unique}-${file.originalname}`);
  },
});

const upload = multer({ storage });

// Resume schema
const resumeSchema = new mongoose.Schema({
  uploaderEmail: { type: String, required: true },
  uploaderName: { type: String, required: true },
  filename: { type: String, required: true },
  originalname: { type: String, required: true },
  size: { type: Number },
}, { timestamps: true });

const Resume = mongoose.models.Resume || mongoose.model("Resume", resumeSchema);

const userSchema = new mongoose.Schema(
  {
    role: { type: String, required: true, enum: ["seeker", "provider"] },
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    company: { type: String, default: "" },
  },
  {
    timestamps: true,
  }
);

const User = mongoose.models.User || mongoose.model("User", userSchema);

mongoose
  .connect(MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => {
    console.log("Connected to MongoDB");
  })
  .catch((error) => {
    console.error("MongoDB connection error:", error);
    process.exit(1);
  });

const sanitizeUser = (user) => ({
  id: user._id,
  role: user.role,
  name: user.name,
  email: user.email,
  company: user.company,
});

app.post("/api/auth/signup", async (req, res) => {
  try {
    const { role, name, email, password, company } = req.body;

    if (!role || !email || !password || !name) {
      return res.status(400).json({ message: "Missing required fields." });
    }

    const existing = await User.findOne({ email: email.trim().toLowerCase(), role });
    if (existing) {
      return res.status(409).json({ message: "Account already exists." });
    }

    const user = await User.create({
      role,
      name: name.trim(),
      email: email.trim().toLowerCase(),
      password,
      company: company?.trim() || "",
    });

    return res.status(201).json({ user: sanitizeUser(user) });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Unable to create account." });
  }
});

app.post("/api/auth/login", async (req, res) => {
  try {
    const { role, email, password } = req.body;

    if (!role || !email || !password) {
      return res.status(400).json({ message: "Missing required fields." });
    }

    const user = await User.findOne({ email: email.trim().toLowerCase(), role });
    if (!user || user.password !== password) {
      return res.status(401).json({ message: "Invalid credentials." });
    }

    return res.status(200).json({ user: sanitizeUser(user) });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Unable to login." });
  }
});

// Upload resume (used by job seekers)
app.post("/api/resume/upload", upload.single("resume"), async (req, res) => {
  try {
    const file = req.file;
    const { uploaderEmail, uploaderName } = req.body;

    if (!file || !uploaderEmail || !uploaderName) {
      return res.status(400).json({ message: "Missing file or uploader info." });
    }

    const doc = await Resume.create({
      uploaderEmail: uploaderEmail.trim().toLowerCase(),
      uploaderName: uploaderName.trim(),
      filename: file.filename,
      originalname: file.originalname,
      size: file.size,
    });

    return res.status(201).json({ resume: doc });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Unable to upload resume." });
  }
});

// List resumes (provider access)
app.get("/api/resumes", async (req, res) => {
  try {
    const resumes = await Resume.find().sort({ createdAt: -1 }).lean();
    return res.json({ resumes });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Unable to list resumes." });
  }
});

// Download resume by id
app.get("/api/resumes/:id/download", async (req, res) => {
  try {
    const id = req.params.id;
    const doc = await Resume.findById(id).lean();
    if (!doc) return res.status(404).send("Not found");
    const filePath = path.join(uploadsDir, doc.filename);
    if (!fs.existsSync(filePath)) return res.status(404).send("File not found");
    res.download(filePath, doc.originalname);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Unable to download resume." });
  }
});

app.get("/api/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.get("*", (req, res) => {
  res.sendFile(path.join(distPath, "index.html"));
});

app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
