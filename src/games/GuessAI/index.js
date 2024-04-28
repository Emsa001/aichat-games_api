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
        this.maxPlayers = 10;

        // Game status
        this.status = "waiting";
        this.round = 0;
        this.canJoin = true;
        this.canWrite = false;

        // Game timing
        const futureDate = new Date();
        this.startTime = futureDate.setSeconds(futureDate.getSeconds() + 5);
    }

    formatData() {
        return {
            id: this.id,
            name: this.name,
            description: this.description,
            color: this.color,
            players: this.players.length,
            maxPlayers: this.maxPlayers,
            canJoin: this.canJoin,
            canWrite: this.canWrite,
            status: this.status,
            startTime: this.startTime,
        };
    }

    sendPlayerList() {
        this.io.to(this.id).emit("playerlist", { players: this.players });
    }

    sendMessage(data) {
        this.io.to(this.id).emit("message", data);
    }

    sendGameData({ game, players }) {
        const data = {};

        if (game) data.game = this.formatData();
        if (players) data.players = this.players;

        this.io.to(this.id).emit("data", data);
    }

    recieveMessage(socket, text) {
        if (!this.canWrite) return { success: false, text: "Not your turn" };
        this.sendMessage({ text: text, username: socket.player.name, type: "message", color: undefined });
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

    removePlayer(socket) {
        const user = this.players.find((player) => player.id === socket.id);
        this.players = this.players.filter((player) => player !== user);

        this.sendGameData({ game: true });
        console.log(`Player ${socket.id} left`);
        console.log(this.players);

        return { success: true };
    }

    question() {
        return new Promise((resolve, reject) => {
            this.sendMessage({ text: "Why is the sky blue?", type: "alert", color: undefined });
            this.canWrite = true;
			this.sendGameData({ game: true })
            setTimeout(() => {
                this.canWrite = false;
				this.sendGameData({ game: true })
                resolve();
            }, 10 * 1000);
        });
    }

    async start() {
        if (this.players.length < 2) return { success: false, text: "Not enough players" };

        this.status = "started";
        this.canJoin = false;

        this.sendGameData({ game: true, players: true });
        this.sendMessage({ text: "Game started", type: "alert", color: "info" });
        this.sendPlayerList();

        this.question().then(() => {
            this.sendMessage({ text: "Time's up!", type: "alert", color: "warning" });
        });

        return { success: true };
    }
}

module.exports = Game;
