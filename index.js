require("dotenv").config();

const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const OpenAI = require("openai");

const app = express();
app.use(bodyParser.json());
app.use(cors()); // Consider restricting this to your Bubble domain for security

// Initialize OpenAI client with the API key from environment variables
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// SSE Endpoint
app.post("/stream", async (req, res) => {
  try {
    const { messages } = req.body;

    // Set headers for Server-Sent Events (SSE)
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    // Call OpenAI with streaming enabled
    const stream = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: messages,
      stream: true,
    });

    // Stream the response data
    for await (const part of stream) {
      const text = part.choices[0]?.delta?.content || "";
      res.write(`event: chunk\ndata: ${JSON.stringify({ text })}\n\n`);
    }

    // Indicate the end of the stream
    res.write(`event: done\ndata: [DONE]\n\n`);
    res.end();
  } catch (error) {
    console.error("Request Error:", error);
    res.status(500).send(error?.message || "Something went wrong");
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
