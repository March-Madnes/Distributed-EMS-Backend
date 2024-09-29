const express = require("express");
const multer = require("multer");
const axios = require("axios");
const cors = require("cors"); // Import CORS
const fs = require("fs");
const FormData = require("form-data");
require("dotenv").config();

const app = express(); // Define the app first

// Use CORS middleware
app.use(
  cors({
    origin: "http://localhost:5173", // Allow requests from your React app
  })
);

const upload = multer({ dest: "uploads/" });

const PINATA_API_KEY = process.env.PINATA_API_KEY;
const PINATA_SECRET_API_KEY = process.env.PINATA_SECRET_API_KEY;

const metadataFilePath = './metadata.json'; // Path to store metadata

// Helper function to store metadata
const saveMetadata = (metadata) => {
    let existingData = [];
    if (fs.existsSync(metadataFilePath)) {
        existingData = JSON.parse(fs.readFileSync(metadataFilePath, 'utf-8'));
    }
    existingData.push(metadata);
    fs.writeFileSync(metadataFilePath, JSON.stringify(existingData, null, 2));
};

// Helper function to get metadata by CID
const getMetadataByCid = (cid) => {
    if (fs.existsSync(metadataFilePath)) {
        const metadataList = JSON.parse(fs.readFileSync(metadataFilePath, 'utf-8'));
        return metadataList.find(meta => meta.cid === cid);
    }
    return null;
};

// Endpoint to upload a file to IPFS
app.post('/upload', upload.single('file'), async (req, res) => {
    const file = req.file;

  if (!file) {
    return res.status(400).send("No file uploaded.");
  }

  try {
    const data = new FormData();
    data.append("file", fs.createReadStream(file.path));

    const metadata = JSON.stringify({
      name: file.originalname,
    });
    data.append("pinataMetadata", metadata);

    const pinataOptions = JSON.stringify({
      cidVersion: 0,
    });
    data.append("pinataOptions", pinataOptions);

    const response = await axios.post(
      "https://api.pinata.cloud/pinning/pinFileToIPFS",
      data,
      {
        maxBodyLength: "Infinity", // This is needed for large files
        headers: {
          "Content-Type": `multipart/form-data; boundary=${data._boundary}`,
          pinata_api_key: PINATA_API_KEY,
          pinata_secret_api_key: PINATA_SECRET_API_KEY,
        },
      }
    );

        // Save metadata including CID, original file name, and MIME type
        saveMetadata({
            cid: response.data.IpfsHash,
            originalName: file.originalname,
            mimeType: file.mimetype,
        });

        // Remove the file from the uploads folder
        fs.unlinkSync(file.path);

    res.json({
      success: true,
      ipfsHash: response.data.IpfsHash,
      pinSize: response.data.PinSize,
      timestamp: response.data.Timestamp,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Endpoint to retrieve a file from IPFS using its CID and download it with the original file name and format
app.get('/retrieve-file/:cid', async (req, res) => {
    const cid = req.params.cid;

    // Retrieve metadata by CID
    const metadata = getMetadataByCid(cid);

    if (!metadata) {
        return res.status(404).json({ success: false, message: 'File metadata not found' });
    }

    try {
        // Construct the IPFS URL with the CID
        const url = `https://gateway.pinata.cloud/ipfs/${cid}`;

        // Make an HTTP GET request to the IPFS gateway
        const response = await axios({
            method: 'GET',
            url: url,
            responseType: 'stream' // Ensure that the response is a stream
        });

        // Set the response headers to download the file with the original name and type
        res.set({
            'Content-Type': metadata.mimeType,
            'Content-Disposition': `attachment; filename="${metadata.originalName}"`,
        });

        // Pipe the file data to the response
        response.data.pipe(res);

    } catch (error) {
        console.error('Error retrieving file from IPFS:', error);
        res.status(500).json({ success: false, message: 'Error retrieving the file from IPFS' });
    }
});

// Start the server
app.listen(3000, () => {
  console.log("Server started on port 3000");
});
