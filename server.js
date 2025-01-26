const express = require("express");
const multer = require("multer");
const axios = require("axios");
const cors = require("cors");
const fs = require("fs");
const FormData = require("form-data");
const Web3 = require("web3").default;
const contractABI = require("./EvidenceABI.json");
const contractAddress = "0x8c5c75E3124C66Bb25fb809f5219ad2a5656ADC7"; // Your deployed contract address
require("dotenv").config();

const app = express();
app.use(cors({ origin: "http://localhost:5173" }));
const upload = multer({ dest: "uploads/" });

const PINATA_API_KEY = process.env.PINATA_API_KEY;
const PINATA_SECRET_API_KEY = process.env.PINATA_SECRET_API_KEY;
const web3 = new Web3("http://127.0.0.1:7545"); // Ganache provider
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
  const hash = "akljdfadf"; // Optional hash (you may want to calculate the real hash of the file)
  const password = "kjhaksdhfajklhdf"; // Optional password

  // Validate request
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

    // Upload the file to IPFS using Pinata
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
    const accounts = await web3.eth.getAccounts();
    const senderAddress = accounts[0]; // Use a default Ganache account or ensure MetaMask ID is valid

    await evidenceContract.methods
      .addEvidence(
        response.data.IpfsHash, // _cid: IPFS hash
        file.originalname, // _originalName: Original file name
        file.mimetype, // _mimeType: File type
        hash, // _hash: Optional hash
        password, // _password: Optional password
        fileName, // _name: Custom file name
        fileDescription, // _description: File description
        ownerMetaMaskId // _owner: Owner's MetaMask ID
      )
      .send({ from: senderAddress, gas: 5000000 }); // Use the valid Ganache account

    fs.unlinkSync(file.path); // Remove the file from the uploads folder

    // Send a successful response
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

app.get("/evidence", async (req, res) => {
  try {
    console.log("Fetching evidence count from contract...");

    // Fetch evidence count from the contract
    const evidenceCount = await evidenceContract.methods
      .getEvidenceCount()
      .call();
    console.log("Total evidence count:", evidenceCount);

    if (evidenceCount == 0) {
      return res.json({ success: true, data: [] });
    }

    let evidenceRecords = [];

    for (let i = 0; i < evidenceCount; i++) {
      console.log(`Fetching evidence record at index ${i}...`);

      // Fetch each evidence record using the getEvidence function from the contract
      const evidenceRecord = await evidenceContract.methods
        .getEvidence(i)
        .call();

      evidenceRecords.push({
        cid: evidenceRecord.cid,
        originalName: evidenceRecord.originalName,
        mimeType: evidenceRecord.mimeType,
        hash: evidenceRecord.hash,
        password: evidenceRecord.password,
        timestamp: new Date(
          parseInt(evidenceRecord.timestamp) * 1000
        ).toISOString(), // Convert timestamp to ISO format
        name: evidenceRecord.name,
        description: evidenceRecord.description,
        owner: evidenceRecord.owner,
      });
    }

    console.log("Successfully fetched evidence records:", evidenceRecords);
    res.json({
      success: true,
      data: evidenceRecords,
    });
  } catch (error) {
    console.error("Error fetching evidence from blockchain:", error.message);
    res
      .status(500)
      .json({ success: false, message: "Error fetching evidence." });
  }
});

// Search Evidence by CID
app.get("/evidence/search/:cid", async (req, res) => {
  const { cid } = req.params;

  try {
    // Fetch the total number of evidence records from the contract
    const evidenceCount = await evidenceContract.methods
      .getEvidenceCount()
      .call();

    if (evidenceCount == 0) {
      return res
        .status(404)
        .json({ success: false, message: "No evidence found." });
    }

    let foundEvidence = null;

    // Loop through all the evidence records to find the one with the matching CID
    for (let i = 0; i < evidenceCount; i++) {
      const evidenceRecord = await evidenceContract.methods
        .getEvidence(i)
        .call();

      if (evidenceRecord.cid === cid) {
        foundEvidence = {
          cid: evidenceRecord.cid,
          originalName: evidenceRecord.originalName,
          mimeType: evidenceRecord.mimeType,
          hash: evidenceRecord.hash,
          password: evidenceRecord.password,
          timestamp: new Date(
            parseInt(evidenceRecord.timestamp) * 1000
          ).toISOString(), // Convert timestamp to ISO format
          name: evidenceRecord.name,
          description: evidenceRecord.description,
          owner: evidenceRecord.owner,
        };
        break; // Stop searching once the matching evidence is found
      }
    }

    if (foundEvidence) {
      res.json({
        success: true,
        data: foundEvidence,
      });
    } else {
      res.status(404).json({ success: false, message: "Evidence not found." });
    }
  } catch (error) {
    console.error("Error searching for evidence:", error.message);
    res
      .status(500)
      .json({ success: false, message: "Error searching for evidence." });
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
