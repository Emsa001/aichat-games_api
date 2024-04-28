const { Sequelize, DataTypes } = require('sequelize');

// Initialize Sequelize with SQLite
const sequelize = new Sequelize({
    dialect: 'sqlite',
    storage: 'gamesDB.sqlite', // SQLite database file path
    logging: false // Disable logging
});

// Define a model
const Games = sequelize.define('games', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  roomId: {
    type: DataTypes.STRING,
    allowNull: false
  },
  canWrite:{
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false
  },
  canVote:{
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false
  },
  name:{
    type: DataTypes.STRING,
    allowNull: false
  },
  round:{
    type: DataTypes.INTEGER,
    allowNull: false
  }
});

const Users = sequelize.define('users', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  roomId: {
    type: DataTypes.STRING,
    allowNull: false
  },
  userId: {
    type: DataTypes.STRING,
    allowNull: false
  },
  username: {
    type: DataTypes.STRING,
    allowNull: false
  },
  kickVotes: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0
  },
  voted: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false
  },
  answered: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false
  },
  admin: {
    type: DataTypes.BOOLEAN,
    allowNull: false
  }
});

const Messages = sequelize.define('messages', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  roomId: {
    type: DataTypes.STRING,
    allowNull: false
  },
  username: {
    type: DataTypes.STRING,
    allowNull: false
  },
  message: {
    type: DataTypes.STRING,
    allowNull: false
  },
  round:{
    type: DataTypes.INTEGER,
    allowNull: false
  }
});

// // Define associations
// Games.hasMany(Messages, { foreignKey: 'roomId' }); // A game can have multiple messages
// Games.hasMany(Users, { foreignKey: 'roomId' }); // A game can have multiple users
// Users.belongsTo(Games, { foreignKey: 'roomId' }); // Each user belongs to a game
// Messages.belongsTo(Users, { foreignKey: 'userId' }); // Each message belongs to a user
// Messages.belongsTo(Games, { foreignKey: 'roomId' }); // Each message belongs to a game

module.exports = {sequelize, Games, Users, Messages};