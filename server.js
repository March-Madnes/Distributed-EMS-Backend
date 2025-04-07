const express = require("express");
const multer = require("multer");
const axios = require("axios");
const cors = require("cors");
const fs = require("fs");
const FormData = require("form-data");
const Web3 = require("web3").default;
const contractABI = require("./EvidenceABI.json");
require("dotenv").config();

const app = express();
app.use(cors({ origin: "http://localhost:5173" }));
app.use(express.json());

const upload = multer({ dest: "uploads/" });

const PINATA_API_KEY = process.env.PINATA_API_KEY;
const PINATA_SECRET_API_KEY = process.env.PINATA_SECRET_API_KEY;
const CONTRACT_ADDRESS = "0xd19dEbBbb4A9E98885D14135eDD26053c47E5BD3";
const ADMIN_ADDRESS = "0x89a21195cE6ff7611fF5F8A02C3550F851CeD912";

const web3 = new Web3("http://127.0.0.1:7545");
const evidenceContract = new web3.eth.Contract(contractABI, CONTRACT_ADDRESS);

// ========================== ROLE MANAGEMENT ==========================

const isInvestigator = async (address) => {
  try {
    const role = await evidenceContract.methods.getUserRole(address).call();
    return role === "1";
  } catch (error) {
    console.error("❌ Error checking role:", error.message);
    return false;
  }
};

const assignInvestigatorRole = async (address) => {
  try {
    await evidenceContract.methods
      .assignRole(address, 1)
      .send({ from: ADMIN_ADDRESS, gas: 500000 });
    console.log(`✅ Assigned Investigator Role to ${address}`);
  } catch (error) {
    console.error("❌ Error assigning Investigator role:", error.message);
  }
};

app.get("/test/role/:address", async (req, res) => {
  try {
    const address = req.params.address;
    const role = await evidenceContract.methods.getUserRole(address).call();
    res.json({ success: true, address, role: role.toString() });
  } catch (error) {
    res
      .status(500)
      .json({
        success: false,
        message: "Error fetching user role",
        error: error.message,
      });
  }
});

app.post("/assignRole", async (req, res) => {
  try {
    const { address, role } = req.body;
    if (![1, 2].includes(role)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid role ID" });
    }

    await evidenceContract.methods
      .assignRole(address, role)
      .send({ from: ADMIN_ADDRESS, gas: 500000 });
    res.json({ success: true, message: `Role ${role} assigned to ${address}` });
  } catch (error) {
    res
      .status(500)
      .json({
        success: false,
        message: "Error assigning role",
        error: error.message,
      });
  }
});

// ========================== EVIDENCE MANAGEMENT ==========================

app.post("/upload", upload.single("file"), async (req, res) => {
  try {
    const file = req.file;
    const { owner, fileName, fileDescription } = req.body;

    if (!file || !owner || !fileName || !fileDescription) {
      return res
        .status(400)
        .json({ success: false, message: "Missing required fields." });
    }

    const isUserInvestigator = await isInvestigator(owner);
    if (!isUserInvestigator) {
      console.log(`🔹 Assigning Investigator role to ${owner}...`);
      await assignInvestigatorRole(owner);
    }

    const data = new FormData();
    data.append("file", fs.createReadStream(file.path));

    const response = await axios.post(
      "https://api.pinata.cloud/pinning/pinFileToIPFS",
      data,
      {
        maxBodyLength: "Infinity",
        headers: {
          "Content-Type": `multipart/form-data; boundary=${data._boundary}`,
          pinata_api_key: PINATA_API_KEY,
          pinata_secret_api_key: PINATA_SECRET_API_KEY,
        },
      }
    );

    await evidenceContract.methods
      .addEvidence(
        response.data.IpfsHash,
        file.originalname,
        file.mimetype,
        "hash-placeholder",
        "password-placeholder",
        fileName,
        fileDescription
      )
      .send({ from: owner, gas: 5000000 });

    fs.unlinkSync(file.path);

    res.json({
      success: true,
      message: "Evidence uploaded successfully!",
      ipfsHash: response.data.IpfsHash,
    });
  } catch (error) {
    res
      .status(500)
      .json({
        success: false,
        message: "Error uploading evidence",
        error: error.message,
      });
  }
});

app.get("/evidence", async (req, res) => {
  try {
    const viewer = req.query.viewer.toString();

    if (!viewer) {
      return res
        .status(400)
        .json({ success: false, message: "Viewer address is required" });
    }

    const count = await evidenceContract.methods.getEvidenceCount().call();
    let records = [];

    for (let i = 1; i <= count; i++) {
      try {
        const evidence = await evidenceContract.methods
          .getEvidence(i)
          .call({ from: viewer });

        // Convert BigInts to strings for JSON serialization
        const formatted = {
          id: i,
          cid: evidence.cid,
          originalName: evidence.originalName,
          mimeType: evidence.mimeType,
          name: evidence.name,
          description: evidence.description,
          owner: evidence.owner,
          timestamp: evidence.timestamp.toString(), // BigInt
        };

        records.push(formatted);
      } catch (err) {
        // Access denied — skip
        continue;
      }
    }

    res.json({ success: true, data: records });
  } catch (error) {
    res
      .status(500)
      .json({
        success: false,
        message: "Error fetching evidence",
        error: error.message,
      });
  }
});

app.get("/evidence/:id/:address", async (req, res) => {
  try {
    const { id, address } = req.params;
    const evidence = await evidenceContract.methods
      .getEvidence(id)
      .call({ from: address });
    res.json({ success: true, evidence });
  } catch (error) {
    res
      .status(403)
      .json({ success: false, message: "Access denied", error: error.message });
  }
});

app.get("/evidence/:id/access/:user", async (req, res) => {
  try {
    const { id, user } = req.params;
    const accessibleIds = await evidenceContract.methods
      .getAccessibleEvidenceIds(user)
      .call();
    const hasAccess = accessibleIds.includes(id.toString());
    res.json({ success: true, hasAccess });
  } catch (error) {
    res
      .status(500)
      .json({
        success: false,
        message: "Error checking access",
        error: error.message,
      });
  }
});

app.post("/grantAccess", async (req, res) => {
  try {
    const { evidenceId, owner, grantee } = req.body;
    await evidenceContract.methods
      .grantAccess(evidenceId, grantee)
      .send({ from: owner, gas: 300000 });
    res.json({ success: true, message: `Access granted to ${grantee}` });
  } catch (error) {
    res
      .status(500)
      .json({
        success: false,
        message: "Failed to grant access",
        error: error.message,
      });
  }
});

app.post("/revokeAccess", async (req, res) => {
  try {
    const { evidenceId, owner, target } = req.body;
    await evidenceContract.methods
      .revokeAccess(evidenceId, target)
      .send({ from: owner, gas: 300000 });
    res.json({ success: true, message: `Access revoked from ${target}` });
  } catch (error) {
    res
      .status(500)
      .json({
        success: false,
        message: "Failed to revoke access",
        error: error.message,
      });
  }
});

app.get("/user/:address/evidence", async (req, res) => {
  try {
    const { address } = req.params;
    const ids = await evidenceContract.methods
      .getAccessibleEvidenceIds(address)
      .call();

    const results = [];
    for (const id of ids) {
      try {
        const evidence = await evidenceContract.methods
          .getEvidence(id)
          .call({ from: address });
        results.push({ id, ...evidence });
      } catch (err) {
        continue;
      }
    }

    res.json({ success: true, accessibleEvidence: results });
  } catch (error) {
    res
      .status(500)
      .json({
        success: false,
        message: "Error fetching user evidence",
        error: error.message,
      });
  }
});

// ========================== SERVER START ==========================

app.listen(3000, () => {
  console.log("🚀 Server started on http://localhost:3000");
});

web3.eth.getAccounts().then((accounts) => {
  console.log("🧾 Available Ganache Accounts:");
  accounts.forEach((acc, i) => console.log(`${i + 1}: ${acc}`));
});
