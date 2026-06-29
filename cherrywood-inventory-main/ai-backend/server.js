require("dotenv").config();
const express = require("express");
const cors = require("cors");
const nodemailer = require("nodemailer");
const Database = require('better-sqlite3');
const path = require("path");
const OpenAI = require("openai");

const app = express();

// ── UNBLOCK THE BRIDGE ────────────────────────────────────────
app.use(cors()); // Allow all websites to talk to this AI server

app.use(express.json());

// ── GLOBAL REQUEST LOGGER (The Smoke Detector) ──────────────
app.use((req, res, next) => {
    console.log(`🔔 [SERVER] Received ${req.method} request to ${req.path} from ${req.headers.origin || 'unknown'}`);
    next();
});
app.use((req, res, next) => {
    delete req.headers['expect'];
    next();
});

// ── FORCE CORS TO WORK ──────────────────────────────────────────
app.use(cors({ origin: '*' }));

app.use(express.json());

// ── OpenAI Setup ──────────────────────────────────────────────
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// ── Session Store ─────────────────────────────────────────────
const sessions = {};

// ── LIVE DATABASE QUERY ───────────────────────────────────────
function getLiveInventory() {
  try {
    const dbPath = process.env.DATABASE_PATH || path.join(__dirname, '..', 'inventory.db');
    console.log(`🗄️ Attempting to open database at: ${dbPath}`); // DEBUG LOG
    
    const db = new Database(dbPath);
    const sql = "SELECT id, part_name, stock_id, price, stock_status FROM parts WHERE stock_status = 'Available' LIMIT 100";
    const rows = db.prepare(sql).all();
    db.close();
    
    console.log(`✅ Found ${rows.length} available parts.`); // DEBUG LOG
    
    return rows.map(p => 
      `[ID:${p.id}] ${p.part_name} | SKU: ${p.stock_id} | Price: £${p.price} | Status: ${p.stock_status}`
    ).join("\n");
  } catch (err) {
    console.error("❌ DB Error:", err.message);
    return [];
  }
}

// ── System prompt ─────────────────────────────────────────────
function buildSystemPrompt() {
  const inventoryText = getLiveInventory();
  return `You are the AI customer enquiry assistant for Premium Auto Parts, a trusted local auto parts supplier.

YOUR JOB:
- Answer questions about parts, pricing, availability, and vehicle compatibility
- Collect customer details when they want to place a formal enquiry or callback request

COLLECTING ENQUIRY DETAILS:
If a customer wants to place an enquiry, collect ALL of the following one step at a time:
1. Full name
2. Best phone number
3. Email address
4. Vehicle make, model, and year
5. The part they need

Once you have all 5 details, summarise the enquiry and confirm: "Your enquiry has been submitted. A member of our team will be in touch within 2 hours."

Then include this exact tag at the end of your message:
[ENQUIRY_COMPLETE]

LIVE INVENTORY:
${inventoryText}`;
}

// ── Email setup ───────────────────────────────────────────────
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

async function sendStaffNotification(sessionId, enquiryDetails) {
  const history = sessions[sessionId] || [];
  const transcript = history
    .map(m => `${m.role === "user" ? "Customer" : "AI"}: ${m.content}`)
    .join("\n\n");

  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: process.env.STAFF_EMAIL,
    subject: `🔔 New Parts Enquiry — Premium Auto Parts`,
    html: `<div style="font-family: Arial, sans-serif; max-width: 600px;">
      <h2 style="color: white;">New Customer Enquiry</h2>
      <pre style="white-space: pre-wrap;">${transcript}</pre>
    </div>`,
  };
  await transporter.sendMail(mailOptions);
}

// ── Main chat endpoint ────────────────────────────────────────
app.post("/api/enquiry", async (req, res) => {
  console.log("🔔 [NODE] - Enquiry endpoint hit!"); // CRITICAL DEBUG LOG

  const { message, sessionId } = req.body;
  console.log(`📨 Message: "${message}", Session: ${sessionId}`); // DEBUG LOG

  if (!message || !sessionId) {
    return res.status(400).json({ error: "message and sessionId are required" });
  }

  if (!sessions[sessionId]) {
    sessions[sessionId] = [];
    console.log(`🆕 New session started: ${sessionId}`);
  }

  sessions[sessionId].push({ role: "user", content: message });

  try {
    console.log("🗄️ Building system prompt...");
    const systemPrompt = buildSystemPrompt();
    
    console.log("🤖 Calling OpenAI API...");
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        ...sessions[sessionId]
      ],
      max_tokens: 1000,
    });

    console.log("✅ OpenAI returned a response.");
    let reply = completion.choices[0]?.message?.content || "Sorry, please try again.";
    const enquiryComplete = reply.includes("[ENQUIRY_COMPLETE]");
    reply = reply.replace("[ENQUIRY_COMPLETE]", "").trim();

    sessions[sessionId].push({ role: "assistant", content: reply });

    if (enquiryComplete && process.env.EMAIL_USER && process.env.STAFF_EMAIL) {
      console.log("📧 Sending email notification...");
      sendStaffNotification(sessionId, reply).catch(err =>
        console.error("Email notification failed:", err)
      );
    }

    console.log("✅ Sending reply back to website.");
    res.json({ reply, enquiryComplete, sessionId });

  } catch (error) {
    console.error("❌ SERVER ERROR:", error.message); // This will reveal the specific crash
    res.status(500).json({ error: `Server error: ${error.message}` });
  }
});

// ── Get conversation transcript ───────────────────────────────
app.get("/api/enquiry/:sessionId", (req, res) => {
  const history = sessions[req.params.sessionId];
  if (!history) return res.status(404).json({ error: "Session not found" });
  res.json({ sessionId: req.params.sessionId, history, count: history.length });
});

app.get("/api/sessions", (req, res) => {
  const summary = Object.entries(sessions).map(([id, msgs]) => ({
    sessionId: id,
    messageCount: msgs.length,
    lastMessage: msgs[msgs.length - 1]?.content?.substring(0, 80) + "...",
    type: id.startsWith("email_") ? "email" : "chat",
  }));
  res.json({ sessions: summary, total: summary.length });
});

// ── Start server ──────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ AI Parts Agent running on port ${PORT}`);
});
