const mongoose = require("mongoose");

const CaseSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: String,
  owner: { type: String, required: true }, // wallet address
  evidences: [{ type: mongoose.Schema.Types.ObjectId, ref: "EvidenceMeta" }],
  createdAt: { type: Date, default: () => new Date() },
});

module.exports = mongoose.model("Case", CaseSchema);
