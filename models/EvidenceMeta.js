const mongoose = require("mongoose");

const EvidenceMetaSchema = new mongoose.Schema({
  evidenceId: { type: String, required: true, unique: true },
  cid: String,
  originalName: String,
  mimeType: String,
  name: String,
  description: String,
  owner: { type: String, required: true },
  version: { type: Number, default: 1 },
  cases: [{ type: mongoose.Schema.Types.ObjectId, ref: "Case" }],
  createdAt: { type: Date, default: () => new Date() },
});

module.exports = mongoose.model("EvidenceMeta", EvidenceMetaSchema);
