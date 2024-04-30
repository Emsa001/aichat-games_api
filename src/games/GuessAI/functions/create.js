const ai = require("./ai");

module.exports = {
    name: "create",

    constructor(game) {
        this.game = game;
    },

    async room() {
        try {
            this.game.addAI();
        } catch (err) {
            console.error("Error in create execution:", err);
        }
    }
};
