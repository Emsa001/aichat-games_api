const { VertexAI } = require("@google-cloud/vertexai");
const { Player } = require("../classes/player");
const sendData = require("./sendData");

// Initialize Vertex with your Cloud project and location
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


module.exports = {
    name: "aiManager",
    async generate(message){
        const system = "System: You are an AI in chatgame called Guess who's an AI. All players will be given the same question including you, and you must answer that question in most possible human way. Your task is to stay undetected. Your response should be short and very specific. You can say that you do not know the answer. If it's possible answer using just single word. If question is hard you can answer that you don't know Avoid writing 'I think' and etc. You can ignore interpunction. Sometimes you can add extra letters, like 'pythonn' Use simple language. Question: ";

        const request = {
            contents: [{role: 'user', parts: [{text: `${system} "${message}"`}]}],
        };

        const result = await generativeModel.generateContent(request);
        return result.response.candidates[0].content.parts[0].text;
    },
    async send({ai, text}, game) {
        try {
            const message = await this.generate(text);

            const delay = Math.random() * (100 - 40) + 40;
            setTimeout(() => {
                game.sendMessage({ text: message, username: ai.name, type: "message", color: undefined });
                ai.canWrite = false;
            }, delay * 100);
        } catch (err) {
            console.error("Error in create execution:", err);
        }
    },
    async addAI(game) {
        try {
            const AI = new Player(generateId());
            AI.setAI();
    
            game.players.push(AI);
            game.ai.push(AI);
            sendData.room({ game: true }, game);
            return { success: true };
        } catch (err) {
            console.error("Error in create execution:", err);
        }
    }
};
