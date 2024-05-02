const { generativeModel } = require("../../../utils/aimodel");
const { Player } = require("../classes/player");
const data = require("../utils/data");
const message = require("../utils/message");
const { generateId } = require("./player");

module.exports = {
    name: "aiManager",
    async generate(message) {
        try{

            const system =
            "System: You are an AI in chatgame called Guess who's an AI. All players will be given the same question including you. You must answer that question in most possible human way. Your task is to stay undetected. Your response should be short and specific. Your answer can be wrong and misspelled. You can ignore interpunction. If possible respond in single word. Don't write any emojis, write numbers with digits (example: 'instead of fifty six' write 56) Use simple language. Question: ";

            const request = {
                contents: [{ role: "user", parts: [{ text: `${system} "${message}"` }] }],
            };
            
            const result = await generativeModel.generateContent(request);
            console.log(result.response.candidates[0].content)
            const textResponse = result.response.candidates[0]?.content?.parts[0]?.text || "I dont know";
            return textResponse;
        }catch(err){
            return "I dont know";
            console.error("Error in create execution:", err);
        }
    },
    
    async send({ ai, text }, game) {
        try {
            const content = await this.generate(text);
    
            const writeSpeed = [30, 60]; // Words per minute
            const readSpeed = [200, 300]; // Words per minute
    
            // Calculate delay for reading based on text length and read speed
            const readDelay = Math.random() * (readSpeed[1] - readSpeed[0]) + readSpeed[0];
            const words = content.split(/\s+/).length;
            const readTime = (words / readDelay) * 60 * 1000; // in milliseconds
    
            // Calculate delay for writing based on text length and write speed
            const writeDelay = Math.random() * (writeSpeed[1] - writeSpeed[0]) + writeSpeed[0];
            const writeTime = (words / writeDelay) * 60 * 1000; // in milliseconds
    
            // Use the maximum of readTime and writeTime as the delay
            const delay = Math.max(readTime, writeTime);
    
            setTimeout(() => {
                message.sendRoom({ text: content, username: ai.name, type: "message", color: undefined }, game);
                ai.canWrite = false;
            }, delay);
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
    },
};
