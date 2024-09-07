require("dotenv").config();
const express = require("express");
const cors = require("cors");
const app = express();

app.use(cors());
app.use(express.json());

// API Usage routes (public, uses API key)
app.use(
    "/v1/api/use",
    require("./routes/apiUsage")
);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));