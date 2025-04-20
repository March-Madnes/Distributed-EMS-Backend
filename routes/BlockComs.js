const express = require("express");
const router = express.Router();

const Case = require("../models/Case");
const EvidenceMeta = require("../models/EvidenceMeta");

const multer = require("multer");
const upload = multer({ dest: "uploads/" });
const axios = require("axios");
const fs = require("fs");
const FormData = require("form-data");
const Web3 = require("web3").default;
const contractABI = require("../EvidenceABI.json");
require("dotenv").config();

const PINATA_API_KEY = process.env.PINATA_API_KEY;
const PINATA_SECRET_API_KEY = process.env.PINATA_SECRET_API_KEY;
const CONTRACT_ADDRESS = "0xbcbd3814bA874b3bF8A169dAD199193A8Da46415";
const ADMIN_ADDRESS = "0x89a21195cE6ff7611fF5F8A02C3550F851CeD912";

const web3 = new Web3("http://127.0.0.1:7545");
const evidenceContract = new web3.eth.Contract(contractABI, CONTRACT_ADDRESS);

// ========================== ROLE MANAGEMENT ==========================

// const isInvestigator = async (address) => {
//   try {
//     const role = await evidenceContract.methods.getUserRole(address).call();
//     return role === "1";
//   } catch (error) {
//     console.error("❌ Error checking role:", error.message);
//     return false;
//   }
// };

// const assignInvestigatorRole = async (address) => {
//   try {
//     await evidenceContract.methods
//       .assignRole(address, 1)
//       .send({ from: ADMIN_ADDRESS, gas: 500000 });
//     console.log(`✅ Assigned Investigator Role to ${address}`);
//   } catch (error) {
//     console.error("❌ Error assigning Investigator role:", error.message);
//   }
// };

/**
 * @swagger
 * /test/role/{address}:
 *   get:
 *     summary: Get user role by wallet address
 *     tags: [Roles]
 *     parameters:
 *       - in: path
 *         name: address
 *         required: true
 *         schema:
 *           type: string
 *         description: Ethereum wallet address
 *     responses:
 *       200:
 *         description: User role fetched
 */
router.get("/test/role/:address", async (req, res) => {
  try {
    const address = req.params.address;
    const role = await evidenceContract.methods.getUserRole(address).call();
    res.json({ success: true, address, role: role.toString() });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching user role",
      error: error.message,
    });
  }
});

/**
 * @swagger
 * /assignRole:
 *   post:
 *     summary: Assign a role to a wallet address
 *     tags: [Roles]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               address:
 *                 type: string
 *               role:
 *                 type: integer
 *     responses:
 *       200:
 *         description: Role assigned
 */
router.post("/assignRole", async (req, res) => {
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
    res.status(500).json({
      success: false,
      message: "Error assigning role",
      error: error.message,
    });
  }
});

// ========================== EVIDENCE MANAGEMENT ==========================

/**
 * @swagger
 * /upload:
 *   post:
 *     summary: Upload evidence file to IPFS
 *     tags: [Evidence]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *               owner:
 *                 type: string
 *               fileName:
 *                 type: string
 *               fileDescription:
 *                 type: string
 *     responses:
 *       200:
 *         description: File uploaded and added to smart contract
 */
router.post("/upload", upload.single("file"), async (req, res) => {
  try {
    const file = req.file;
    const { owner, fileName, fileDescription } = req.body;

    if (!file || !owner || !fileName || !fileDescription) {
      return res
        .status(400)
        .json({ success: false, message: "Missing required fields." });
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

    const tx = await evidenceContract.methods
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

    const receipt = await web3.eth.getTransactionReceipt(tx.transactionHash);
    const evidenceCount = await evidenceContract.methods
      .getEvidenceCount()
      .call();
    const evidence = await evidenceContract.methods
      .getEvidence(evidenceCount)
      .call();

    await EvidenceMeta.create({
      evidenceId: evidenceCount.toString(),
      cid: response.data.IpfsHash,
      originalName: evidence.originalName,
      mimeType: evidence.mimeType,
      name: evidence.name,
      description: evidence.description,
      owner: evidence.owner,
    });

    res.json({
      success: true,
      message: "Evidence uploaded successfully!",
      transactionHash: receipt.transactionHash,
      blockNumber: Number(receipt.blockNumber), // usually safe
      ipfsHash: response.data.IpfsHash,
      evidenceId: evidenceCount.toString(), // ✅ safe BigInt
      evidence: {
        cid: evidence[0],
        originalName: evidence[1],
        mimeType: evidence[2],
        name: evidence[3],
        description: evidence[4],
        owner: evidence[5],
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error uploading evidence",
      error: error.message,
    });
  }
});

/**
 * @swagger
 * /accessibleEvidence:
 *   get:
 *     summary: Get list of evidences accessible to a user
 *     tags: [Evidence]
 *     parameters:
 *       - in: query
 *         name: viewer
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Accessible evidence list returned
 */
router.get("/accessibleEvidence", async (req, res) => {
  try {
    const address = req.query.viewer?.toString();

    if (!address) {
      return res.status(400).json({
        success: false,
        message: "Missing 'viewer' address in query params",
      });
    }

    const ids = await evidenceContract.methods
      .getAccessibleEvidenceIds(address)
      .call();

    console.log("🔹 Accessible Evidence IDs:", ids);

    const results = [];

    for (const id of ids) {
      try {
        const evidence = await evidenceContract.methods
          .getEvidence(id)
          .call({ from: address });

        results.push({
          id: id.toString(), // Just in case ID is a BigInt
          cid: evidence.cid,
          originalName: evidence.originalName,
          mimeType: evidence.mimeType,
          name: evidence.name,
          description: evidence.description,
          owner: evidence.owner,
          timestamp: evidence.timestamp.toString(), // ✅ BigInt-safe
        });
      } catch (err) {
        continue; // Access denied or other issue
      }
    }

    res.json({
      success: true,
      accessibleEvidence: results,
    });
  } catch (error) {
    console.error("❌ Error fetching accessible evidences:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching user evidence",
      error: error.message,
    });
  }
});

/**
 * @swagger
 * /evidence:
 *   get:
 *     summary: Get all accessible evidences
 *     tags: [Evidence]
 *     parameters:
 *       - in: query
 *         name: viewer
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of all evidence records
 */
router.get("/evidence", async (req, res) => {
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
    res.status(500).json({
      success: false,
      message: "Error fetching evidence",
      error: error.message,
    });
  }
});

/**
 * @swagger
 * /evidence/{id}/{address}:
 *   get:
 *     summary: Get single evidence details by ID and address
 *     tags: [Evidence]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *       - in: path
 *         name: address
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Evidence record returned
 */
router.get("/evidence/:id/:address", async (req, res) => {
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

/**
 * @swagger
 * /evidence/{id}/access/{user}:
 *   get:
 *     summary: Check if a user has access to an evidence
 *     tags: [Access Control]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *       - in: path
 *         name: user
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Access result
 */
router.get("/evidence/:id/access/:user", async (req, res) => {
  try {
    const { id, user } = req.params;
    const accessibleIds = await evidenceContract.methods
      .getAccessibleEvidenceIds(user)
      .call();
    const hasAccess = accessibleIds.includes(id.toString());
    res.json({ success: true, hasAccess });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error checking access",
      error: error.message,
    });
  }
});

/**
 * @swagger
 * /grantAccess:
 *   post:
 *     summary: Grant access to a specific user for an evidence
 *     tags: [Access Control]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               evidenceId:
 *                 type: integer
 *               owner:
 *                 type: string
 *               grantee:
 *                 type: string
 *     responses:
 *       200:
 *         description: Access granted
 */
router.post("/grantAccess", async (req, res) => {
  try {
    const { evidenceId, owner, grantee } = req.body;
    await evidenceContract.methods
      .grantAccess(evidenceId, grantee)
      .send({ from: owner, gas: 300000 });
    res.json({ success: true, message: `Access granted to ${grantee}` });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to grant access",
      error: error.message,
    });
  }
});

/**
 * @swagger
 * /revokeAccess:
 *   post:
 *     summary: Revoke access to an evidence from a user
 *     tags: [Access Control]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               evidenceId:
 *                 type: integer
 *               owner:
 *                 type: string
 *               target:
 *                 type: string
 *     responses:
 *       200:
 *         description: Access revoked
 */
router.post("/revokeAccess", async (req, res) => {
  try {
    const { evidenceId, owner, target } = req.body;
    await evidenceContract.methods
      .revokeAccess(evidenceId, target)
      .send({ from: owner, gas: 300000 });
    res.json({ success: true, message: `Access revoked from ${target}` });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to revoke access",
      error: error.message,
    });
  }
});

/**
 * @swagger
 * /user/{address}/evidence:
 *   get:
 *     summary: Get accessible evidences for a user
 *     tags: [Evidence]
 *     parameters:
 *       - in: path
 *         name: address
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of accessible evidence for user
 */
router.get("/user/:address/evidence", async (req, res) => {
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
    res.status(500).json({
      success: false,
      message: "Error fetching user evidence",
      error: error.message,
    });
  }
});

/**
 * @swagger
 * /accounts:
 *   get:
 *     summary: Get all accounts from the connected Web3 provider
 *     tags: [Blockchain]
 *     responses:
 *       200:
 *         description: List of Ethereum accounts
 */
router.get("/accounts", async (req, res) => {
  try {
    const accounts = await web3.eth.getAccounts();
    res.json({ success: true, accounts });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching accounts",
      error: error.message,
    });
  }
});

/**
 * @swagger
 * /logs/{id}:
 *   get:
 *     summary: Get blockchain event logs for a specific evidence
 *     tags: [Blockchain]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Event logs for the evidence ID
 */
router.get("/logs/:id", async (req, res) => {
  try {
    const evidenceId = req.params.id;
    if (!evidenceId) {
      return res
        .status(400)
        .json({ success: false, message: "Evidence ID is required" });
    }

    const logs = await evidenceContract.getPastEvents("ALLEVENTS", {
      filter: { evidenceId: evidenceId.toString() },
      fromBlock: 0,
      toBlock: "latest",
    });

    if (logs.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No EvidenceAdded event found for this evidenceId.",
      });
    }

    var formatted = [];

    for (let i = 0; i < logs.length; i++) {
      const block = await web3.eth.getBlock(logs[i].blockNumber);
      const timestamp = new Date(
        Number(block.timestamp) * 1000
      ).toLocaleString();

      formatted.push({
        event: logs[i].event,
        timestamp,
        ...(logs[i].returnValues?.user && { user: logs[i].returnValues.user }), // only include if it exists
      });
    }

    res.json({
      success: true,
      events: formatted,
    });
  } catch (error) {
    console.error("❌ Error fetching block logs:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch logs",
      error: error.message,
    });
  }
});

module.exports = router;
