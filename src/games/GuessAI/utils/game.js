const { Users, Messages, Games } = require("@/database/connection");
const { getIO } = require("./sockets");

const closeRoom = async (socket) => {
    const { roomId } = socket;
    const io = getIO();
    if (roomId) {
        await Messages.destroy({ where: { roomId: roomId } });
        await Games.destroy({ where: { roomId: roomId } });
        io.to(roomId).emit("end");
        return true;
    }
    return false;
}

const updateUsers = async (socket, users) => {
    const { roomId } = socket;
    const io = getIO();
    if (!users)
        users = await Users.findAll({ where: { roomId } });
    io.to(roomId).emit("userList", { chatUsernames: users.map((item) => item.username)});
}

const kickUser = async (socket, userId) =>{
    const { roomId } = socket;
    const io = getIO();
    if (roomId && userId) {
        socket.leave(userId);
        await Users.destroy({ where: { userId } });
        
        const AllUsers = await Users.findAll({ where: { roomId } });
        if (AllUsers.length === 0)
            return closeRoom(socket);

        return true;
    }
    return false;
}

module.exports = { closeRoom, kickUser, updateUsers };
