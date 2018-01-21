const Command = require('../base/Command.js');
const { Collection, MessageEmbed } = require('discord.js');

class Trade extends Command {
  constructor(client) {
    super(client, {
      name: 'trade',
      description: 'Starts interactive trade with a user.',
      category: 'Pokéblob',
      usage: 'trade <user>',
      guildOnly: true,
      extended: 'Trade one of your blobs for one of another users blobs. This requires the other user to accept the trade.',
      botPerms: ['SEND_MESSAGES'],
      permLevel: 'User'
    });
    this.activeTrades = new Map();
  }

  async run(message, args, level) { // eslint-disable-line no-unused-vars
    if (this.activeTrades.has(message.author.id))
      return message.channel.send('Finish your active trade first, then we can talk.');

    const allArgs = args.join(' ').trim();
    const firstMention = message.mentions.members.first();
    let parseID;
    if (!isNaN(allArgs)) parseID = message.guild.member(allArgs);
    const correspondent = (firstMention) ? firstMention : parseID;

    if (!correspondent)
      return message.channel.send('I don\'t understand who you\'re trying to trade with. Try using their mention.');

    if (correspondent.user.id === message.author.id)
      return message.channel.send(`${message.author}, don't you think it's time you got some real friends to trade with?`);

    if ((new Date() - message.member.joinedAt) < 604800000)
      return message.channel.send('You haven\'t been in the server long enough to initiate trades yet.');

    if ((new Date() - correspondent.joinedAt) < 604800000)
      return message.channel.send('That person hasn\'t been in the server long enough to engage in trades yet.');
    
    const settings = message.settings;
    const connection = await this.client.db.acquire();

    this.activeTrades.set(message.author.id);

    try {
      const initiaterBlobs = await this.client.db.getUserBlobs(connection, message.guild.id, message.author.id);
      const correspondentBlobs = await this.client.db.getUserBlobs(connection, message.guild.id, correspondent.user.id);

      if (initiaterBlobs.filter(x => x.caught).length < 5)
        return message.channel.send('You don\'t have enough blob-catching experience to engage in trades yet.');

      if (correspondentBlobs.filter(x => x.caught).length < 5)
        return message.channel.send('That person hasn\'t had enough blob-catching experience to trade with you yet.');

      const state = {
        offerItems: new Collection(),
        offerBlobs: new Collection(),
        offerCoins: 0,
        requestItems: new Collection(),
        requestBlobs: new Collection(),
        requestCoins: 0,
        finished: false,
        continue: false,
        timeout: false
      };
      
      let tradeMsg = null;

      const mainDesc = `\`${settings.prefix}<offer|request>blob [blob]\` to offer/request a blob.\n\`${settings.prefix}<offer|request>item [item]\` to offer/request an item.\n\`${settings.prefix}<offer|request>coins [amount]\` to offer/request coins.\n\n\`${settings.prefix}confirm\` if you're ready to trade.\n\`${settings.prefix}cancel\` to cancel this offer.`;

      while (!state.finished) {
        if (tradeMsg)
          tradeMsg.delete();
        
        const tradeEmbed = this.makeTradeEmbed(message, state).setDescription(`Setting up trade with ${correspondent.user} (${correspondent.user.tag})..\n\n${mainDesc}`);
        tradeMsg = await message.channel.send({ embed: tradeEmbed });

        await this.processInteractive(connection, message, state);
      }

      if (tradeMsg)
        tradeMsg.delete();

      if (!state.continue)
        if (state.timeout)
          return message.channel.send(`${message.author} Your pending trade timed out.`);
        else
          return message.channel.send('Trade cancelled.');
      
      if (Math.max.apply(null, [state.offerItems.size, state.offerBlobs.size, state.offerCoins, state.requestItems.size, state.requestBlobs.size, state.requestCoins]) === 0)
        return message.channel.send('Trade completed. It actually didn\'t, but nothing would have happened if it had anyway.');

      await message.channel.send(`${correspondent.user}, ${message.author} wants to trade with you.\n\`${settings.prefix}accept\` to accept, \n\`${settings.prefix}decline\` to decline.`, { embed: this.makeTradeEmbed(message, state).setDescription(`Wants to trade with ${correspondent.user} (${correspondent.user.tag})`) });

      const responseFilter = m => (m.author.id === correspondent.user.id && [`${settings.prefix}accept`, `${settings.prefix}decline`].includes(m.content));

      let responseMessage;
      try {
        responseMessage = (await message.channel.awaitMessages(responseFilter, { max: 1, time: 60000, errors: ['time'] })).first().content;
      } catch (e) {
        return message.channel.send(`${message.author} Your trade didn't complete because your partner took too long.`);
      }

      if (responseMessage === `${settings.prefix}accept`) {
        const complaint = await this.attemptPerformTrade(connection, message, state, correspondent);
        if (complaint)
          return message.channel.send(`The trade couldn't be completed: ${complaint}`);
        else
          return message.channel.send(`${message.author} Your trade with ${correspondent.user} completed successfully.`);
      } else {
        return message.channel.send(`${message.author} Your trade was declined.`);
      }
    } finally {
      connection.release();
      this.activeTrades.delete(message.author.id);
      this.client.db.updateMilestonesBackground(message.channel, message.guild.id, message.author.id);
      this.client.db.updateMilestonesBackground(message.channel, message.guild.id, correspondent.user.id);
    }
  }

  makeTradeEmbed(message, state) {
    var embed = new MessageEmbed()
      .setAuthor(message.author.username, message.author.displayAvatarURL())
      .setTimestamp()
      .setFooter('PokéBlobs');

    let offersList = [];
    let requestsList = [];

    if (state.offerCoins !== 0)
      offersList.push(`**${state.offerCoins}** <:blobcoin:398579309276823562>`);
    if (state.requestCoins !== 0)
      requestsList.push(`**${state.requestCoins}** <:blobcoin:398579309276823562>`);

    offersList = offersList.concat(state.offerBlobs.filter(x => x.amount > 0).map(x => `${x.amount}x <:${x.definition.emoji_name}:${x.definition.emoji_id}>`));
    requestsList = requestsList.concat(state.requestBlobs.filter(x => x.amount > 0).map(x => `${x.amount}x <:${x.definition.emoji_name}:${x.definition.emoji_id}>`));

    offersList = offersList.concat(state.offerItems.filter(x => x.amount > 0).map(x => `${x.amount}x ${x.definition.name}`));
    requestsList = requestsList.concat(state.requestItems.filter(x => x.amount > 0).map(x => `${x.amount}x ${x.definition.name}`));

    const offerFormatting = (offersList.length > 0) ? offersList.join(', ') : 'Nothing';
    const requestFormatting = (requestsList.length > 0) ? requestsList.join(', ') : 'Nothing';

    if (offersList.length === 0 && requestsList.length > 0)
      // potentially dodgy trade?
      embed = embed.setColor([255, 0, 0]);

    embed = embed.addField('Offering', offerFormatting).addField('Requesting', requestFormatting);

    return embed;
  }

  async processInteractive(connection, message, state) {
    const escapedPrefix = message.settings.prefix.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
    const interactivityRegex = new RegExp(`^${escapedPrefix}(confirm|cancel|(offer|request)(item|blob|coin)s?)(.*)$`);

    const filter = m => (m.author.id === message.author.id && interactivityRegex.test(m.content));

    let response;
    try {
      response = interactivityRegex.exec((await message.channel.awaitMessages(filter, { max: 1, time: 45000, errors: ['time'] })).first().content);
    } catch (e) {
      state.finished = true;
      state.timeout = true;
      return;
    }

    // full command name, directly after prefix
    switch (response[1]) {
      case ('confirm') : {
        // stop here and begin trade confirmation
        state.finished = true;
        state.continue = true;
        return;
      }

      case ('cancel'): {
        // stop here but don't continue
        state.finished = true;
        return;
      }

      // not confirm or cancel so must be add/remove
      default: {

        // the second half of the command name, as in -offer<<item>>, etc
        switch (response[3]) {
          case ('item'): {
            // check this item exists and get its data
            const { name, amount } = this.detectAmount(response[4]);

            if (amount < 0)
              return message.channel.send(`Can't ${response[2]} less than none of an item.`);
            if (amount >= 100)
              return message.channel.send(`I think ${response[2]}ing THAT many is a bit too much.`);

            const relevantItem = await this.client.db.getStoreItemByName(connection, name);
            if (!relevantItem)
              return message.channel.send('Not sure what this item is.');

            const thisMap = (response[2] === 'offer' ? state.offerItems : state.requestItems);

            if (!thisMap.has(relevantItem.id) && thisMap.size >= 8)
              return message.channel.send(`Too many items ${response[2]}ed already. You can remove one by typing \`${message.settings.prefix}${response[2]}item <item> 0\`.`);

            if (amount > 0)
              thisMap.set(relevantItem.id, { amount: amount, definition: relevantItem });
            else
              thisMap.delete(relevantItem.id);
            
            return;
          }

          case ('blob'): {
            // check this blob exists and get its data
            const { name, amount } = this.detectAmount(response[4]);

            if (amount < 0)
              return message.channel.send(`Can't ${response[2]} less than none of a blob.`);
            if (amount >= 100)
              return message.channel.send(`I think ${response[2]}ing THAT many is a bit too much.`);

            const relevantBlob = await this.client.db.getBlobByName(connection, name);
            if (!relevantBlob)
              return message.channel.send('Not sure what this blob is.');

            const thisMap = (response[2] === 'offer' ? state.offerBlobs : state.requestBlobs);

            if (!thisMap.has(relevantBlob.unique_id) && thisMap.size >= 8)
              return message.channel.send(`Too many blobs ${response[2]}ed already. You can remove one by typing \`${message.settings.prefix}${response[2]}blob <blob> 0\`.`);

            if (amount > 0)
              thisMap.set(relevantBlob.unique_id, { amount: amount, definition: relevantBlob });
            else
              thisMap.delete(relevantBlob.unique_id);
            
            return;
          }

          case ('coin'): {
            // check this amount is valid
            const relevantCoins = parseInt(response[4]);
            if (isNaN(relevantCoins) || relevantCoins < 0)
              return message.channel.send('Please use a valid amount of coins.');

            if (relevantCoins >= 100000)
              return message.channel.send('I would avoid crashing the economy right now.');

            switch (response[2]) {
              case ('offer'): {
                state.offerCoins = relevantCoins;
                return;
              }
              default: {
                state.requestCoins = relevantCoins;
                return;
              }
            }
          }
        }
      }
    }
  }

  detectAmount(text) {
    const args = text.split(' ');
    const maybeAmount = parseInt(args[args.length - 1]);
    if (isNaN(maybeAmount)) {
      return {amount: 1, name: text};
    } else {
      return {amount: maybeAmount, name: args.slice(0, -1).join(' ')};
    }
  }

  async attemptPerformTrade(connection, message, state, correspondent) {
    await connection.query('BEGIN');
    let ok = false;
    try {
      // coins
      if (state.offerCoins) {
        if (!(await this.client.db.takeUserCurrency(connection, message.guild.id, message.author.id, state.offerCoins)))
          return `${message.author} does not have ${state.offerCoins} coin(s).`;
        await this.client.db.giveUserCurrency(connection, message.guild.id, correspondent.user.id, state.offerCoins);
      }

      if (state.requestCoins) {
        if (!(await this.client.db.takeUserCurrency(connection, message.guild.id, correspondent.user.id, state.requestCoins)))
          return `${correspondent.user} does not have ${state.requestCoins} coin(s).`;
        await this.client.db.giveUserCurrency(connection, message.guild.id, message.author.id, state.requestCoins);
      }

      // items
      if (state.offerItems.size > 0)
        for (const itemSet of state.offerItems.values()) {
          if (!(await this.client.db.removeUserItem(connection, message.guild.id, message.author.id, itemSet.definition.id, itemSet.amount)))
            return `${message.author} does not have ${itemSet.amount}x ${itemSet.definition.name}`;
          await this.client.db.giveUserItem(connection, message.guild.id, correspondent.user.id, itemSet.definition.id, itemSet.amount);
        }

      if (state.requestItems.size > 0)
        for (const itemSet of state.requestItems.values()) {
          if (!(await this.client.db.removeUserItem(connection, message.guild.id, correspondent.user.id, itemSet.definition.id, itemSet.amount)))
            return `${correspondent.user.id} does not have ${itemSet.amount}x ${itemSet.definition.name}`;
          await this.client.db.giveUserItem(connection, message.guild.id, message.author.id, itemSet.definition.id, itemSet.amount);
        }

      // blobs
      if (state.offerBlobs.size > 0)
        for (const blobSet of state.offerBlobs.values()) {
          if (!(await this.client.db.takeUserBlob(connection, message.guild.id, message.author.id, blobSet.definition.unique_id, blobSet.amount)))
            return `${message.author} does not have ${blobSet.amount}x <:${blobSet.definition.emoji_name}:${blobSet.definition.emoji_id}>`;
          await this.client.db.giveUserBlob(connection, message.guild.id, correspondent.user.id, blobSet.definition.unique_id, blobSet.amount);
        }

      if (state.requestBlobs.size > 0)
        for (const blobSet of state.requestBlobs.values()) {
          if (!(await this.client.db.takeUserBlob(connection, message.guild.id, correspondent.user.id, blobSet.definition.unique_id, blobSet.amount)))
            return `${correspondent.user.id} does not have ${blobSet.amount}x <:${blobSet.definition.emoji_name}:${blobSet.definition.emoji_id}>`;
          await this.client.db.giveUserBlob(connection, message.guild.id, message.author.id, blobSet.definition.unique_id, blobSet.amount);
        }

      ok = true;
    } finally {
      if (!ok)
        await connection.query('ROLLBACK');
      else
        await connection.query('COMMIT');
    }
  }
}

module.exports = Trade;
