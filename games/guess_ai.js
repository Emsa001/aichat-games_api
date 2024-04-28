const { Games, Messages, Users } = require("../database/connection");

const questions = [
    "Why is the sky blue?",
    "Why is water wet?",
    "What is a pointer?",
    "What's 2+2+2+2+2*2*2+2-2?",
    "Is Pluto a planet?",
    "What was first? The chicken or the egg?",
    "What is the meaning of life?",
    "Why do we dream?",
    "How old is the universe?",
    "I like apples, do you?",
    "Bananas are yellow, right?",
    "Why is the grass green?",
    "Is the grass always greener on the other side?",
    "How do you make a cake?",
];

const getQuestion = (pool) => {
    return pool[Math.floor(Math.random() * pool.length)];
}

const announcement = (time, text, io, socket) => {
    return new Promise((resolve,reject) => {
        try{
            if(!socket.roomId) return reject("Room not found");
            io.to(socket.roomId).emit("setup", { time, title: text });
            setTimeout(() => {
                resolve(true);
            }, time * 1000);
        }catch(e){
            reject(e);
        }
    })
}

// async function showMessages(io, socket){
//     const messages = await Messages.findAll({ where: { roomId: socket.roomId } });
//     console.log(messages.length);
//     messages.forEach((message) => {
//         console.log("sending", message.message);
//         io.to(socket.roomId).emit("othersmessage", { username: message.username, message: message.message });
//     });
// }

const question = (io, socket, time) => {
    return new Promise(async (resolve, reject) => {
        try {
            const game = await Games.findOne({ where: { roomId: socket.roomId } });
            if(!game) return resolve(false);
            io.to(socket.roomId).emit("systemMessage", { time, type: "question", text: getQuestion(questions) });
            await game.update({ canWrite: true });
            setTimeout(async () => {

                const DidNotAnswer = await Users.findAll({ where: { roomId: socket.roomId, answered: false } });

                DidNotAnswer.forEach(async (user) => {
                    io.to(socket.roomId).emit("kick", { username: user.username });
                    socket.leave(user.userId);
                });
                if(DidNotAnswer.length > 0){
                    await Users.destroy({ where: { roomId: socket.roomId, answered: false } });
                    
                    const AllUsers = await Users.findAll({ where: { roomId: socket.roomId } });
                    if (AllUsers.length === 0) {
                        await Messages.destroy({ where: { roomId: socket.roomId } });
                        await Games.destroy({ where: { roomId: socket.roomId } });
                    }else{
                        const chatUsernames = await Users.findAll({ where: { roomId:socket.roomId } });
                        io.to(socket.roomId).emit("userList", { chatUsernames: chatUsernames.map((item) => item.username)});
                    }
                }

                await game.update({ canWrite: false });
                await Messages.destroy({ where: { roomId: socket.roomId, round: game.round } });
                resolve(true);
                await Users.update({ answered: false }, { where: { roomId: socket.roomId } });
            }, time * 1000);
        } catch (e) {
            reject(e);
        }
    });
};

const voteTime = (io, socket, time) => {
    return new Promise(async (resolve, reject) => {
        try {
            const game = await Games.findOne({ where: { roomId: socket.roomId } });
            if(!game) return resolve(false);
            io.to(socket.roomId).emit("start-vote", time);
            io.to(socket.roomId).emit("systemMessage", { text: "Voting has started", type:"info", color: "warning" });
            await game.update({ canVote: true });
            setTimeout(async () => {
                io.to(socket.roomId).emit("end-vote", time);
                await game.update({ canVote: false });

                const toKick = await Users.findOne({
                    order: [['kickVotes', 'DESC']]
                });

                if(toKick.kickVotes > 0){
                    socket.leave(socket.userId);
                    await Users.destroy({ where: { userId: toKick.userId } });
                    await Messages.destroy({ where: { roomId: socket.roomId, username: toKick.username } });
                    io.to(socket.roomId).emit("kick", { username: toKick.username });

                    await Users.update({ voted: false, kickVotes: 0 }, { where: { roomId: socket.roomId } });

                    const chatUsernames = await Users.findAll({ where: { roomId:socket.roomId } });
					io.to(socket.roomId).emit("userList", { chatUsernames: chatUsernames.map((item) => item.username)});
                }else
                    io.to(socket.roomId).emit("systemMessage", { text: "No one was kicked", type: "info", color: "info"});

                resolve(true);
            }, time * 1000);
        } catch (e) {
            reject(e);
        }
    });
}

async function round(io, socket, rnd){
    await announcement(5, `Round ${rnd}`, io, socket);

    await question(io, socket, 42);
    await announcement(5, "New question in", io, socket);
    await question(io, socket, 42);
    await announcement(5, "New question in", io, socket);
    await question(io, socket, 42);
    await announcement(5, "Voting in ", io, socket);
    await voteTime(io, socket, 24);
}


async function GuessAI(io, socket, gameData)
{
    await announcement(10, "Game Starts in", io, socket);

    setTimeout(async () => {
        let rnd = 1;
        while(true){
            const game = await Games.findOne({ where: { roomId: socket.roomId } });
            const userCount = await Users.count({ where: { roomId: socket.roomId } });
            if(!socket.roomId || !game || userCount == 0) break;
            await round(io, socket, rnd);
            rnd++;
        }
        await announcement(5, "END");
    }, 100);

}

module.exports = { GuessAI };
