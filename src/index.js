const express = require("express");
const http = require("http");
const cors = require("cors");
const bodyParser = require("body-parser");
const { sequelize } = require("./database/connection");

const { init: initSocket, getIO } = require("./utils/sockets");

const app = express();
app.use(cors());
app.use(bodyParser.json());

const server = http.createServer(app);
initSocket(server);

// async function initGame(socket) {
// 	const game = await Games.findOne({ where: { roomId: socket.roomId } });
// 	switch(game.name){
// 		case "guessAI":
// 			GuessAI(io, socket, game);
// 			break;
// 		default:
// 			console.log("game not found");
// 	}
// }

class GameManager {
    constructor(io) {
        this.io = io;
        this.games = {};
        this.numGames = 0;
    }

    createGame(gameName) {
        const GameInstance = require(`./games/${gameName}`);
        const game = new GameInstance(this.io);
        this.numGames++;

        this.games[game.id] = game;

        return game;
    }

    joinGame(gameId, socket) {
        const game = this.games[gameId];

        if (!game) throw new Error(`Game ${gameId} does not exist.`);

        game.addPlayer(socket);

        return game;
    }

    getGame(gameId) {
        return this.games[gameId];
    }

    leaveGame(socket) {
        const game = this.games[socket.gameId];
        if (!game) return { success: false, text: "Game not found" };
        return game.removePlayer(socket);
    }

    deleteGame(gameId) {
        delete this.games[gameId];
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

	socket.on("createGame", (data) => {
		if (gameManager.numGames >= 10) {
			socket.emit("error", { text: "Maximum number of games reached" });
			return;
		}

		const game = gameManager.createGame(data.name);
        update();

        const currentTime = new Date().getTime();
        const timeUntilStart = game.startTime - currentTime;
        if (timeUntilStart > 0) {
            setTimeout(() => {
                const start = game.start();
                if(start.success != true)
                    gameManager.deleteGame(game.id);
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

    socket.on("test", (data) => {
        try{
            const game = gameManager.getGame(socket.gameId);
            console.log(socket.gameId);
            

            if (!game) return;
    
            game.recieveMessage(socket, data.text);
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

// io.on("connection", (socket) => {
// socket.on("join", async (data) => {
//     try {
//         const { roomId, userId } = data;
//         socket.join(roomId);
//         socket.join(userId);

//         socket.userId = userId;
//         socket.roomId = roomId;

//         const username = generateUsername();

//         const user = { id: userId, username, admin: false };

// 		let game = await Games.findOne({ where: { roomId } });

//         if (!game) {
//             user.admin = true;
// 			game = await Games.create({ roomId, name:"guessAI", canWrite: true, round: 0 });
//         }
// 		console.log(userId);
// 		await Users.create({ roomId, userId, username, admin: user.admin });
//         io.to(userId).emit("user", user);

// 		const chatUsernames = await Users.findAll({ where: { roomId } });
//         setTimeout(() => {
//             io.to(roomId).emit("userList", { chatUsernames: chatUsernames.map((item) => item.username)});
//         }, 100);
//     } catch (err) {
//         console.error(err);
//     }
// });

// socket.on("disconnect", async () => {
//     try {
//        	await kickUser(socket, socket.userId);
// 		await updateUsers(socket);
//     } catch (err) {
//         console.error(err);
//     }
// });

// socket.on("message", async (data) => {
// 	try{
// 		const { message, userId } = data;
// 		const { roomId } = socket;

// 		const game = await Games.findOne({ where: { roomId } });
// 		if(game.canWrite === false) return;
// 		const user = await Users.findOne({ where: { userId } });
// 		const userMessage = await Messages.findOne({ where: { roomId, username: user.username, round: game.round } });
// 		if(userMessage) return;

// 		await Messages.create({ roomId, username: user.username, message, round: game.round});

// 		user.answered = true;
// 		io.to(roomId).emit("message", { username: user.username, message, type: "message" });
// 		await user.save();
// 	}catch(err){
// 		console.error(err);
// 	}
// });

// socket.on("vote", async (data) => {
// 	try{
// 		const { vote, userId } = data;
// 		const { roomId } = socket;

// 		console.log(vote, userId, roomId);

// 		const game = await Games.findOne({ where: { roomId } });
// 		if(game.canVote === false) return;

// 		const user = await Users.findOne({ where: { userId } });
// 		if(!user || user.voted) return;

// 		const voteUser = await Users.findOne({ where: { username: vote } });
// 		if(!voteUser) return;

// 		voteUser.kickVotes += 1;
// 		await voteUser.save();

// 		user.voted = true;
// 		await user.save();

// 	}catch(err){
// 		console.error(err);
// 	}
// });

// socket.on("startGame", () => {
// 	try{
// 		initGame(socket);
// 	}catch(err){
// 		console.error(err);
// 	}
// })
// });

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
