const express = require("express");
const http = require("http");
const cors = require("cors");
const bodyParser = require("body-parser");

const { init: initSocket, getIO } = require("./utils/sockets");

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

        // console.log(this.games);
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
            // if (response.success != true) return io.to(socket.id).emit("error", { text: response.text });

            // const { game } = response;

            // socket.join(game.id);
            // io.to(game.id).emit("joined", { gameId: game.id, playerId: socket.id });
        } catch (error) {
			console.log(error)
            // socket.emit("error", { message: error.message });
        }
    });

    socket.on("message", (data) => {
        try{
            const game = gameManager.getGame(data.gameId);
            if (!game) return;

    
            const response = game.recieveMessage(socket, data.text);
        }catch(err){
            console.error(err);
        }
    });

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
			// Clean up resources associated with the socket
			gameManager.leaveGame(socket);
			socket.removeAllListeners();
			
			update();
			// Remove any references to the socket
			// For example, if socket references are stored in a data structure, remove them here
		} catch (err) {
			console.error(err);
		}
	});
	
	socket.on("disconnecting", () => {
		console.log(socket.rooms); // the Set contains at least the socket ID
	});
});

app.post("/checkRoom", async (req, res) => {
    // const { roomId } = req.body;
    // const format = /[ `@#$%^&*()+\-=\[\]{};':"\\|,.\/?~]/;

    // if (format.test(roomId)) {
    //     return res.json({ error: "RoomId contains illegal characters" });
    // }

    // // if (roomId.length < 5 || roomId.length > 20) {
    // //     return res.json({ error: "RoomId must be at least 5 characters and maximum 20 characters length" });
    // // }

    // const game = await Games.findOne({ where: { roomId } });

    // if(game && game.round > 0){
    // 	return res.json({ error: "The game has already started" });
    // }

    // const users = await Users.findAll({ where: { roomId } });

    // if (game && users.length > 10) {
    //     return res.json({ error: "The room is full :(" });
    // }

    return res.json({ success: true });
});

const PORT = 5555;
server.listen(PORT, async () => {
    try {
        console.log(`Server is running on port ${PORT}`);
        // await sequelize.sync({ force: true });
        // console.log("Database synchronized");
    } catch (error) {
        console.error("Error:", error);
    }
});
