const express = require('express');
const router = express.Router();

require("dotenv").config();

router.get("/test", async (req, res) => {
    try {
      
        res.json({ message: "File uploaded!", result });
    } catch (error) {
        res.status(500).send("Error uploading file");
    }
});

module.exports = router;
