const express = require("express");
const router = express.Router();
const Case = require("../models/Case");
const EvidenceMeta = require("../models/EvidenceMeta");

// Create a new case
router.post("/createCase", async (req, res) => {
  try {
    const { title, description, owner } = req.body;

    if (!title || !owner) {
      return res.status(400).json({ success: false, message: "Missing title or owner" });
    }

    const newCase = await Case.create({ title, description, owner });
    res.json({ success: true, case: newCase });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Get all cases for a user
router.get("/cases", async (req, res) => {
  try {
    const { owner } = req.query;
    if (!owner) return res.status(400).json({ success: false, message: "Missing owner" });

    const cases = await Case.find({ owner }).populate("evidences");
    res.json({ success: true, cases });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Add evidence to a case (prevent duplicates)
router.post("/addEvidenceToCase", async (req, res) => {
  try {
    const { evidenceId, caseId } = req.body;
    const evidence = await EvidenceMeta.findOne({ evidenceId });
    const targetCase = await Case.findById(caseId);

    if (!evidence || !targetCase) {
      return res.status(404).json({ success: false, message: "Evidence or case not found" });
    }

    // Avoid duplicate entries
    if (!targetCase.evidences.includes(evidence._id)) {
      targetCase.evidences.push(evidence._id);
      await targetCase.save();
    }

    if (!evidence.cases.includes(caseId)) {
      evidence.cases.push(caseId);
      await evidence.save();
    }

    res.json({ success: true, message: "Evidence added to case" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Get all evidence for a user
router.get("/userEvidence", async (req, res) => {
  try {
    const { owner } = req.query;
    if (!owner) return res.status(400).json({ success: false, message: "Missing owner" });

    const evidences = await EvidenceMeta.find({ owner }).populate("cases");
    res.json({ success: true, evidences });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Get all evidence for a specific case
router.get("/case/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const foundCase = await Case.findById(id).populate("evidences");

    if (!foundCase) return res.status(404).json({ success: false, message: "Case not found" });

    res.json({ success: true, case: foundCase });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
