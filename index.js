
const yaml = require('js-yaml');
const fs = require('fs');

const Client = require('./models/Client.js');

fs.readFile('./config.yml', 'utf8', (err, data) => {
  if (err) throw err;

  const config = yaml.safeLoad(data);

  if (process.env.POKEBLOB_TEST_ONLY)
    // if this is a test, deviate from the standard docker config
    config.db.host = 'localhost';

  const client = new Client(config);

  process.on('SIGINT', client.destroy);
  process.on('SIGTERM', client.destroy);

  client.findLoadCommands();
  client.findLoadLocales();

  if (!process.env.POKEBLOB_TEST_ONLY)
    client.login(config.token);
  else
    client.destroy();
});
