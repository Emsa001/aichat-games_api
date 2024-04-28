class GameManager {
	constructor(io) {
		this.io = io;
		this.games = {};
	}

	createGame(gameName) {
		// Create a new instance of the game
		const Game = require(`../games/${gameName}`);
		const game = new Game(this.io);

		// Store the game instance
		this.games[gameName] = game;

		// Return the game instance
		return game;
	}

	joinGame(gameName, socket) {
		if (this.games[gameName]) {
			this.games[gameName].addPlayer(socket);
		} else {
			throw new Error(`Game ${gameName} does not exist.`);
		}
	}
}

module.exports = GameManager;