const player = require("../functions/player");
const data = require("./data");

module.exports = {
    name: "message",

    async sendRoom(data, game) {
        try {
            game.io.to(game.id).emit("message", data);
        } catch (err) {
            console.error("Error in message execution:", err);
            return null;
        }
    },

    async recieve({ socket, text }, game) {
        const user = player.get({ id: socket.id }, game);
        if (!user || !user.canWrite) return { success: false, text: "Not your turn" };

        user.canWrite = false;
        this.sendRoom({ text: text, username: user.name, type: "message", color: undefined }, game);
        data.sendUser({ player: user }, game);
        return { success: true };
    },

    async timer({ time }, game) {
        try {
            game.io.to(game.id).emit("timer", { time: time });
        } catch (err) {
            console.error("Error in timer execution:", err);
            return null;
        }
    },

    sendUser({player, data}, game) {
        try{
            game.io.to(player.id).emit("message", data);
        }
        catch(err){
            console.error("Error in sendUser execution:", err);
            return null;
        }
    },

};
