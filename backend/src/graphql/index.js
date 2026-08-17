const { ApolloServer } = require('@apollo/server');
const { expressMiddleware } = require('@apollo/server/express4');
const { ApolloServerPluginLandingPageLocalDefault } = require('@apollo/server/plugin/landingPage/default');
const typeDefs = require('./schema');
const resolvers = require('./resolvers');

const createApolloServer = async (app) => {
    const server = new ApolloServer({
        typeDefs,
        resolvers,
        plugins: process.env.NODE_ENV === "production"
            ? []
            : [ApolloServerPluginLandingPageLocalDefault()],
    });

    await server.start();

    return server;
};

module.exports = { createApolloServer, expressMiddleware };
