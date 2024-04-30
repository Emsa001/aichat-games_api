module.exports = {
    name: "sendData",
    async room({ game, players }, manager) {
        try {
            const data = {};

            if (game) data.game = await manager.formatData();
            if (players) data.players = manager.players;

            manager.io.to(manager.id).emit("data", data);
        } catch (err) {
            console.error("Error in sendData execution:", err);
        }
    },
};
