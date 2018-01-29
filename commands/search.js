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
    this.activeSearches = new Map();
  }

  formCatchDescription(pokeBalls, energy, settings) {
    if (pokeBalls.length === 0) {
      return { allowCapture: false, description: `You have ${energy-1} energy remaining.\nSadly, you don't have any PokeBalls left, so you have no choice but to let this one run away.\n\n\`${settings.prefix}search\` to continue looking (1 energy)\n\`${settings.prefix}cancel\` to stop searching` };
    }

    let catchDesc;
    if (pokeBalls.length > 1) {
      const otherDesc = pokeBalls.slice(1).map(x => `\`${settings.prefix}catch ${x.name}\` to use your ${x.name} (${x.amount} remaining),`).join('\n');
      catchDesc = `${otherDesc}\nor type just \`${settings.prefix}catch\` to use your ${pokeBalls[0].name} (${pokeBalls[0].amount} remaining).\n`;
    } else {
      catchDesc = `Type \`${settings.prefix}catch\` to use your ${pokeBalls[0].name} (${pokeBalls[0].amount} remaining).`;
    }

    return { allowCapture: true, description: `You have ${energy-1} energy remaining.\n${catchDesc}\n\`${settings.prefix}search\` to let this blob run away and continue looking (1 energy)\n\`${settings.prefix}cancel\` to let the blob run away and stop searching` };
  }

  async waitForCatchResponse(message, pokeBalls, escapedPrefix) {
    const transform = s => s.toLowerCase().replace(/ /g, '');
    const pokeBallNames = pokeBalls.map(x => transform(x.name)).concat(['']);

    const re = new RegExp(`^${escapedPrefix}(catch|cancel|search)(.*)$`);
    const filter = m => (m.author.id === message.author.id && re.test(m.content) && pokeBallNames.includes(transform(re.exec(m.content)[2])));

    let response;
    try {
      response = re.exec((await message.channel.awaitMessages(filter, { max: 1, time: 120000, errors: ['time'] })).first().content);
    } catch (e) {
      return { threwBall: false, usedBall: null };
    }

    if (response[1] === 'catch') {
      const ballUsed = transform(response[2]) === '' ? pokeBalls[0] : pokeBalls[pokeBallNames.indexOf(transform(response[2]))];
      return { threwBall: true, usedBall: ballUsed };
    } else {
      return { threwBall: false, usedBall: null };
    }
  }

  calculateCatchChance(pokeBall, blob) {
    const b = pokeBall.potential;
    const r = blob.rarity_scalar;

    // magic do not touch
    return Math.max(Math.min((5.8 * 10**-5) * r**2 + (-0.01) * r + (4.8 * 10**-5) * b**2 + (0.004) * b + (0.5), 1), 0);
  }

  async run(message, args, level) { // eslint-disable-line no-unused-vars
    if (this.activeSearches.has(message.author.id))
      return;

    this.activeSearches.set(message.author.id);

    const settings = message.settings;
    const connection = await this.client.db.acquire();
    const escapedPrefix = settings.prefix.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');

    try {
      const { energy } = await this.client.db.ensureMember(connection, message.guild.id, message.author.id);

      if (energy <= 0) {
        await message.channel.send(`${message.author} Not enough energy...`);
        return;
      }

      await this.client.db.modifyMemberEnergy(connection, message.guild.id, message.author.id, -1);

      await this.client.db.bumpSearchCount(connection, message.guild.id, message.author.id);
      const activeEffects = await this.client.db.consumeUserEffects(connection, message.guild.id, message.author.id, 1);
      const lureActive = activeEffects.filter(x => x.effect_id === 1)[0];

      const searchText = lureActive ? `walks through the tall grass with their Blob Lure (${lureActive.life} remaining) and finds` : 'searches through the tall grass and finds';
      let msg = await message.channel.send(`_${message.author} ${searchText}..._`);

      await this.client.wait(2500);

      message.delete({ timeout: 5000 }).catch(() => {});

      const blobChance = lureActive ? 2/3 : 1/3;
      const moneyChance = lureActive ? 3/12 : 1/3;

      const roll = Math.random();
      if (roll < blobChance) {
        const blob = await this.client.db.getRandomWeightedBlob(connection);
        const hasBlob = (await this.client.db.acknowledgeBlob(connection, message.guild.id, message.author.id, blob.unique_id)).amount > 0;

        // Pokeballs are filtered from the user's inventory, and sorted least effective first.
        // By default, the least effective ball is always used.
        let userPokeBalls = (await this.client.db.getUserInventory(connection, message.guild.id, message.author.id)).filter(x => x.mode === 1 && x.amount > 0).sort((x, y) => x.potential - y.potential);

        const { allowCapture, description } = this.formCatchDescription(userPokeBalls, energy, settings);

        await msg.edit(`_${message.author} ${searchText}..._ ${blob.rarity_name.charAt(0) === 'u' ? 'an' : 'a'} ${blob.rarity_name} <:${blob.emoji_name}:${blob.emoji_id}> (${blob.emoji_name})**!**${hasBlob ? ' *(already owned)*' : ''} ${description}`); // eslint-disable-line no-undef

        if (!allowCapture) return;

        // no longer lock starting a new search (as this is one of the options of this interaction)
        this.activeSearches.delete(message.author.id);

        let { threwBall, usedBall } = await this.waitForCatchResponse(message, userPokeBalls, escapedPrefix);

        if (!threwBall) return;

        // the user didn't cancel or search-by; re-engage lock
        this.activeSearches.set(message.author.id);

        await connection.query('BEGIN');
        const consumed = await this.client.db.removeUserItem(connection, message.guild.id, message.author.id, usedBall.item_id, 1);

        if (!consumed) {
          await connection.query('ROLLBACK');
          msg.delete({ timeout: 5000 });
          return message.channel.send(`${message.author} You try to use your ${usedBall.name}, but for some reason it's disappeared from you. Did you use it elsewhere?`);
        }

        let successChance = this.calculateCatchChance(usedBall, blob);
        let catchRoll = Math.random();

        if (catchRoll < successChance) {
          await this.client.db.giveUserBlob(connection, message.guild.id, message.author.id, blob.unique_id, 1);
          await connection.query('COMMIT');
          msg.delete({ timeout: 5000 });
          return message.channel.send(`${message.author} You captured the **${blob.rarity_name}** <:${blob.emoji_name}:${blob.emoji_id}> with your ${usedBall.name}!\n\`${settings.prefix}search\` to look for more (1 energy)`);
        }

        // user didn't capture the blob, time to see if we're giving them a second chance
        await connection.query('COMMIT'); // first destroy their first ball

        const retryRoll = Math.random();
        if (retryRoll < (2 / 3)) {
          // user gets another chance... this time.

          // update our knowledge of their pokeballs
          userPokeBalls = (await this.client.db.getUserInventory(connection, message.guild.id, message.author.id)).filter(x => x.mode === 1 && x.amount > 0).sort((x, y) => x.potential - y.potential);

          const { allowCapture: aC2, description: desc2 } = this.formCatchDescription(userPokeBalls, energy, settings);

          msg.delete({ timeout: 5000 });
          msg = await message.channel.send(`${message.author} You try to use your ${usedBall.name}, but the <:${blob.emoji_name}:${blob.emoji_id}>${hasBlob ? ' *(already owned)*' : ''} breaks free. ${desc2}`);

          if (!aC2) return;

          // release lock again for second catch
          this.activeSearches.delete(message.author.id);

          const { threwBall: tB2, usedBall: uB2 } = await this.waitForCatchResponse(message, userPokeBalls, escapedPrefix);

          if (!tB2) return;

          // we reassign here so that the failure text below uses the right ball
          threwBall = tB2, usedBall = uB2;

          // start new transaction for handling second ball
          await connection.query('BEGIN');
          const consumed2 = await this.client.db.removeUserItem(connection, message.guild.id, message.author.id, usedBall.item_id, 1);

          if (!consumed2) {
            await connection.query('ROLLBACK');
            msg.delete({ timeout: 5000 });
            return message.channel.send(`${message.author} You try to use your ${usedBall.name}, but for some reason it's disappeared from you. Did you use it elsewhere?`);
          }

          successChance = this.calculateCatchChance(usedBall, blob);
          catchRoll = Math.random();

          if (catchRoll < successChance) {
            await this.client.db.giveUserBlob(connection, message.guild.id, message.author.id, blob.unique_id, 1);
            await connection.query('COMMIT');
            msg.delete({ timeout: 5000 });
            return message.channel.send(`${message.author} You captured the **${blob.rarity_name}** <:${blob.emoji_name}:${blob.emoji_id}> with your ${usedBall.name}!\n\`${settings.prefix}search\` to look for more (1 energy)`);
          }

          // unlucky, commit to destroy the second ball
          await connection.query('COMMIT');
        }

        msg.delete({ timeout: 5000 });
        return message.channel.send(`${message.author} You try to use your ${usedBall.name}, but the <:${blob.emoji_name}:${blob.emoji_id}> breaks free and runs away! You have ${energy-1} energy remaining.\n\`${settings.prefix}search\` to continue looking (1 energy)`);
      }
      else if (roll >= blobChance && roll < blobChance + moneyChance) {
        const money = Math.ceil(Math.random()*10);
        const updatedUser = await this.client.db.giveUserCurrency(connection, message.guild.id, message.author.id, money);
        msg.edit(`_${message.author} ${searchText}..._ ${money} <:blobcoin:386630453224013824>**!** You now have a total of ${updatedUser.currency} <:blobcoin:386630453224013824> with ${energy-1} energy remaining.\n\`${settings.prefix}search\` continue looking (1 energy).`); // eslint-disable-line no-undef
      }
      else {
        msg.edit(`_${message.author} ${searchText}..._ nothing**!** You have ${energy-1} energy remaining.\n\`${settings.prefix}search\` to continue looking (1 energy).`); // eslint-disable-line no-undef
      }
    } finally {
      this.activeSearches.delete(message.author.id);
      this.client.db.updateMilestonesBackground(message.channel, message.guild.id, message.author.id);
      connection.release();
    }
  }
}

module.exports = Search;
