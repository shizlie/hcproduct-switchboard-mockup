require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { createClient } = require("@supabase/supabase-js");
const app = express();

app.use(cors());
app.use(express.json());

// API Usage routes (public, uses API key)
app.use(
    "/v1/api/use",
    require("./routes/apiUsage")
);

//TODO: Add API Management routes

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));