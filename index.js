const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const cors = require("cors");
const fs = require("fs");
const bodyParser = require("body-parser");
const { v4: uuidv4 } = require("uuid");
const { generateUsername } = require("unique-username-generator");
const { GuessAI } = require("./games/guess_ai");
const { Games, Users, sequelize, Messages } = require("./database/connection");

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

const chatDirectory = "./chats";

if (!fs.existsSync(chatDirectory)) {
    fs.mkdirSync(chatDirectory);
}

app.use(cors());
app.use(bodyParser.json());

// app.use((req, res, next) => {
//     const referer = req.headers.referer || "";

// 	next();
//     if (referer.startsWith("http://localhost:3000")) {
//     } else {
//         res.status(403).send("Forbidden");
//     }
// });

async function initGame(socket) {

	const game = await Games.findOne({ where: { roomId: socket.roomId } });
	switch(game.name){
		case "guessAI":
			GuessAI(io, socket, game);
			break;
		default:
			console.log("game not found");
	}
}

io.on("connection", (socket) => {
    socket.on("join", async (data) => {
        try {
            const { roomId, userId } = data;
            socket.join(roomId);
            socket.join(userId);

            socket.userId = userId;
            socket.roomId = roomId;

            // Add error handling if generateUsername fails
            const username = generateUsername();

            // Initialize chatData[roomId] if it's undefined
            const user = { id: userId, username, admin: false };

			let game = await Games.findOne({ where: { roomId } });

            if (!game) {
                user.admin = true;
				game = await Games.create({ roomId, name:"guessAI", canWrite: true, round: 0 });
            }
			console.log(userId);
			await Users.create({ roomId, userId, username, admin: user.admin });
            io.to(userId).emit("user", user);

			const chatUsernames = await Users.findAll({ where: { roomId } });
            setTimeout(() => {
                io.to(roomId).emit("userList", { chatUsernames: chatUsernames.map((item) => item.username)});
            }, 100);
        } catch (err) {
            console.error(err);
        }
    });

    socket.on("disconnect", async () => {
        try {
			const user = await Users.findOne({ where: { userId: socket.userId } });

            if (socket.roomId && user) {
                await Users.destroy({ where: { userId: socket.userId } });
				
				const AllUsers = await Users.findAll({ where: { roomId: socket.roomId } });
				if (AllUsers.length === 0) {
					await Messages.destroy({ where: { roomId: socket.roomId } });
					await Games.destroy({ where: { roomId: socket.roomId } });
				}else{
					const chatUsernames = await Users.findAll({ where: { roomId:socket.roomId } });
					io.to(socket.roomId).emit("userList", { chatUsernames: chatUsernames.map((item) => item.username)});
				}
			}
        } catch (err) {
            console.error(err);
        }
    });

	socket.on("message", async (data) => {
		try{
			const { message, userId } = data;
			const { roomId } = socket;

			const game = await Games.findOne({ where: { roomId } });
			if(game.canWrite === false) return;
			const user = await Users.findOne({ where: { userId } });
			const userMessage = await Messages.findOne({ where: { roomId, username: user.username, round: game.round } });
			if(userMessage) return;

			await Messages.create({ roomId, username: user.username, message, round: game.round});

			user.answered = true;
			io.to(roomId).emit("message", { username: user.username, message, type: "message" });
			await user.save();
		}catch(err){
			console.error(err);
		}
	});

	socket.on("vote", async (data) => {
		try{
			const { vote, userId } = data;
			const { roomId } = socket;

			console.log(vote, userId, roomId);

			const game = await Games.findOne({ where: { roomId } });
			if(game.canVote === false) return;

			const user = await Users.findOne({ where: { userId } });
			if(!user || user.voted) return;

			const voteUser = await Users.findOne({ where: { username: vote } });
			if(!voteUser) return;

			voteUser.kickVotes += 1;
			await voteUser.save();
			
			user.voted = true;
			await user.save();

		}catch(err){
			console.error(err);
		}
	});

	socket.on("startGame", () => {
		try{
			initGame(socket);
		}catch(err){
			console.error(err);
		}
	})
});

app.post("/checkRoom", async (req, res) => {
    const { roomId } = req.body;
    const format = /[ `@#$%^&*()+\-=\[\]{};':"\\|,.\/?~]/;

    if (format.test(roomId)) {
        return res.json({ error: "RoomId contains illegal characters" });
    }

    // if (roomId.length < 5 || roomId.length > 20) {
    //     return res.json({ error: "RoomId must be at least 5 characters and maximum 20 characters length" });
    // }

	const game = await Games.findOne({ where: { roomId } });

	if(game && game.round > 0){
		return res.json({ error: "The game has already started" });
	}

	const users = await Users.findAll({ where: { roomId } });

    if (game && users.length > 10) {
        return res.json({ error: "The room is full :(" });
    }

    return res.json({ success: true });
});

const PORT = 5555;
server.listen(PORT, async() => {
	try {
    	console.log(`Server is running on port ${PORT}`);
		await sequelize.sync({ force: true });
		console.log("Database synchronized");
	} catch (error) {
		console.error("Error:", error);
	}
});
