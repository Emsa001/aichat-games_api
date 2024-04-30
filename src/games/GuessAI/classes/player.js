const { generateUsername } = require("unique-username-generator");

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

module.exports = {Player};