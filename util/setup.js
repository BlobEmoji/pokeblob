const inquirer = require('inquirer');
const Enmap = require('enmap');
const EnmapLevel = require('enmap-level');
const fs = require('fs');

let baseConfig = fs.readFileSync('./util/setup_base.js', 'utf8');

const defaultSettings = `{
  "prefix": "-",
  "modLogChannel": "mod-log",
  "traineeRole": "395299609196494861",
  "councilRole": "294928463536586754",
  "policeRole": "295476842935353345",
  "systemNotice": "true",
  "blobCoin": "398579309276823562"
}`;

const settings = new Enmap({provider: new EnmapLevel({name: 'settings'})});

let prompts = [
  {
    type: 'list', 
    name: 'resetDefaults', 
    message: 'Do you want to reset default settings?', 
    choices: ['Yes', 'No']
  },
  {
    type: 'input',
    name: 'token',
    message: 'Please enter the bot token from the application page.'
  }
];

(async function() {
  console.log('Setting Up PokeBlob Configuration...');
  await settings.defer;
  if (!settings.has('default')) {
    prompts = prompts.slice(1);
    console.log('First Start! Inserting default guild settings in the database...');
    await settings.setAsync('default', defaultSettings);
  }

  const answers = await inquirer.prompt(prompts);

  if (answers.resetDefaults && answers.resetDefaults === 'Yes') {
    console.log('Resetting default guild settings...');
    await settings.setAsync('default', defaultSettings);
  }

  baseConfig = baseConfig.replace('{{token}}', `${answers.token}`);
  
  fs.writeFileSync('./config.js', baseConfig);
  console.log('REMEMBER TO NEVER SHARE YOUR TOKEN WITH ANYONE!');
  console.log('Configuration has been written, enjoy!');
  await settings.close();
}());