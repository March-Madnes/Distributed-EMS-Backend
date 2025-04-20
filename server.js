const express = require("express");
const connectDB = require("./config/db");
const cors = require("cors");
const Web3 = require("web3").default;

require("dotenv").config();

const app = express();

const web3 = new Web3("http://127.0.0.1:7545");
app.use(cors({ origin: "http://localhost:5173" }));
app.use(express.json());

connectDB();

const swaggerJsDoc = require("swagger-jsdoc");
const swaggerUi = require("swagger-ui-express");

const swaggerOptions = {
  swaggerDefinition: {
    openapi: "3.0.0",
    info: {
      title: "Evidence Management API",
      version: "1.0.0",
      description: "Auto-generated documentation of your Express API",
    },
    servers: [
      {
        url: "http://localhost:3000",
      },
    ],
  },
  apis: ["./server.js"], // or whatever your filename is
};

const swaggerDocs = swaggerJsDoc(swaggerOptions);
const caseRoutes = require("./routes/Cases");
const blockRoutes = require("./routes/BlockComs");

app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerDocs));
app.use(blockRoutes);
app.use(caseRoutes);

// ========================== SERVER START ==========================

app.listen(3000, () => {
  console.log("🚀 Server started on http://localhost:3000");
});

web3.eth.getAccounts().then((accounts) => {
  console.log("🧾 Available Ganache Accounts:");
  accounts.forEach((acc, i) => console.log(`${i + 1}: ${acc}`));
});
