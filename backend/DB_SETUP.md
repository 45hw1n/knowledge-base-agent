Install mongodb
brew tap mongodb/brew
brew update
brew install mongodb-community@7.0

Start mongodb
brew services start mongodb-community@7.0

To check mongoDb version
mongod --version or
mongosh --version 

Connect to mongodb
mongosh "mongodb://localhost:27017"


Stop mongodb
brew services stop mongodb-community@7.0
