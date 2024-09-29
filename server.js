const express = require("express");
const multer = require("multer");
const axios = require("axios");
const cors = require("cors");
const fs = require("fs");
const FormData = require("form-data");
const Web3 = require("web3").default;
const contractABI = require("./EvidenceABI.json");
const contractAddress = "0x735A49928A5356E86231B2c0b864E3FA9eaF8528"; // Your deployed contract address
require("dotenv").config();

const app = express();
app.use(cors({ origin: "http://localhost:5173" }));
const upload = multer({ dest: "uploads/" });

const PINATA_API_KEY = process.env.PINATA_API_KEY;
const PINATA_SECRET_API_KEY = process.env.PINATA_SECRET_API_KEY;
const web3 = new Web3("http://localhost:7545"); // Ganache provider
const evidenceContract = new web3.eth.Contract(contractABI, contractAddress); // Contract instance

const saveMetadata = (metadata) => {
  let existingData = [];
  const metadataFilePath = "./metadata.json";
  if (fs.existsSync(metadataFilePath)) {
    existingData = JSON.parse(fs.readFileSync(metadataFilePath, "utf-8"));
  }
  existingData.push(metadata);
  fs.writeFileSync(metadataFilePath, JSON.stringify(existingData, null, 2));
};

// Upload Evidence
app.post("/upload", upload.single("file"), async (req, res) => {
  const file = req.file;
  const ownerMetaMaskId = req.body.owner; // Get the owner's MetaMask ID from the request body
  const fileName = req.body.fileName; // Get the file name from the request body
  const fileDescription = req.body.fileDescription; // Get the file description from the request body
  const hash = "akljdfadf"; // If you want to include hash
  const password = "kjhaksdhfajklhdf"; // If you want to include password

  if (!file || !ownerMetaMaskId || !fileName || !fileDescription) {
    return res
      .status(400)
      .send("Missing file, owner ID, file name, or description.");
  }

  try {
    const data = new FormData();
    data.append("file", fs.createReadStream(file.path));

    const metadata = JSON.stringify({ name: file.originalname });
    data.append("pinataMetadata", metadata);

    const pinataOptions = JSON.stringify({ cidVersion: 0 });
    data.append("pinataOptions", pinataOptions);

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

    // Save evidence to the blockchain using the provided owner's MetaMask ID
    // Get available accounts in Ganache
    const accounts = await web3.eth.getAccounts();
    const senderAddress = accounts[0]; // Use a default Ganache account or ensure MetaMask ID is valid

    await evidenceContract.methods
      .addEvidence(
        response.data.IpfsHash,
        fileName,
        file.mimetype,
        hash,
        password,
        fileDescription,
        ownerMetaMaskId
      )
      .send({ from: senderAddress, gas: 5000000 }); // Use the valid Ganache account

    const evidence = {
      cid: response.data.IpfsHash,
      originalName: file.originalname,
      mimeType: file.mimetype,
      timestamp: new Date().toISOString(),
      owner: ownerMetaMaskId, // Store owner's MetaMask ID
      description: fileDescription, // Store the file description
      name: fileName, // Optionally include file name
      // Optionally include hash and password
    };

    saveMetadata(evidence);
    fs.unlinkSync(file.path); // Remove the file from the uploads folder

    res.json({
      success: true,
      ipfsHash: response.data.IpfsHash,
      pinSize: response.data.PinSize,
      timestamp: response.data.Timestamp,
    });
  } catch (error) {
    console.error("Error in /upload:", error); // Log the error for debugging
    res.status(500).json({ success: false, message: error.message });
  }
});

// Retrieve All Evidence
app.get("/evidence", async (req, res) => {
  try {
    const metadataFilePath = "./metadata.json";
    let evidenceRecords = [];

    if (fs.existsSync(metadataFilePath)) {
      evidenceRecords = JSON.parse(fs.readFileSync(metadataFilePath, "utf-8"));
    }

    res.json({
      success: true,
      data: evidenceRecords,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Search Evidence by CID
app.get("/evidence/search/:cid", async (req, res) => {
  const { cid } = req.params;

  try {
    const metadataFilePath = "./metadata.json";
    let evidenceRecords = [];

    if (fs.existsSync(metadataFilePath)) {
      evidenceRecords = JSON.parse(fs.readFileSync(metadataFilePath, "utf-8"));
    }

    const filteredRecords = evidenceRecords.filter(
      (record) => record.cid === cid
    );

    res.json({
      success: true,
      data: filteredRecords,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.get("/retrieve-file/:cid", async (req, res) => {
  const cid = req.params.cid;

  try {
    // Read the metadata file to find the original name and MIME type
    const metadataFilePath = "./metadata.json";
    let evidenceRecords = [];

    if (fs.existsSync(metadataFilePath)) {
      evidenceRecords = JSON.parse(fs.readFileSync(metadataFilePath, "utf-8"));
    }

    // Find the evidence by CID
    const evidence = evidenceRecords.find((item) => item.cid === cid);

    if (!evidence) {
      return res
        .status(404)
        .json({ success: false, message: "File not found in metadata." });
    }

    const { originalName, mimeType } = evidence; // Get original name and MIME type

    // Download the file from IPFS
    const url = `https://gateway.pinata.cloud/ipfs/${cid}`;
    const response = await axios({
      method: "GET",
      url: url,
      responseType: "stream",
    });

    // Set the correct headers for file download
    res.set("Content-Type", mimeType || "application/octet-stream");
    res.set(
      "Content-Disposition",
      `attachment; filename="${originalName || cid}"`
    );

    // Pipe the file data to the response
    response.data.pipe(res);
  } catch (error) {
    console.error("Error retrieving file:", error);
    res
      .status(500)
      .json({ success: false, message: "Error retrieving the file from IPFS" });
  }
});

app.listen(3000, () => {
  console.log("Server started on port 3000");
});
