const { VertexAI } = require("@google-cloud/vertexai");

const vertex_ai = new VertexAI({ project: "excellent-shard-418510", location: "europe-west3" });
const model = "gemini-1.5-pro-preview-0409";

const generativeModel = vertex_ai.preview.getGenerativeModel({
    model: model,
    generationConfig: {
        maxOutputTokens: 256,
        temperature: 1,
        topP: 0.95,
    },
    safetySettings: [
        {
            category: "HARM_CATEGORY_HATE_SPEECH",
            threshold: "BLOCK_ONLY_HIGH",
        },
        {
            category: "HARM_CATEGORY_DANGEROUS_CONTENT",
            threshold: "BLOCK_ONLY_HIGH",
        },
        {
            category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
            threshold: "BLOCK_ONLY_HIGH",
        },
        {
            category: "HARM_CATEGORY_HARASSMENT",
            threshold: "BLOCK_ONLY_HIGH",
        },
    ],
});

module.exports = { generativeModel }; 