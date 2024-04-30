const { shuffle } = require("../../../utils/general");

module.exports = {
    name: "data",
    async game(game) {
        try {
            return {
                id: game.id,
                name: game.name,
                description: game.description,
                color: game.color,
    
                players: game.players.length,
                minPlayers: game.minPlayers,
                maxPlayers: game.maxPlayers,
    
                status: game.status,
                round: game.round,
                canJoin: game.canJoin,
                canVote: game.canVote,
    
                startTime: game.startTime,
            };
        } catch (err) {
            console.error("Error in formData execution:", err);
            return null;
        }
    },
    
    async sendRoom({ game, players }, manager) {
        try {
            const data = {};

            if (game) data.game = await this.game(manager);
            if (players){
                data.players = manager.players
                shuffle(data.players);
            };


            manager.io.to(manager.id).emit("data", data);
        } catch (err) {
            console.error("Error in sendData execution:", err);
        }
    },

    async sendUser({player}, manager) {
        try {
            // player.socket.emit("data", { user: player });
            manager.io.to(player.id).emit("data", { user: player });
        } catch (err) {
            console.error("Error in sendUser execution:", err);
        }
    }
};
