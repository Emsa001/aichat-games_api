const socketIo = require("socket.io");

let io;
function init(server) {
    io = socketIo(server);
}

function getIO() {
    if (!io) {
        throw new Error("Socket.io not initialized");
    }
    return io;
}

module.exports = { init, getIO };