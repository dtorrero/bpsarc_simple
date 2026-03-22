const path = require('path');

module.exports = {
  port: process.env.PORT || 3000,
  jwtSecret: process.env.JWT_SECRET || 'dev-secret-change-in-production',
  jwtExpiresIn: '7d',
  dbPath: path.join(__dirname, '..', 'data', 'database.sqlite'),
  blueprintsPath: path.join(__dirname, '..', 'blueprints.json'),
  imagesPath: path.join(__dirname, '..', 'images'),
  staticPath: path.join(__dirname, '..', 'static'),
  publicPath: path.join(__dirname, '..', 'public'),
  
  // Default admin credentials - CHANGE IMMEDIATELY ON FIRST RUN
  defaultAdmin: {
    username: 'admin',
    password: 'changeme'
  }
};
