const express = require('express');
const multer = require('multer');
const axios = require('axios');
const fs = require('fs');
const FormData = require('form-data');
require("dotenv").config();

const app = express();
const upload = multer({ dest: 'uploads/' });

const PINATA_API_KEY = process.env.PINATA_API_KEY;
const PINATA_SECRET_API_KEY = process.env.PINATA_SECRET_API_KEY;

// const axios = require('axios');
// const FormData = require('form-data');
// const fs = require('fs');
// let data = new FormData();
// data.append('file', fs.createReadStream('/C:/Users/Jogeshwari/Desktop/sem6/ai/AI decode.pdf'));

// let config = {
//   method: 'post',
//   maxBodyLength: Infinity,
//   url: 'http://localhost:3000/upload',
//   headers: { 
//     'Content-Type': 'multipart/form-data', 
//     ...data.getHeaders()
//   },
//   data : data
// };

// axios.request(config)
// .then((response) => {
//   console.log(JSON.stringify(response.data));
// })
// .catch((error) => {
//   console.log(error);
// });

app.post('/upload', upload.single('file'), async (req, res) => {
    const file = req.file;

    if (!file) {
        return res.status(400).send('No file uploaded.');
    }

    try {
        const data = new FormData();
        data.append('file', fs.createReadStream(file.path));

        const metadata = JSON.stringify({
            name: file.originalname,
        });
        data.append('pinataMetadata', metadata);

        const pinataOptions = JSON.stringify({
            cidVersion: 0,
        });
        data.append('pinataOptions', pinataOptions);

        const response = await axios.post('https://api.pinata.cloud/pinning/pinFileToIPFS', data, {
            maxBodyLength: 'Infinity', // This is needed for large files
            headers: {
                'Content-Type': `multipart/form-data; boundary=${data._boundary}`,
                'pinata_api_key': PINATA_API_KEY,
                'pinata_secret_api_key': PINATA_SECRET_API_KEY,
            },
        });

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

// Start the server
app.listen(3000, () => {
    console.log('Server started on port 3000');
});
