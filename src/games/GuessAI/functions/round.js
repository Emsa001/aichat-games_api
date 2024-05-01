const data = require("../utils/data");
const message = require("../utils/message");
const { getRandomQuestion } = require("../utils/questions");
const aiManager = require("./ai");
const playerModule = require("./player");

module.exports = {
    name: "round",

    constructor(game) {
        this.game = game;
    },

    async new(time) {
        try {
            const game = this.game;

            return new Promise(async (resolve) => {
                game.round++;
                message.sendRoom({ text: `Round ${game.round} started`, type: "info", color: "info" }, game);

                await new Promise((resolve) => {
                    setTimeout(() => {
                        resolve();
                    }, 1000);
                });

                this.question(time, getRandomQuestion()).then(() => {
                    game.players.forEach((player) => {
                        if (player.canWrite) {
                            message.sendRoom(
                                { text: `${player.name} did not answer`, type: "info", color: "error" },
                                game
                            );
                            game.removePlayer(player.id);
                            data.sendRoom({ game: true, players: true }, game);
                        }
                    });

                    if (game.players.length < game.minPlayers) {
                        return resolve({ success: false, text: "Not enough players" });
                    }

                    resolve({ success: true, text: "Round finished" });
                });
            });
        } catch (err) {
            console.error("Error in round execution:", err);
            return null;
        }
    },

    async question(time, text) {
        try {
            const game = this.game;

            return new Promise(async (resolve) => {
                message.timer({ time }, game);
                message.sendRoom({ text, type: "alert", color: undefined }, game);

                game.players.forEach((player) => {
                    player.canWrite = true;
                    data.sendUser({ player }, game);
                });

                data.sendRoom({ game: true }, game);

                game.ai.forEach(async (ai) => {
                    aiManager.send({ ai, text }, game);
                });

                setTimeout(() => {
                    resolve();
                }, time * 1000);
            });
        } catch (err) {
            console.error("Error in round execution:", err);
            return null;
        }
    },

    async vote(time) {
        try {
            return new Promise(async (resolve) => {
                const game = this.game;

                game.canVote = true;

                message.timer({time},game);
                message.sendRoom({ text: `Vote time`, type: "alert", color: "info" }, game);
                data.sendRoom({ game: true }, game);
    
                setTimeout(() => {
                    game.canVote = false;
    
                    const votes = game.players.map((player) => player.vote).filter((vote) => vote !== null);
                    const highestVotes = votes
                        .sort((a, b) => votes.filter((v) => v === a).length -votes.filter((v) => v === b).length)
                        .pop();
    
                    const toKick = playerModule.get({id:highestVotes}, game);
    
                    if (!highestVotes || !toKick) {
                        message.sendRoom({ text: `Nobody was kicked`, type: "alert", color: "warning" }, game);
                        return resolve();
                    }
    
                    
                    if(toKick.isAI){
                        return resolve({
                            victory: true,
                            gameId: game.id,
                            title: "Victory!",
                            message: "Congratulations! You've kicked the AI!",
                            icon: "success",
                        });
                    }
                    
                    message.sendRoom({ text: `${toKick.name} was not the AI`, type: "alert", color: "error" },game);
                    game.removePlayer(toKick.id);
    
                    if(game.players.length < game.minPlayers)
                    {
                        const ai = game.players.find(player => player.isAI);
                        return resolve( {
                            victory: false,
                            gameId: game.id,
                            title: "You lost",
                            message: `The AI has won (${ai?.name})!`,
                            icon: "error",
                        });
                    }
    
                    resolve({ success: true, text: "Player kicked"});
                }, time * 1000);
            });
        } catch (err) {
            console.error("Error in round execution:", err);
            return null;
        }
    },
};
