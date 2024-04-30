const { generativeModel } = require("../../../utils/aimodel");
const { Player } = require("../classes/player");
const data = require("../utils/data");
const message = require("../utils/message");
const { generateId } = require("./player");

module.exports = {
    name: "aiManager",
    async generate(message){
        const system = "System: You are an AI in chatgame called Guess who's an AI. All players will be given the same question including you, and you must answer that question in most possible human way. Your task is to stay undetected. Your response should be short and very specific. You can say that you do not know the answer. If it's possible answer using just single word. Your answerts may not be true. You can ignore interpunction. Sometimes you can add extra letters, like 'pythonn' Use simple language. Question: ";

        const request = {
            contents: [{role: 'user', parts: [{text: `${system} "${message}"`}]}],
        };

        const result = await generativeModel.generateContent(request);
        const textResponse = result.response.candidates[0]?.content?.parts[0]?.text || "I dont know";
        return textResponse;
    },
    async send({ai, text}, game) {
        try {
            const content = await this.generate(text);

            const delay = Math.random() * (100 - 40) + 40;
            setTimeout(() => {
                message.sendRoom({ text:content, username: ai.name, type: "message", color: undefined }, game);
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
            data.sendRoom({ game: true }, game);
            return { success: true };
        } catch (err) {
            console.error("Error in create execution:", err);
        }
    }
};
