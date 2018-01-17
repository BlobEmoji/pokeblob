const Command = require('../base/Command.js');

class Search extends Command {
  constructor(client) {
    super(client, {
      name: 'search',
      description: 'Search the tall grass for an item.',
      category: 'Pokéblob',
      usage: 'search',
      guildOnly: true,
      extended: 'Search the tall grass in hopes of finding something. Consumes one energy.',
      botPerms: ['SEND_MESSAGES'],
      permLevel: 'User'
    });
  }

  async run(message, args, level) { // eslint-disable-line no-unused-vars
    const settings = message.settings;
    const connection = await this.client.db.acquire();
    const escapedPrefix = settings.prefix.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');

    try {
      const { energy } = await this.client.db.getUserData(connection, message.guild.id, message.author.id);

      if (energy <= 0) {
        await message.channel.send('Not enough energy...');
        return;
      }

      await this.client.db.modifyMemberEnergy(connection, message.guild.id, message.author.id, -1);

      const activeEffects = await this.client.db.consumeUserEffects(connection, message.guild.id, message.author.id, 1);
      const effectIDs = activeEffects.map(x => x.effect_id);
      const lureActive = effectIDs.includes(1);

      const searchText = lureActive ? 'walks through the tall grass with their Blob Lure and finds' : 'searches through the tall grass and finds';
      const msg = await message.channel.send(`_${message.author} ${searchText}..._`);
      await this.client.wait(2500);    

      const blobChance = lureActive ? 1/2 : 1/3;
      const moneyChance = 1/3;            

      const roll = Math.random();    
      if (roll < blobChance) {
        const blob = await this.client.db.getRandomWeightedBlob(connection);
        await this.client.db.acknowledgeBlob(connection, message.guild.id, message.author.id, blob.unique_id);

        // Pokeballs are filtered from the user's inventory, and sorted least effective first.
        // By default, the least effective ball is always used.
        const userPokeBalls = (await this.client.db.getUserInventory(connection, message.guild.id, message.author.id)).filter(x => x.mode === 1 && x.amount > 0).sort((x, y) => x.potential - y.potential);

        if (userPokeBalls.length === 0) {
          return msg.edit(`_${message.author} ${searchText}..._ a ${blob.rarity_name} <:${blob.emoji_name}:${blob.emoji_id}> (${blob.emoji_name})**!** You have ${energy-1} energy remaining.\nSadly, you don't have any PokeBalls, so you have no choice but to let this one run away.\n\n\`${settings.prefix}search\` to continue looking (1 energy)\n\`${settings.prefix}cancel\` to stop searching`); // eslint-disable-line no-undef
        }

        let catchDesc;
        if (userPokeBalls.length > 1) {
          const otherDesc = userPokeBalls.slice(1).map(x => `\`${settings.prefix}catch ${x.name}\` to use your ${x.name},`).join('\n');
          catchDesc = `${otherDesc}\nor type just \`${settings.prefix}catch\` to use your ${userPokeBalls[0].name}.\n`;
        } else {
          catchDesc = `Type \`${settings.prefix}catch\` to use your ${userPokeBalls[0].name}.`;
        }

        msg.edit(`_${message.author} ${searchText}..._ a ${blob.rarity_name} <:${blob.emoji_name}:${blob.emoji_id}> (${blob.emoji_name})**!** You have ${energy-1} energy remaining.\n${catchDesc}\n\`${settings.prefix}search\` to let this blob run away and continue looking (1 energy)\n\`${settings.prefix}cancel\` to let the blob run away and stop searching`); // eslint-disable-line no-undef

        const transform = s => s.toLowerCase().replace(/ /g, '');
        const pokeBallNames = userPokeBalls.map(x => transform(x.name)).concat(['']);
        
        const re = new RegExp(`^${escapedPrefix}(catch|cancel|search)(.*)$`);
        const filter = m => (m.author.id === message.author.id && re.test(m.content) && pokeBallNames.includes(transform(re.exec(m.content)[2])));

        let response;
        try {
          response = re.exec((await message.channel.awaitMessages(filter, { max: 1, time: 60000, errors: ['time'] })).first().content);
        } catch (e) {
          return;
        }

        if (response[1] === 'catch') {
          const ballUsed = transform(response[2]) === '' ? userPokeBalls[0] : userPokeBalls[pokeBallNames.indexOf(transform(response[2]))];

          await connection.query('BEGIN');
          const consumed = await this.client.db.removeUserItem(connection, message.guild.id, message.author.id, ballUsed.item_id, 1);
          if (!consumed) {
            await connection.query('ROLLBACK');
            return message.channel.send(`You try to use your ${ballUsed.name}, but for some reason it's disappeared from you. Did you use it elsewhere?`);
          } else {
            const successChance = ballUsed.potential / 100;
            const catchRoll = Math.random();
            if (catchRoll < successChance) {
              await this.client.db.giveUserBlob(connection, message.guild.id, message.author.id, blob.unique_id, 1);
              await connection.query('COMMIT');
              return message.channel.send(`You captured the **${blob.rarity_name}** <:${blob.emoji_name}:${blob.emoji_id}> with your ${ballUsed.name}!\n\`${settings.prefix}search\` to look for more (1 energy)`);
            } else {
              await connection.query('COMMIT');
              return message.channel.send(`You try to use your ${ballUsed.name}, but the <:${blob.emoji_name}:${blob.emoji_id}> breaks free and runs away! You have ${energy-1} energy remaining.\n\`${settings.prefix}search\` to continue looking (1 energy)`);
            }
          }
        }
      }
      else if (roll >= blobChance && roll < blobChance + moneyChance) {
        const money = Math.ceil(Math.random()*10);
        await this.client.db.giveUserCurrency(connection, message.guild.id, message.author.id, money);
        msg.edit(`_${message.author} ${searchText}..._ ${money} 💰**!** You have ${energy-1} energy remaining.\n\`${settings.prefix}search\` continue looking (1 energy).`); // eslint-disable-line no-undef
      }
      else {
        msg.edit(`_${message.author} ${searchText}..._ nothing**!** You have ${energy-1} energy remaining.\n\`${settings.prefix}search\` to continue looking (1 energy).`); // eslint-disable-line no-undef
      }
    } finally {
      connection.release();
    }
  }
}

module.exports = Search;
