require("dotenv").config();
const express = require("express");
const cors = require("cors");
const nodemailer = require("nodemailer");
const Database = require('better-sqlite3'); // New import
const path = require("path");
const OpenAI = require("openai");

const app = express();
app.use(cors());
app.use(express.json());

// ── OpenAI Setup ──────────────────────────────────────────────
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// ── Session Store ─────────────────────────────────────────────
const sessions = {};

// ── LIVE DATABASE QUERY (Fixed for better-sqlite3) ───────────
function getLiveInventory() {
  try {
    const dbPath = process.env.DATABASE_PATH || path.join(__dirname, '..', 'inventory.db');
    const db = new Database(dbPath);
    const sql = "SELECT id, part_name, stock_id, price, stock_status FROM parts WHERE stock_status = 'Available' LIMIT 100";
    const rows = db.prepare(sql).all();
    db.close();
    return rows.map(p => 
      `[ID:${p.id}] ${p.part_name} | SKU: ${p.stock_id} | Price: £${p.price} | Status: ${p.stock_status}`
    ).join("\n");
  } catch (err) {
    console.error("DB Error:", err);
    return [];
  }
}

// ── System prompt (Now synchronous) ───────────────────────────
function buildSystemPrompt() {
  const inventoryText = getLiveInventory();
  return `You are the AI customer enquiry assistant for Premium Auto Parts, a trusted local auto parts supplier.

YOUR JOB:
- Answer questions about parts, pricing, availability, and vehicle compatibility
- Collect customer details when they want to place a formal enquiry or callback request
- Be warm, professional, and knowledgeable — like a helpful member of staff

COLLECTING ENQUIRY DETAILS:
If a customer wants to place an enquiry, order a part, or requests a callback, collect ALL of the following one step at a time:
1. Full name
2. Best phone number
3. Email address
4. Vehicle make, model, and year
5. The part they need

Once you have all 5 details, summarise the enquiry back to them and confirm: "Your enquiry has been submitted. A member of our team will be in touch within 2 hours during business hours."

Then include this exact tag at the end of your message:
[ENQUIRY_COMPLETE]

LIVE INVENTORY:
${inventoryText}`;
}
