const { Player } = require("../classes/player");
const data = require("../utils/data");

module.exports = {
    name: "player",
    async add({ socket }, game) {
        try {
            if (game.players.length >= game.maxPlayers) return { success: false, text: "Game Full" };

            const player = new Player(socket.id);
            if (game.players.includes(player)) return { success: false, text: "Already Joined" };
            if (game.players.length == 1) player.admin = true;

            game.players.push(player);

            if (game.players.length == game.maxPlayers) game.canJoin = false;

            socket.player = player;
            game.io.to(socket.id).emit("data", { user: player });
            setTimeout(() => {
                data.sendRoom({ game: true }, game);
            }, 100);

            return { game, success: true };
        } catch (err) {
            console.error("Error in add player execution:", err);
            return null;
        }
    },

    remove({id}, game) {
        const user = game.players.find((player) => player.id === id);
        game.players = game.players.filter((player) => player !== user);
        if(user?.isAI)
        game.ai = game.ai.filter((player) => player !== user);

        user.canWrite = false;
        // game.io.to(user.id).emit("data", { user: user });
        data.sendRoom({ game: true, players: game.status == "started" }, game);

        return { success: true };
    },

    get({id}, game) {
        if(!game.players) return null;
        return game.players.find((player) => player.id === id);
    },

    generateId(){
        return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    }
};
