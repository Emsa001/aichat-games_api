const { Games, Messages, Users } = require("../database/connection");
const { kickUser, updateUsers, closeRoom } = require("../utils/sockets");

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

const question = (io, socket, time) => {
    return new Promise(async (resolve, reject) => {
        try {
            const game = await Games.findOne({ where: { roomId: socket.roomId } });
            if (!game) return resolve(false);
            
            io.to(socket.roomId).emit("systemMessage", { time, type: "question", text: getQuestion(questions) });
            
            await game.update({ canWrite: true });
            
            setTimeout(async () => {
                try {
                    const didNotAnswer = await Users.findAll({ where: { roomId: socket.roomId, answered: false } });
                    
                    didNotAnswer.forEach(async (user) => {
                        await kickUser(socket, user.userId);
                        await Messages.create({ roomId: socket.roomId, username: user.username, message: "Did not answer", round: game.round });
                    });
                    
                    updateUsers(socket);
                    
                    await game.update({ canWrite: false });
                    
                    await Messages.destroy({ where: { roomId: socket.roomId, round: game.round } });
                    await Users.update({ answered: false }, { where: { roomId: socket.roomId } });
                    
                    resolve(true);
                } catch (error) {
                    reject(error);
                }
            }, time * 1000);
        } catch (error) {
            reject(error);
        }
    });
};

const voteTime = (io, socket, time) => {
    return new Promise(async (resolve, reject) => {
        try {
            const game = await Games.findOne({ where: { roomId: socket.roomId } });
            if (!game) return resolve(false);
            
            // Inform users that voting has started
            io.to(socket.roomId).emit("start-vote", time);
            io.to(socket.roomId).emit("systemMessage", { text: "Voting has started", type: "info", color: "warning" });
            
            await game.update({ canVote: true });
            setTimeout(async () => {
                try {
                    io.to(socket.roomId).emit("end-vote", time);
                    
                    await game.update({ canVote: false });

                    const toKick = await Users.findOne({
                        order: [['kickVotes', 'DESC']]
                    });

                    if (toKick && toKick.kickVotes > 0) {
                        await kickUser(socket, toKick.userId);
                        await updateUsers(socket);
                        resolve(true);
                    } else {
                        io.to(socket.roomId).emit("systemMessage", { text: "No one was kicked", type: "info", color: "info" });
                        resolve(true);
                    }
                } catch (error) {
                    reject(error);
                }
            }, time * 1000);
        } catch (error) {
            reject(error);
        }
    });
};


async function round(io, socket, rnd) {
    try {
        await announcement(5, `Round ${rnd}`, io, socket);

        const steps = [
            () => question(io, socket, 42),
            () => announcement(5, "New question in", io, socket),
            () => question(io, socket, 42),
            () => announcement(5, "New question in", io, socket),
            () => question(io, socket, 42),
            () => announcement(5, "Voting in", io, socket),
            () => voteTime(io, socket, 24)
        ];

        for (const step of steps) {
            const result = await step();

            if (result === false)
            {
                await closeRoom(io, socket);
                return;
            }
        }
    } catch (error) {
        console.error("Error in round:", error);
    }
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
