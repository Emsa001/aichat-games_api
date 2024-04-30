const ai = require("./ai");

module.exports = {
    name: "create",
    async room(game) {
        try {
            game.addAI();
            ai.generate({ ai: game.ai, text: "write a single word: Hi" }).then((response) => {
                console.log(`AI test response: ${response}`);
            });
        } catch (err) {
            console.error("Error in create execution:", err);
        }
    },
    async player({socket}, manager) {
        try {
            // if (this.players.length >= this.maxPlayers) return { success: false, text: "Game Full" };

            // const player = new Player(socket.id);
            // if (this.players.includes(player)) return { success: false, text: "Already Joined" };
            // if(this.players.length == 1) player.admin = true;

            // this.players.push(player);

            // if (this.players.length == this.maxPlayers) this.canJoin = false;

            // socket.player = player;
            // this.io.to(socket.id).emit("data", { user: player });
            // setTimeout(() => {
            //     sendData.room({ game: true }, this);
            // }, 100);

            // return { game: this, success: true };
        } catch (err) {
            console.error("Error in player execution:", err);
        }
    },
};
