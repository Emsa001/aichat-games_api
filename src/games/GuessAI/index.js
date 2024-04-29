const { generateUsername } = require("unique-username-generator");

const generateId = () => {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
};

class Player {
    constructor(socket) {
        this.id = socket.id;
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
        this.minPlayers = 2;
        this.maxPlayers = 10;

        // Game status
        this.status = "waiting";
        this.round = 0;
        this.canJoin = true;
        this.canVote = false;

        // Game timing
        const futureDate = new Date();
        const timeToStart = 10;
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

    sendGameData({ game, players }) {
        const data = {};

        if (game) data.game = this.formatData();
        if (players) data.players = this.players;

        this.io.to(this.id).emit("data", data);
    }

    recieveMessage(socket, text) {
        if (!socket.player.canWrite) return { success: false, text: "Not your turn" };
        socket.player.canWrite = false;
        this.sendMessage({ text: text, username: socket.player.name, type: "message", color: undefined });
        this.sendUserData(socket.player);
        return { success: true };
    }

    recieveVote(socket, vote) {
        if (!this.canVote) return { success: false, text: "Not voting time" };
        socket.player.vote = vote;
        return { success: true };
    }

    addPlayer(socket) {
        if (this.players.length >= this.maxPlayers) return { success: false, text: "Game Full" };

        const player = new Player(socket);
        if (this.players.includes(player)) return { success: false, text: "Already Joined" };

        this.players.push(player);

        if (this.players.length == this.maxPlayers) this.canJoin = false;

        socket.player = player;
        this.io.to(socket.id).emit("data", { user: player });
        setTimeout(() => {
            this.sendGameData({ game: true });
        }, 100);

        return { game: this, success: true };
    }

    removePlayer(id) {
        const user = this.players.find((player) => player.id === id);
        this.players = this.players.filter((player) => player !== user);

        user.canWrite = false;
        this.io.to(user.id).emit("data", { user: user });
        this.sendGameData({ game: true });

        return { success: true };
    }

    async question({ time }) {
        return new Promise(async (resolve) => {
            this.sendTimer(time);
            this.sendMessage({ text: "Why is the sky blue?", type: "alert", color: undefined });

            this.players.forEach((player) => {
                player.canWrite = true;
                this.sendUserData(player);
            });

            this.sendGameData({ game: true });
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

            this.question({ time }).then(() => {
                this.players.forEach((player) => {
                    if (player.canWrite) {
                        this.sendMessage({ text: `${player.name} did not answer`, type: "info", color: "error" });
                        this.removePlayer(player.id);
                        this.sendGameData({ game: true, players: true });
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
            this.sendGameData({ game: true });

            setTimeout(() => {
                this.canVote = false;

                const votes = this.players.map((player) => player.vote);
                const highestVotes = votes
                    .sort((a, b) => votes.filter((v) => v === a).length -votes.filter((v) => v === b).length)
                    .pop();

                console.log(votes, highestVotes);

                if (!highestVotes) {
                    this.sendMessage({ text: `Nobody was kicked`, type: "alert", color: "warning" });
                    resolve();
                }


                const toKick = this.getPlayer(highestVotes);

                console.log(toKick.name);
                this.sendMessage({ text: `${toKick.name} was voted to be kicked`, type: "alert", color: "error" });
                this.round++;

                resolve();
            }, time * 1000);
        });
    }

    async start() {
        if (this.players.length < this.minPlayers)
            return {
                success: false,
                gameId: this.id,
                title: "Not enough players",
                message: "This room has been closed",
                icon: "error",
            };

        this.status = "started";
        this.canJoin = false;

        this.sendGameData({ game: true, players: true });
        this.sendMessage({ text: "Game started", type: "alert", color: "info" });

        // await this.newRound(10);
        // await this.newRound(10);

        while (true) {
            if (this.round == 0) {
                const vote = await this.vote(10);
            } else {
                const round = await this.newRound(10);
                if (round.success === false) break;
            }
        }

        return {
            success: false,
            gameId: this.id,
            title: "Game finished",
            message: "This room has been closed",
            icon: "warning",
        };

        // this.sendMessage({ text: "Game finished", type: "alert", color: "info" });

        return { success: true };
    }
}

module.exports = Game;
