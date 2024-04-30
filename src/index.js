const express = require("express");
const http = require("http");
const cors = require("cors");
const bodyParser = require("body-parser");

const { init: initSocket, getIO } = require("./utils/sockets");
const { generativeModel } = require("./utils/aimodel");

const app = express();
app.use(cors());
app.use(bodyParser.json());

const server = http.createServer(app);
initSocket(server);

class GameManager {
    constructor(io) {
        this.io = io;
        this.games = {};
        this.numGames = 0;
    }

    getGame(gameId) {
        return this.games[gameId];
    }

    async createGame(gameName) {
        const GameInstance = require(`./games/${gameName}`);
        const game = new GameInstance(this.io);
        game.create();
        this.numGames++;
        this.games[game.id] = game;

        return game;
    }

    joinGame(gameId, socket) {
        const game = this.getGame(gameId);

        if (!game) throw new Error(`Game ${gameId} does not exist.`);
        game.addPlayer(socket);

        return game;
    }
    
    leaveGame(socket) {
        const game = this.getGame(socket.gameId);
        if (!game) return { success: false, text: "Game not found" };
        return game.removePlayer(socket.id);
    }

    deleteGame(data) {
        const game = this.getGame(data.gameId);
        if(!game) return;

        this.io.to(game.id).emit("close", { title: data.title, message: data.message, icon: data.icon});

        delete this.games[game.id];
        this.numGames--;

    }

    getAllGames() {
        return Object.values(this.games).map((game) => ({
            id: game.id,
            name: game.name,
            description: game.description,
            color: game.color,
            players: game.players.length,
            maxPlayers: game.maxPlayers,
            canJoin: game.canJoin,
			canWrite: game.canWrite,
            status: game.status,
			startTime: game.startTime,
        }));
    }
}

const io = getIO();
const gameManager = new GameManager(io);

const update = () => {
	const users = Array.from(io.sockets.sockets.values()).filter(s => s.isUser).length;
	io.emit("update", { online: users, games: gameManager.getAllGames() });
}

io.on("connection", (socket) => {

	socket.on("join", async (data) => {
		socket.join("lobby");
		socket.lobby = true;
		socket.isUser = true;
		update();
	});

	socket.on("createGame", async (data) => {
		if (gameManager.numGames >= 10) {
			socket.emit("error", { text: "Maximum number of games reached" });
			return;
		}

		const game = await gameManager.createGame(data.name);
        update();

        const currentTime = new Date().getTime();
        const timeUntilStart = game.startTime - currentTime;
        if (timeUntilStart > 0) {
            setTimeout(async () => {
                if(game.status != "waiting") return;
                const gameStart = await game.start(gameManager);
                gameManager.deleteGame(gameStart);
                update();
            }, timeUntilStart);
        }
	});

	socket.on("joinGame", (data) => {
        try {
			socket.isUser = true;
			socket.lobby = false;
            const game = gameManager.joinGame(data.id, socket);

            socket.join(game.id);
            socket.gameId = game.id;

            console.log(`Player ${socket.id} joined game ${game.id}`)

			update();
        } catch (error) {
			console.log(error)
        }
    });

    socket.on("startGame", async (data) => {
        try {
            const game = gameManager.getGame(data.gameId);
            if (!game) return;

            const response = await game.start(gameManager);
            gameManager.deleteGame(response);

            update();
        } catch (error) {
            console.error(error);
        }
    });

    // socket.on("message", (data) => {
    //     try{
    //         const game = gameManager.getGame(data.gameId);
    //         if (!game) return;

    
    //         const response = game.recieveMessage(socket, data.text);
    //     }catch(err){
    //         console.error(err);
    //     }
    // });

    socket.on("vote", (data) => {
        try{
            const game = gameManager.getGame(data.gameId);
            if (!game) return;

            const response = game.recieveVote(socket, data.vote);
        }catch(err){
            console.error(err);
        }
    });

    socket.on("disconnect", () => {
		try {
			gameManager.leaveGame(socket);
			socket.removeAllListeners();
			
			update();
		} catch (err) {
			console.error(err);
		}
	});
});

const PORT = 5555;
server.listen(PORT, async () => {
    try {
        console.log(`Server is running on port ${PORT}`);

        const request = {
            contents: [{role: 'user', parts: [{text: `say hi`}]}],
        };
        generativeModel.generateContent(request).then(() => console.log("Model loaded"));
        // await sequelize.sync({ force: true });
        // console.log("Database synchronized");
    } catch (error) {
        console.error("Error:", error);
    }
});
