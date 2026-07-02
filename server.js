import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import dotenv from "dotenv";
import bcrypt from "bcryptjs";
import path from "path";
import { fileURLToPath } from "url";
import multer from "multer";
import fs from "fs";
import FormData from "form-data";
import fetch from "node-fetch";
import jwt from "jsonwebtoken";

dotenv.config();


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure uploads directory exists
const UPLOADS_DIR = path.join(__dirname, "uploads");
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const app = express();
const PORT = process.env.PORT || 4000;

// Middleware
app.use(cors());
app.use(express.json());
app.use("/api", (req, res, next) => {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, private");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  res.setHeader("Vary", "Authorization");
  next();
});

// Multer — disk storage so original PDFs are kept for download
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    // Ensure directory exists before saving
    if (!fs.existsSync(UPLOADS_DIR)) {
      fs.mkdirSync(UPLOADS_DIR, { recursive: true });
    }
    cb(null, UPLOADS_DIR);
  },
  filename:    (_req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e6)}`;
    const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_");
    cb(null, `${unique}-${safeName}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (_req, file, cb) => {
    /\.(pdf|doc|docx)$/i.test(file.originalname)
      ? cb(null, true)
      : cb(new Error("Only PDF, DOC, DOCX files allowed"));
  },
});

// MongoDB Connection
const MONGODB_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/ai_resume_screening";
mongoose
  .connect(MONGODB_URI)
  .then(() => console.log("Connected to MongoDB successfully"))
  .catch((err) => console.error("MongoDB connection error:", err));

// User Schema & Model
const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true, lowercase: true },
  password: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
});

const User = mongoose.model("User", userSchema);

// Job Description Schema & Model
const jobDescriptionSchema = new mongoose.Schema({
  jobTitle: { type: String, required: true },
  department: { type: String },
  location: { type: String },
  skills: { type: String },
  description: { type: String, required: true },
  thresholdScore: { type: Number, default: 70 },
  createdBy: { type: String },
  createdAt: { type: Date, default: Date.now },
});

const JobDescription = mongoose.model("JobDescription", jobDescriptionSchema);

// ResumesData Schema & Model
const candidateProfileSchema = new mongoose.Schema({
  full_name: { type: String, default: "" },
  email: { type: String, default: "" },
  phone: { type: String, default: "" },
  location: { type: String, default: "" },
  linkedin: { type: String, default: "" },
  github: { type: String, default: "" },
  portfolio: { type: String, default: "" },
});

const resumeAnalysisSchema = new mongoose.Schema({
  experience_level: { type: String, default: "" },
  best_matching_roles: [String],
  resume_strengths: [String],
  resume_weaknesses: [String],
  missing_skills: mongoose.Schema.Types.Mixed,
  ats_score: { type: Number, default: 0 },
  communication_score: { type: Number, default: 0 },
  technical_score: { type: Number, default: 0 },
  overall_recommendation: { type: String, default: "" },
  shortlisting_decision: { type: String, default: "" },
  reason_for_decision: { type: String, default: "" },
});

const resumesDataSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  ownerEmail: { type: String, default: "", index: true },
  ownerName: { type: String, default: "" },
  candidate_profile: candidateProfileSchema,
  professional_summary: { type: String, default: "" },

  education: mongoose.Schema.Types.Mixed,
  technical_skills: mongoose.Schema.Types.Mixed,
  soft_skills: [String],
  work_experience: mongoose.Schema.Types.Mixed,
  internships: mongoose.Schema.Types.Mixed,
  projects: mongoose.Schema.Types.Mixed,
  certifications: mongoose.Schema.Types.Mixed,
  achievements: mongoose.Schema.Types.Mixed,
  resume_analysis: resumeAnalysisSchema,
  created_at: { type: Date, default: Date.now },
  status: { type: String, default: "Pending" },
  source: { type: String, default: "AI Resume Screening" },
  // Job association
  jobId: { type: mongoose.Schema.Types.ObjectId, ref: "JobDescription" },
  // File storage fields
  filePath:     { type: String, default: "" },   // stored filename in /uploads
  originalName: { type: String, default: "" },   // original uploaded filename
}, { collection: "resumesData" });

const ResumeData = mongoose.model("ResumeData", resumesDataSchema);

// Auth middleware (JWT)
const requireAuth = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization || "";
    const [scheme, token] = authHeader.split(" ");

    if (scheme !== "Bearer" || !token) {
      return res.status(401).json({ message: "Missing or invalid Authorization header." });
    }

    const jwtSecret = process.env.JWT_SECRET || "change-me";
    const payload = jwt.verify(token, jwtSecret);

    req.user = {
      userId: payload.userId,
      email: payload.email,
      name: payload.name,
    };

    next();
  } catch (err) {
    console.error("Auth error:", err);
    res.status(401).json({ message: "Unauthorized." });
  }
};

const getOwnedCandidateQuery = (req, candidateId) => {
  const ownershipClauses = [{ userId: req.user.userId }];
  if (req.user.email) ownershipClauses.push({ ownerEmail: req.user.email.toLowerCase() });

  return candidateId
    ? { _id: candidateId, $or: ownershipClauses }
    : { $or: ownershipClauses };
};

app.get("/uploads/:filename", requireAuth, async (req, res) => {
  try {
    const candidate = await ResumeData.findOne({
      filePath: req.params.filename,
      $or: [
        { userId: req.user.userId },
        { ownerEmail: req.user.email?.toLowerCase() || "" },
      ],
    });

    if (!candidate) {
      return res.status(404).json({ message: "File not found." });
    }

    const fullPath = path.join(UPLOADS_DIR, req.params.filename);
    if (!fs.existsSync(fullPath)) {
      return res.status(404).json({ message: "File not found on server." });
    }

    res.sendFile(fullPath);
  } catch (error) {
    console.error("Upload access error:", error);
    res.status(500).json({ message: "Server error. Please try again." });
  }
});

// REST API Endpoints


// POST /api/auth/signup
app.post("/api/auth/signup", async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: "Please fill in all fields." });
    }

    // Check if user exists
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({ message: "Email is already registered." });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create new user
    const newUser = new User({
      name,
      email: email.toLowerCase(),
      password: hashedPassword,
    });

    await newUser.save();

    res.status(201).json({ message: "Account created successfully! Please log in." });
  } catch (error) {
    console.error("Signup error:", error);
    res.status(500).json({ message: "Server error. Please try again." });
  }
});

// POST /api/auth/login
app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "Please fill in all fields." });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(400).json({ message: "Invalid email or password." });
    }

    // Compare password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Invalid email or password." });
    }

    // Return JWT (excluding password)
    const jwtSecret = process.env.JWT_SECRET || "change-me";
    const token = jwt.sign(
      { userId: user._id.toString(), email: user.email, name: user.name },
      jwtSecret,
      { expiresIn: process.env.JWT_EXPIRES_IN || "7d" }
    );

    res.json({
      token,
      user: {
        userId: user._id.toString(),
        name: user.name,
        email: user.email,
      },
    });

  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ message: "Server error. Please try again." });
  }
});

// POST /api/auth/forgot-password
app.post("/api/auth/forgot-password", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "Please fill in all fields." });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(404).json({ message: "Email address not found." });
    }

    // Hash new password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    user.password = hashedPassword;
    await user.save();

    res.json({ message: "Password reset successfully!" });
  } catch (error) {
    console.error("Forgot password error:", error);
    res.status(500).json({ message: "Server error. Please try again." });
  }
});

// GET /api/job-description
app.get("/api/job-description", async (req, res) => {
  try {
    const { email } = req.query;

    if (!email) {
      return res.status(400).json({ message: "Email is required to fetch job descriptions." });
    }

    const jobs = await JobDescription.find({ createdBy: email.toLowerCase() }).sort({ createdAt: -1 });
    res.json(jobs);
  } catch (error) {
    console.error("Job description fetch error:", error);
    res.status(500).json({ message: "Server error. Please try again." });
  }
});

// POST /api/job-description
app.post("/api/job-description", async (req, res) => {

  try {
    const { jobTitle, department, location, skills, description, thresholdScore, createdBy } = req.body;

    if (!jobTitle || !description) {
      return res.status(400).json({ message: "Job title and description are required." });
    }

    const jobEntry = new JobDescription({
      jobTitle,
      department,
      location,
      skills,
      description,
      thresholdScore: thresholdScore != null ? Number(thresholdScore) : 70,
      createdBy,
    });

    await jobEntry.save();
    res.status(201).json(jobEntry);
  } catch (error) {
    console.error("Job description save error:", error);
    res.status(500).json({ message: "Server error. Please try again." });
  }
});

// PUT /api/job-description/:id
app.put("/api/job-description/:id", async (req, res) => {
  try {
    const { jobTitle, department, location, skills, description, thresholdScore, createdBy } = req.body;

    if (!jobTitle || !description) {
      return res.status(400).json({ message: "Job title and description are required." });
    }

    const updateFields = { jobTitle, department, location, skills, description };
    if (thresholdScore != null) updateFields.thresholdScore = Number(thresholdScore);

    const job = await JobDescription.findOneAndUpdate(
      { _id: req.params.id, createdBy: createdBy?.toLowerCase() },
      updateFields,
      { new: true }
    );

    if (!job) {
      return res.status(404).json({ message: "Job not found or unauthorized." });
    }

    // Dynamic re-evaluation of associated candidates based on the updated threshold score
    if (thresholdScore != null) {
      const thresholdVal = Number(thresholdScore);
      try {
        const candidatesToUpdate = await ResumeData.find({
          jobId: job._id,
          "resume_analysis.ats_score": { $gt: 0 }
        });
        
        for (const candidate of candidatesToUpdate) {
          const atsScore = candidate.resume_analysis.ats_score;
          candidate.status = atsScore >= thresholdVal ? "Shortlisted" : "Rejected";
          if (candidate.resume_analysis) {
            candidate.resume_analysis.shortlisting_decision = atsScore >= thresholdVal ? "Selected" : "Rejected";
          }
          await candidate.save();
        }
        console.log(`[JOB UPDATE] Re-evaluated ${candidatesToUpdate.length} candidates for job ${job.jobTitle} with new threshold: ${thresholdVal}`);
      } catch (reEvalErr) {
        console.error("Error re-evaluating candidates on job update:", reEvalErr);
      }
    }

    res.json(job);
  } catch (error) {
    console.error("Job description update error:", error);
    res.status(500).json({ message: "Server error. Please try again." });
  }
});

// DELETE /api/job-description/:id
app.delete("/api/job-description/:id", async (req, res) => {
  try {
    const { email } = req.query;

    const job = await JobDescription.findOneAndDelete({
      _id: req.params.id,
      createdBy: email?.toLowerCase(),
    });

    if (!job) {
      return res.status(404).json({ message: "Job not found or unauthorized." });
    }

    res.json({ message: "Job deleted successfully." });
  } catch (error) {
    console.error("Job description delete error:", error);
    res.status(500).json({ message: "Server error. Please try again." });
  }
});

// Helper to merge N8N parsed resumes into placeholders
async function mergeCandidates(user) {
  try {
    if (!user?.userId) return;

    // User's own placeholder records (uploaded files, no AI data yet)
    const userDocs = await ResumeData.find({
      $or: [
        { userId: user.userId },
        { ownerEmail: user.email?.toLowerCase() },
      ]
    }).sort({ created_at: -1 });

    // N8N parsed records that have no filePath (AI data only, no file association yet)
    // These may not have userId set correctly depending on N8N config
    const orphanParsed = await ResumeData.find({
      filePath: { $in: ["", null] },
      $or: [
        { userId: user.userId },
        { ownerEmail: user.email?.toLowerCase() },
        // Also pick up records N8N saved without userId
        { userId: { $exists: false } },
      ]
    }).sort({ created_at: -1 });

    const allDocs = [...userDocs];
    // Add orphan parsed records not already in userDocs
    orphanParsed.forEach(op => {
      if (!allDocs.find(d => String(d._id) === String(op._id))) {
        allDocs.push(op);
      }
    });

    const placeholders = [];
    const parsedResumes = [];
    
    allDocs.forEach(doc => {
      const hasFilePath = !!(doc.filePath && doc.filePath.trim());
      const isParsed = doc.resume_analysis && (
        doc.resume_analysis.ats_score > 0 ||
        doc.resume_analysis.experience_level ||
        doc.candidate_profile?.email
      );
      
      if (hasFilePath && !isParsed) {
        placeholders.push(doc);
      } else if (!hasFilePath && isParsed) {
        parsedResumes.push(doc);
      }
    });
    
    for (const parsed of parsedResumes) {
      let bestMatch = null;
      let minTimeDiff = Infinity;
      
      for (const placeholder of placeholders) {
        const parsedTime = parsed.created_at || parsed._id.getTimestamp();
        const placeholderTime = placeholder.created_at || placeholder._id.getTimestamp();
        const timeDiff = Math.abs(new Date(parsedTime) - new Date(placeholderTime));
        
        if (timeDiff < 300000) { // 5 minutes
          const parsedName = (parsed.candidate_profile?.full_name || "").toLowerCase();
          const placeholderName = (placeholder.candidate_profile?.full_name || "").toLowerCase();
          
          const parsedWords = parsedName.split(/\s+/).filter(w => w.length >= 3);
          const placeholderWords = placeholderName.split(/\s+/).filter(w => w.length >= 3);
          
          const sharesWord = parsedWords.some(w => placeholderWords.includes(w));
          
          if (sharesWord || timeDiff < minTimeDiff) {
            bestMatch = placeholder;
            minTimeDiff = timeDiff;
          }
        }
      }
      
      if (bestMatch) {
        bestMatch.candidate_profile = {
          full_name: parsed.candidate_profile?.full_name || bestMatch.candidate_profile?.full_name,
          email: parsed.candidate_profile?.email || bestMatch.candidate_profile?.email,
          phone: parsed.candidate_profile?.phone || bestMatch.candidate_profile?.phone,
          location: parsed.candidate_profile?.location || bestMatch.candidate_profile?.location,
          linkedin: parsed.candidate_profile?.linkedin || bestMatch.candidate_profile?.linkedin,
          github: parsed.candidate_profile?.github || bestMatch.candidate_profile?.github,
          portfolio: parsed.candidate_profile?.portfolio || bestMatch.candidate_profile?.portfolio,
        };
        
        bestMatch.professional_summary = parsed.professional_summary;
        bestMatch.education = parsed.education;
        bestMatch.technical_skills = parsed.technical_skills;
        bestMatch.soft_skills = parsed.soft_skills;
        bestMatch.work_experience = parsed.work_experience;
        bestMatch.internships = parsed.internships;
        bestMatch.projects = parsed.projects;
        bestMatch.certifications = parsed.certifications;
        bestMatch.achievements = parsed.achievements;
        bestMatch.resume_analysis = parsed.resume_analysis;
        bestMatch.status = parsed.status || bestMatch.status || "Pending";

        // Auto-set status based on threshold score from the associated job
        const atsScore = parsed.resume_analysis?.ats_score || 0;
        if (bestMatch.jobId && atsScore > 0) {
          try {
            const associatedJob = await JobDescription.findById(bestMatch.jobId);
            if (associatedJob) {
              const threshold = associatedJob.thresholdScore || 70;
              if (atsScore >= threshold) {
                bestMatch.status = "Shortlisted";
                bestMatch.resume_analysis.shortlisting_decision = "Selected";
              } else {
                bestMatch.status = "Rejected";
                bestMatch.resume_analysis.shortlisting_decision = "Rejected";
              }
            }
          } catch (jobErr) {
            console.error("Error fetching job for threshold:", jobErr);
          }
        }

        // Fallback: if no jobId, use N8N shortlisting_decision
        if (!bestMatch.jobId || atsScore === 0) {
          const decision = (parsed.resume_analysis?.shortlisting_decision || "").toLowerCase();
          if (decision === "selected" || decision === "shortlist" || decision === "shortlisted") {
            bestMatch.status = "Shortlisted";
          } else if (decision === "rejected" || decision === "reject") {
            bestMatch.status = "Rejected";
          } else if (bestMatch.status === "Pending") {
            bestMatch.status = "Pending";
          }
        }

        // Ensure ownership is set on the merged record
        if (!bestMatch.userId) bestMatch.userId = user.userId;
        if (!bestMatch.ownerEmail) bestMatch.ownerEmail = user.email?.toLowerCase();
        
        await bestMatch.save();
        await ResumeData.deleteOne({ _id: parsed._id });
        
        const index = placeholders.indexOf(bestMatch);
        if (index > -1) {
          placeholders.splice(index, 1);
        }
      }
    }
  } catch (err) {
    console.error("Error merging candidates:", err);
  }
}

// POST /api/n8n/result — N8N calls this to update existing placeholder with AI analysis
// Matches by originalName + userId/userEmail, updates in place (no duplicate)
app.post("/api/n8n/result", async (req, res) => {
  try {
    const data = req.body;
    const userId  = data.userId;
    const userEmail = data.userEmail?.toLowerCase();
    const originalName = data.originalName;

    if (!originalName) {
      return res.status(400).json({ message: "originalName is required." });
    }

    const query = { originalName };
    if (userId || userEmail) {
      query.$or = [];
      if (userId) query.$or.push({ userId });
      if (userEmail) query.$or.push({ ownerEmail: userEmail });
    }

    const { userId: _u, userEmail: _e, originalName: _on, ...updateData } = data;

    const updated = await ResumeData.findOneAndUpdate(
      query,
      { $set: updateData },
      { new: true, sort: { created_at: -1 } }
    );

    if (updated) {
      // Auto-shortlist based on threshold score
      const atsScore = updated.resume_analysis?.ats_score || 0;
      if (updated.jobId && atsScore > 0) {
        try {
          const associatedJob = await JobDescription.findById(updated.jobId);
          if (associatedJob) {
            const threshold = associatedJob.thresholdScore || 70;
            updated.status = atsScore >= threshold ? "Shortlisted" : "Rejected";
            updated.resume_analysis.shortlisting_decision = atsScore >= threshold ? "Selected" : "Rejected";
            await updated.save();
          }
        } catch (jobErr) {
          console.error("Error fetching job for threshold (n8n result):", jobErr);
        }
      }
      console.log(`[N8N] Updated: ${originalName} | score: ${updated.resume_analysis?.ats_score}`);
      return res.json(updated);
    }

    // No placeholder — create new
    const newCandidateData = {
      ...updateData,
      userId: userId || undefined,
      ownerEmail: userEmail || "",
      originalName,
    };

    // Auto-shortlist based on threshold score
    const atsScore = newCandidateData.resume_analysis?.ats_score || 0;
    if (newCandidateData.jobId && atsScore > 0) {
      try {
        const associatedJob = await JobDescription.findById(newCandidateData.jobId);
        if (associatedJob) {
          const threshold = associatedJob.thresholdScore || 70;
          newCandidateData.status = atsScore >= threshold ? "Shortlisted" : "Rejected";
          if (newCandidateData.resume_analysis) {
            newCandidateData.resume_analysis.shortlisting_decision = atsScore >= threshold ? "Selected" : "Rejected";
          }
        }
      } catch (jobErr) {
        console.error("Error fetching job for threshold (new candidate):", jobErr);
      }
    }

    const candidate = await new ResumeData(newCandidateData).save();
    console.log(`[N8N] Created: ${originalName} | status: ${candidate.status}`);
    res.status(201).json(candidate);
  } catch (error) {
    console.error("N8N result save error:", error);
    res.status(500).json({ message: "Server error." });
  }
});

// GET /api/candidates
app.get("/api/candidates", requireAuth, async (req, res) => {
  try {
    await mergeCandidates(req.user);
    // Return only this user's candidates — strict isolation
    const candidates = await ResumeData.find({
      $or: [
        { userId: req.user.userId },
        { ownerEmail: req.user.email?.toLowerCase() },
      ]
    }).populate("jobId").sort({ created_at: -1 });
    res.json(candidates);
  } catch (error) {
    console.error("Candidates fetch error:", error);
    res.status(500).json({ message: "Server error. Please try again." });
  }
});


// PUT /api/candidates/:id/status
app.put("/api/candidates/:id/status", requireAuth, async (req, res) => {
  try {
    const { status } = req.body; // Shortlisted, Rejected, Pending

    const candidate = await ResumeData.findOneAndUpdate(
      getOwnedCandidateQuery(req, req.params.id),
      {
        $set: {
          status,
          "resume_analysis.shortlisting_decision":
            status === "Shortlisted" ? "Selected" : status === "Rejected" ? "Rejected" : "Hold",
        },
      },
      { new: true }
    ).populate("jobId");

    if (!candidate) {
      return res.status(404).json({ message: "Candidate not found." });
    }

    res.json(candidate);
  } catch (error) {
    console.error("Candidate status update error:", error);
    res.status(500).json({ message: "Server error. Please try again." });
  }
});


// DELETE /api/candidates/:id
app.delete("/api/candidates/:id", requireAuth, async (req, res) => {
  try {
    const candidate = await ResumeData.findOne(getOwnedCandidateQuery(req, req.params.id));
    if (!candidate) return res.status(404).json({ message: "Candidate not found." });


    // Delete the stored PDF from disk if it exists
    if (candidate.filePath) {
      const fullPath = path.join(UPLOADS_DIR, candidate.filePath);
      if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
    }

    await ResumeData.deleteOne({ _id: req.params.id });
    res.json({ message: "Candidate deleted successfully." });

  } catch (error) {
    console.error("Candidate delete error:", error);
    res.status(500).json({ message: "Server error. Please try again." });
  }
});

// POST /api/resume-upload — Save files to disk + forward to N8N + return files list
// This is the main upload endpoint called from the React frontend
app.post("/api/resume-upload", requireAuth, upload.array("resume", 20), async (req, res) => {

  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ message: "No files uploaded." });
    }

    // ── Duplicate check: filter out files already uploaded by this user ──
    const newFiles = [];
    const skippedFiles = [];

    for (const file of req.files) {
      const existing = await ResumeData.findOne({
        originalName: file.originalname,
        $or: [
          { userId: req.user.userId },
          { ownerEmail: req.user.email?.toLowerCase() },
        ],
      });

      if (existing) {
        // File already processed — delete the newly uploaded copy from disk
        const fullPath = path.join(UPLOADS_DIR, file.filename);
        if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
        skippedFiles.push({ filePath: existing.filePath, originalName: file.originalname, skipped: true });
        console.log(`[UPLOAD] Skipping duplicate file: ${file.originalname}`);
      } else {
        newFiles.push(file);
      }
    }

    // If all files are duplicates, return skipped info
    if (newFiles.length === 0) {
      return res.json({
        success: true,
        files: skippedFiles,
        message: "All files already uploaded.",
      });
    }

    const n8nUrl  = process.env.N8N_WEBHOOK_URL || "http://localhost:5678/webhook/resume_upload";
    const devMode = process.env.DEV_MODE === "true";

    let n8nResponse = null;

    if (!devMode) {
      try {
        // Read saved files from disk and forward to N8N
        const fd = new FormData();

        newFiles.forEach((file, index) => {
          const filePath = path.join(UPLOADS_DIR, file.filename);
          fd.append(`resume${index}`, fs.createReadStream(filePath), {
            filename:    file.originalname,
            contentType: file.mimetype,
          });
        });

        // Forward any additional fields from request
        if (req.body.jobId)          fd.append("jobId",          req.body.jobId);
        if (req.body.jobTitle)       fd.append("jobTitle",       req.body.jobTitle);
        if (req.body.department)     fd.append("department",     req.body.department);
        if (req.body.location)       fd.append("location",       req.body.location);
        if (req.body.skills)         fd.append("skills",         req.body.skills);
        if (req.body.jobDescription) fd.append("jobDescription", req.body.jobDescription);
        if (req.user?.userId)       fd.append("userId",         req.user.userId);
        if (req.user?.email)        fd.append("userEmail",      req.user.email.toLowerCase());
        if (req.user?.name)         fd.append("userName",       req.user.name);

        const webhookRes = await fetch(n8nUrl, {
          method:  "POST",
          body:    fd,
          headers: fd.getHeaders(),
        });

        if (webhookRes.ok) {
          const ct = webhookRes.headers.get("content-type") || "";
          if (ct.includes("application/json")) {
            n8nResponse = await webhookRes.json();
          }
          console.log(`[UPLOAD] N8N succeeded via ${n8nUrl}`);
        } else {
          const errText = await webhookRes.text().catch(() => "");
          console.warn(`[UPLOAD] N8N returned ${webhookRes.status} for ${n8nUrl}: ${errText.slice(0, 200)}`);

          // Fallback: try test webhook URL if production URL fails (workflow not activated)
          const testUrl = process.env.N8N_WEBHOOK_TEST_URL || n8nUrl.replace("/webhook/", "/webhook-test/");
          if (testUrl !== n8nUrl) {
            try {
              // Rebuild FormData for second request (streams can't be reused)
              const fd2 = new FormData();
              newFiles.forEach((file, index) => {
                const fp = path.join(UPLOADS_DIR, file.filename);
                fd2.append(`resume${index}`, fs.createReadStream(fp), {
                  filename:    file.originalname,
                  contentType: file.mimetype,
                });
              });
              if (req.body.jobId)          fd2.append("jobId",          req.body.jobId);
              if (req.body.jobTitle)       fd2.append("jobTitle",       req.body.jobTitle);
              if (req.body.department)     fd2.append("department",     req.body.department);
              if (req.body.location)       fd2.append("location",       req.body.location);
              if (req.body.skills)         fd2.append("skills",         req.body.skills);
              if (req.body.jobDescription) fd2.append("jobDescription", req.body.jobDescription);
              if (req.user?.userId)        fd2.append("userId",         req.user.userId);
              if (req.user?.email)         fd2.append("userEmail",      req.user.email.toLowerCase());
              if (req.user?.name)          fd2.append("userName",       req.user.name);

              const testRes = await fetch(testUrl, {
                method:  "POST",
                body:    fd2,
                headers: fd2.getHeaders(),
              });
              if (testRes.ok) {
                const ct2 = testRes.headers.get("content-type") || "";
                if (ct2.includes("application/json")) {
                  n8nResponse = await testRes.json();
                }
                console.log(`[UPLOAD] N8N fallback succeeded via ${testUrl}`);
              } else {
                const errText2 = await testRes.text().catch(() => "");
                console.warn(`[UPLOAD] N8N fallback returned ${testRes.status} for ${testUrl}: ${errText2.slice(0, 200)}`);
              }
            } catch (fallbackErr) {
              console.warn(`[UPLOAD] N8N fallback unreachable: ${fallbackErr.message}`);
            }
          }
        }
      } catch (n8nErr) {
        console.warn(`[UPLOAD] N8N unreachable: ${n8nErr.message}`);
      }
    }

    const uploadedFiles = newFiles.map(file => {
      const fullPath = path.join(UPLOADS_DIR, file.filename);
      const exists = fs.existsSync(fullPath);
      console.log(`[UPLOAD] File saved: ${file.filename} | exists: ${exists} | size: ${file.size} bytes`);
      return {
        filePath:     file.filename,
        originalName: file.originalname,
        downloadUrl:  `/uploads/${file.filename}`,
      };
    });

    // Return saved files info + N8N data to frontend
    res.json({
      success:      true,
      files:        uploadedFiles,
      n8nData:      n8nResponse,
    });

  } catch (error) {
    console.error("Resume upload error:", error);
    res.status(500).json({ message: error.message || "Server error during upload." });
  }
});

// POST /api/candidates/save — Save parsed candidate data (used by frontend AND N8N)
// JWT token se ya body mein userId/userEmail se user identify hota hai
app.post("/api/candidates/save", async (req, res) => {
  try {
    const data = req.body;

    let finalUserId = null;
    let finalEmail = "";
    let finalName = "";

    // Try JWT auth first (frontend calls)
    const authHeader = req.headers.authorization || "";
    const [scheme, token] = authHeader.split(" ");
    if (scheme === "Bearer" && token) {
      try {
        const jwtSecret = process.env.JWT_SECRET || "change-me";
        const payload = jwt.verify(token, jwtSecret);
        finalUserId = payload.userId;
        finalEmail = payload.email?.toLowerCase() || "";
        finalName = payload.name || "";
      } catch {
        // JWT invalid — try body fields (N8N)
      }
    }

    // N8N passes userId + userEmail in body
    if (!finalUserId && data.userId) {
      finalUserId = data.userId;
      finalEmail = data.userEmail?.toLowerCase() || "";
      finalName = data.userName || "";
    }

    if (!finalUserId) {
      return res.status(401).json({ message: "Missing userId or Authorization header." });
    }

    const { userId: _u, userEmail: _e, userName: _n, ...safeData } = data || {};

    // Auto-set status from threshold score if jobId is present
    const atsScore = safeData.resume_analysis?.ats_score || 0;
    if (safeData.jobId && atsScore > 0) {
      try {
        const associatedJob = await JobDescription.findById(safeData.jobId);
        if (associatedJob) {
          const threshold = associatedJob.thresholdScore || 70;
          safeData.status = atsScore >= threshold ? "Shortlisted" : "Rejected";
          if (safeData.resume_analysis) {
            safeData.resume_analysis.shortlisting_decision = atsScore >= threshold ? "Selected" : "Rejected";
          }
        }
      } catch (jobErr) {
        console.error("Error fetching job for threshold (save):", jobErr);
      }
    }

    // Fallback: Auto-set status from N8N shortlisting_decision
    if (!safeData.status || safeData.status === "Pending") {
      const decision = (safeData.resume_analysis?.shortlisting_decision || "").toLowerCase();
      if (decision === "selected" || decision === "shortlist" || decision === "shortlisted") {
        safeData.status = "Shortlisted";
      } else if (decision === "rejected" || decision === "reject") {
        safeData.status = "Rejected";
      }
    }

    // Check for duplicate — same originalName already exists for this user
    if (safeData.originalName && finalUserId) {
      const existing = await ResumeData.findOne({
        originalName: safeData.originalName,
        $or: [
          { userId: finalUserId },
          { ownerEmail: finalEmail },
        ]
      });
      if (existing) {
        // Return existing record instead of creating duplicate
        return res.status(200).json(existing);
      }
    }

    const candidate = await new ResumeData({
      ...safeData,
      userId: finalUserId,
      ownerEmail: finalEmail,
      ownerName: finalName,
    }).save();

    res.status(201).json(candidate);
  } catch (error) {
    console.error("Candidate save error:", error);
    res.status(500).json({ message: "Server error. Please try again." });
  }
});


// POST /api/candidates/upload-file — store original PDF for a candidate
app.post("/api/candidates/upload-file", requireAuth, upload.single("resume"), async (req, res) => {

  try {
    if (!req.file) return res.status(400).json({ message: "No file uploaded." });
    const { candidateId } = req.body;

    if (candidateId) {
      // Link file to existing candidate record (ownership enforced)
      const candidate = await ResumeData.findOneAndUpdate(
        getOwnedCandidateQuery(req, candidateId),
        {
          filePath: req.file.filename,
          originalName: req.file.originalname,
        }
      );

      if (!candidate) {
        const fullPath = path.join(UPLOADS_DIR, req.file.filename);
        if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
        return res.status(404).json({ message: "Candidate not found or unauthorized." });
      }
    }


    res.json({
      filePath:     req.file.filename,
      originalName: req.file.originalname,
      downloadUrl:  `${process.env.VITE_API_URL || "http://localhost:4000"}/uploads/${req.file.filename}`,
    });
  } catch (error) {
    console.error("File upload error:", error);
    res.status(500).json({ message: "Server error. Please try again." });
  }
});

// GET /api/candidates/:id/download — download original resume PDF
app.get("/api/candidates/:id/download", requireAuth, async (req, res) => {
  try {
    const candidate = await ResumeData.findOne(getOwnedCandidateQuery(req, req.params.id));
    if (!candidate) return res.status(404).json({ message: "Candidate not found." });


    if (!candidate.filePath) {
      return res.status(404).json({ message: "No resume file stored for this candidate." });
    }

    const fullPath = path.join(UPLOADS_DIR, candidate.filePath);
    if (!fs.existsSync(fullPath)) {
      return res.status(404).json({ message: "Resume file not found on server." });
    }

    res.download(fullPath, candidate.originalName || candidate.filePath);
  } catch (error) {
    console.error("Download error:", error);
    res.status(500).json({ message: "Server error. Please try again." });
  }
});

// Serve static assets in production
if (process.env.NODE_ENV === "production") {
  app.use(express.static(path.join(__dirname, "dist")));

  app.get("*", (req, res, next) => {
    // Skip API routes and upload routes
    if (req.path.startsWith("/api") || req.path.startsWith("/uploads")) {
      return next();
    }
    res.sendFile(path.join(__dirname, "dist", "index.html"));
  });
}

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
