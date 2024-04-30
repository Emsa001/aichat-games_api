const { generateUsername } = require("unique-username-generator");
const { getRandomQuestion } = require("./questions");
const sendData = require("./functions/sendData");
const create = require("./functions/create");
const aiManager = require("./functions/ai");

const generateId = () => {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
};

class Player {
    constructor(id) {
        this.id = id;
        this.name = generateUsername("", 0, 10);
        this.isAI = false;
        this.isHuman = true;
        this.admin = false;
        this.viewer = false;
        this.canWrite = false;
        this.vote = null;
    }

    setAI() {
        this.isAI = true;
        this.isHuman = false;
    }
}

class Game {
    constructor(io) {
        // Game information
        this.io = io;
        this.id = generateId();
        this.name = "Guess Who's AI";
        this.description =
            "Chat of minimum 3 players. One player is the AI, the others are humans. All players including AI will answer the same question. Humans must guess who the AI is. AI must try to blend in.";
        this.color = "bg-blue-500";

        // Player management
        this.players = [];
        this.ai = [];
        this.minPlayers = 3;
        this.maxPlayers = 10;
        this.voteTime = 25;
        this.roundTime = 30;

        // Game status
        this.status = "waiting";
        this.round = 0;
        this.canJoin = true;
        this.canVote = false;

        // Game timing
        const futureDate = new Date();
        const timeToStart = 60;
        this.startTime = futureDate.setSeconds(futureDate.getSeconds() + timeToStart);
    }

    formatData() {
        return {
            id: this.id,
            name: this.name,
            description: this.description,
            color: this.color,

            players: this.players.length,
            minPlayers: this.minPlayers,
            maxPlayers: this.maxPlayers,

            status: this.status,
            round: this.round,
            canJoin: this.canJoin,
            canVote: this.canVote,

            startTime: this.startTime,
        };
    }

    sendMessage(data) {
        this.io.to(this.id).emit("message", data);
    }

    sendTimer(time) {
        this.io.to(this.id).emit("timer", { time: time });
    }

    sendUserData(player) {
        this.io.to(player.id).emit("data", { user: player });
    }

    getPlayer(id) {
        return this.players.find((player) => player.id === id);
    }

    async create(){
        create.room(this);
    }
   
    recieveMessage(socket, text) {
        const player = this.getPlayer(socket.id);
        if (!player || !player.canWrite) return { success: false, text: "Not your turn" };

        player.canWrite = false;
        this.sendMessage({ text: text, username: player.name, type: "message", color: undefined });
        this.sendUserData(player);
        return { success: true };
    }

    recieveVote(socket, vote) {
        if (!this.canVote) return { success: false, text: "Not voting time" };
        socket.player.vote = vote;
        return { success: true };
    }

    addAI() {
        const AI = new Player(generateId());
        AI.setAI();

        this.players.push(AI);
        this.ai.push(AI);
        sendData.room({ game: true }, this);
        return { success: true };
    }

    addPlayer(socket) {
        if (this.players.length >= this.maxPlayers) return { success: false, text: "Game Full" };

        const player = new Player(socket.id);
        if (this.players.includes(player)) return { success: false, text: "Already Joined" };
        if(this.players.length == 1) player.admin = true;

        this.players.push(player);

        if (this.players.length == this.maxPlayers) this.canJoin = false;

        socket.player = player;
        this.io.to(socket.id).emit("data", { user: player });
        setTimeout(() => {
            sendData.room({ game: true }, this);
        }, 100);

        return { game: this, success: true };
    }

    removePlayer(id) {
        const user = this.players.find((player) => player.id === id);
        this.players = this.players.filter((player) => player !== user);
        if(user?.isAI)
            this.ai = this.ai.filter((player) => player !== user);

        user.canWrite = false;
        this.io.to(user.id).emit("data", { user: user });
        sendData.room({ game: true, players: true }, this);

        return { success: true };
    }

    async question({ time, text }) {
        return new Promise(async (resolve) => {
            this.sendTimer(time);
            this.sendMessage({ text, type: "alert", color: undefined });

            this.players.forEach((player) => {
                player.canWrite = true;
                this.sendUserData(player);
            });

            sendData.room({ game: true}, this);

            this.ai.forEach(async (ai) => {
                aiManager.send({ ai, text }, this);
            });

            setTimeout(() => {
                resolve();
            }, time * 1000);
        });
    }

    async newRound(time) {
        return new Promise(async (resolve) => {
            this.round++;
            this.sendMessage({ text: `Round ${this.round} started`, type: "info", color: "info" });

            await new Promise((resolve) => {
                setTimeout(() => {
                    resolve();
                }, 1000);
            });

            this.question({ time, text: getRandomQuestion() }).then(() => {
                this.players.forEach((player) => {
                    if (player.canWrite) {
                        this.sendMessage({ text: `${player.name} did not answer`, type: "info", color: "error" });
                        this.removePlayer(player.id);
                        sendData.room({ game: true, players: true}, this);
                    }
                });

                if (this.players.length < this.minPlayers) {
                    return resolve({ success: false, text: "Not enough players" });
                }

                resolve({ success: true, text: "Round finished" });
            });
        });
    }

    async vote(time) {
        return new Promise(async (resolve) => {
            this.canVote = true;

            this.sendTimer(time);
            this.sendMessage({ text: `Vote time`, type: "alert", color: "info" });
            sendData.room({ game: true }, this);


            setTimeout(() => {
                this.canVote = false;

                const votes = this.players.map((player) => player.vote).filter((vote) => vote !== null);
                const highestVotes = votes
                    .sort((a, b) => votes.filter((v) => v === a).length -votes.filter((v) => v === b).length)
                    .pop();

                const toKick = this.getPlayer(highestVotes);

                if (!highestVotes || !toKick) {
                    this.sendMessage({ text: `Nobody was kicked`, type: "alert", color: "warning" });
                    return resolve();
                }

                this.sendMessage({ text: `${toKick.name} was voted to be kicked`, type: "alert", color: "error" });

                if(toKick.isAI){
                    return resolve({
                        victory: true,
                        gameId: this.id,
                        title: "Victory!",
                        message: "Congratulations! You've kicked the AI!",
                        icon: "success",
                    });
                }

                this.removePlayer(toKick.id);

                if(this.players.length < this.minPlayers)
                {
                    const ai = this.players.find(player => player.isAI);
                    return resolve( {
                        victory: false,
                        gameId: this.id,
                        title: "You lost",
                        message: `The AI has won (${ai?.name})!`,
                        icon: "error",
                    });
                }

                resolve({ success: true, text: "Player kicked"});
            }, time * 1000);
        });
    }

    async start() {
        if (this.players.length < this.minPlayers){
            console.log("Not enough players")
            return {
                success: false,
                gameId: this.id,
                title: "Not enough players",
                message: "This room has been closed",
                icon: "error",
            };
        }

        this.status = "started";
        this.canJoin = false;

        sendData.room({ game: true, players: true}, this);
        this.sendMessage({ text: "Game started", type: "alert", color: "info" });

        while (true) {

            if(this.players.length < this.minPlayers)
            {
                const ai = this.players.find(player => player.isAI);
                return resolve( {
                    victory: false,
                    gameId: this.id,
                    title: "You lost",
                    message: `The AI has won (${ai?.name})!`,
                    icon: "error",
                });
            }

            if (this.round > 0 && this.round % 3 === 0) {
                const vote = await this.vote(this.voteTime);
                if(vote.victory === true || vote.victory === false)
                    return vote;
            }
            const round = await this.newRound(this.roundTime);
            if (round.success === false) break;

            if(this.ai.length == 0){
                return {
                    gameId: this.id,
                    title: "Victory!",
                    message: "Congratulations! You've kicked the AI!",
                    icon: "success",
                };
            }
        }

        return {
            gameId: this.id,
            title: "Game finished",
            message: "This room has been closed",
            icon: "warning",
        };

        // this.sendMessage({ text: "Game finished", type: "alert", color: "info" });
    }
}

module.exports = Game;
