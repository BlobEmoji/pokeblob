const clientFactory = require('./clientfactory.js');

const config = require('./config.js');


clientFactory({ config: config, fetchAllMembers: true }).then((client, err) => {
  if (err)
    return console.log(`Error occurred while initializing client: ${err}`);

  if (!process.env.POKEBLOB_TEST_ONLY)
    client.login(config.token);
});
