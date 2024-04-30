const create = require("./functions/create");
const aiManager = require("./functions/ai");
const data = require("./utils/data");
const message = require("./utils/message");
const player = require("./functions/player");
const roundModule = require("./functions/round");

class Game {
    constructor(io) {
        // Game information
        this.io = io;
        this.id = player.generateId();
        this.name = "Guess Who's AI";
        this.description =
            "Chat of minimum 3 players. One player is the AI, the others are humans. All players including AI will answer the same question. Humans must guess who the AI is. AI must try to blend in.";
        this.color = "bg-blue-500";

        // Player management
        this.players = [];
        this.ai = [];
        this.minPlayers = 3;
        this.maxPlayers = 10;
        this.voteTime = 5;
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

    listen(socket){
        socket.on("message", (data) => {
            try{  
                this.recieveMessage(socket, data.text);
            }catch(err){
                console.error(err);
            }
        });
    }

    create(){
        create.constructor(this);
        create.room();
    }

    recieveMessage(socket, text) {
        return message.recieve({socket, text}, this);
    }
    
    recieveVote(socket, vote) {
        if (!this.canVote) return { success: false, text: "Not voting time" };
        socket.player.vote = vote;
        return { success: true };
    }

    addAI() {
        return aiManager.addAI(this);
    }

    addPlayer(socket) {
        return player.add({ socket }, this);
    }

    removePlayer(id) {
        return player.remove({ id }, this);
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

        data.sendRoom({ game: true, players: true}, this);
        message.sendRoom({ text: "Game started", type: "alert", color: "info" }, this);

        while (true) {
            roundModule.constructor(this);

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
                const vote = await roundModule.vote(this.voteTime);
                if(vote?.victory === true || vote?.victory === false)
                    return vote;
            }
            const response = await roundModule.new(this.roundTime);
            if (response.success === false) break;

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
    }
}

module.exports = Game;
