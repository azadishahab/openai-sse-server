// index.js
require("dotenv").config();


const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const { Configuration, OpenAIApi } = require("openai");

const app = express();
app.use(bodyParser.json());
app.use(cors()); // Possibly restricted to your Bubble domain for security

// Store your OpenAI API key as an environment variable.
const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});
const openai = new OpenAIApi(configuration);

// SSE Endpoint
app.post("/stream", async (req, res) => {
  try {
    // For example, the prompt or chat messages come in from the body
    const { messages } = req.body;

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    // Make the call to OpenAI with stream enabled
    const completion = await openai.createChatCompletion(
      {
        model: "gpt-3.5-turbo",
        messages: messages,
        stream: true,
      },
      { responseType: "stream" }
    );

    completion.data.on("data", (chunk) => {
      const payloads = chunk
        .toString()
        .split("\n")
        .filter((line) => line.trim() !== "" && line.includes("data:"));

      for (const payload of payloads) {
        const data = payload.replace(/^data: /, "");
        if (data === "[DONE]") {
          // Let the client know we're done
          res.write(`event: done\ndata: [DONE]\n\n`);
          res.end();
          return;
        }
        try {
          const parsed = JSON.parse(data);
          const text = parsed.choices?.[0]?.delta?.content || "";
          // Send the text chunk as an SSE event
          res.write(`event: chunk\ndata: ${JSON.stringify({ text })}\n\n`);
        } catch (error) {
          console.error("JSON parse error:", error, data);
        }
      }
    });

    // In case of error
    completion.data.on("error", (err) => {
      console.error("OpenAI Stream Error:", err);
      res.write(`event: error\ndata: ${JSON.stringify(err?.message)}\n\n`);
      res.end();
    });
  } catch (error) {
    console.error("Request Error:", error);
    res.status(500).send(error?.message || "Something went wrong");
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
