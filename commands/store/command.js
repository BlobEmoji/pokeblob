
const CommandBaseClass = require('../CommandBaseClass.js');

const { Collection } = require('discord.js');

class Store extends CommandBaseClass {
  constructor(...args) {
    super(...args);

    this.meta = {
      name: 'store',
      aliases: ['shop'],
      category: 'meta.help.categories.pokeblobs',
      description: 'meta.help.commands.store'
    };
  }

  async run(context) {
    const { client, connection, splitArgs } = context;

    const userData = await connection.memberData(context.member);
    const _ = (...x) => client.localize(userData.locale, ...x);
    const _r = (...x) => client.localizeRandom(userData.locale, ...x);

    if (userData.state[1] === '1')
      return await context.send(_('commands.store.busy'));

    if (!userData.loc_has_shop)
      if (userData.state[0] === '1')
        return await context.send(_('commands.store.none_roaming', { PREFIX: context.prefix }));
      else
        return await context.send(_('commands.store.none', { PREFIX: context.prefix }));

    if (userData.loc_strange)
      return await context.send(_('commands.store.strange'));

    switch (splitArgs[0]) {
      case ('buy'):
      case ('purchase'): {
        context.log('silly', 'user is buying');

        const itemSelectData = await this.handleParseItem(_, context, userData, splitArgs);

        if (!itemSelectData)
          return await context.send(_('commands.store.no_match_buy'));

        const { item, amount } = itemSelectData;

        if (!item.available)
          return await context.send(_('commands.store.no_stock'));

        if (amount === 0)
          return await context.send(_r('commands.store.no_zero_buy'));

        if (amount < 0)
          return await context.send(_('commands.store.no_negative_buy', { PREFIX: context.prefix }));

        if (userData.currency < item.actual_price)
          return await context.send(_('commands.store.no_money'));

        const cost = (item.actual_price * amount);
        if (userData.currency < cost)
          return await context.send(_('commands.store.no_money'));

        // if they've gotten this far, the item is valid, has a reasonable amount and they have the money

        context.log('silly', 'engaging user..');
        await connection.setEngaged(context.member, true);

        const itemName = _(item.name, { AMOUNT: amount });

        const confirmText = [
          _('commands.store.confirm_buy.message', { ITEM: itemName, COST: cost, COINEMOJI: client.config.coin_emoji }),
          _('commands.store.confirm_buy.confirm', { PREFIX: context.prefix }),
          _('commands.store.confirm_buy.cancel', { PREFIX: context.prefix })
        ].join('\n');
        const confirmMessage = await context.send(confirmText);

        const responses = [`${context.prefix}confirm`, `${context.prefix}cancel`];
        let response;
        try {
          response = (await context.channel.awaitMessages(m => (m.author.id === context.author.id && responses.includes(m.content)), { max: 1, time: 120000, errors: ['time'] })).first();
        } catch (e) {
          // user probably got bored lol
          return;
        } finally {
          await connection.setEngaged(context.member, false);
          await confirmMessage.delete();
        }

        if (response.content === `${context.prefix}confirm`) {
          const transaction = await connection.transaction();
          try {
            const newData = await connection.modifyCoinsTracked(context.member, -cost);
            await connection.giveUserItem(context.member, item.id, amount);
            await transaction.commit();
            context.log('info', `user ${context.member.id}@${context.guild.id} bought item ${amount}x ${item.id} for ${cost} coins`);
            return await context.send(_('commands.store.complete', { CURRENCY: newData.currency, COINEMOJI: client.config.coin_emoji }));
          } catch (e) {
            return await context.send(_('commands.store.no_complete.buy'));
          } finally {
            await transaction.dispose();
          }
        }

        break;
      }

      case ('sell'): {
        context.log('silly', 'user is selling');

        const itemSelectData = await this.handleParseItem(_, context, userData, splitArgs);

        if (!itemSelectData)
          return await context.send(_('commands.store.no_match_sell'));

        const { item, amount } = itemSelectData;

        const userItem = (await connection.getUserItems(context.member)).find(x => x.id === item.id && x.amount > 0);

        if (!userItem)
          return await context.send(_('commands.store.no_have_item'));

        if (amount === 0)
          return await context.send(_r('commands.store.no_zero_sell'));

        if (amount < 0)
          return await context.send(_('commands.store.no_negative_sell', { PREFIX: context.prefix }));

        if (userItem.amount < amount)
          return await context.send(_('commands.store.not_enough_item'));

        const gain = Math.floor(item.actual_price * amount * (userData.roaming_effect ? 0.7 : 0.5));

        // if they've gotten this far, the item is valid, has a reasonable amount and they have that amount

        context.log('silly', 'engaging user..');
        await connection.setEngaged(context.member, true);

        const itemName = _(item.name, { AMOUNT: amount });

        const confirmText = [
          _('commands.store.confirm_sell.message', { ITEM: itemName, GAIN: gain, COINEMOJI: client.config.coin_emoji }),
          _('commands.store.confirm_sell.confirm', { PREFIX: context.prefix }),
          _('commands.store.confirm_sell.cancel', { PREFIX: context.prefix })
        ].join('\n');
        const confirmMessage = await context.send(confirmText);

        const responses = [`${context.prefix}confirm`, `${context.prefix}cancel`];
        let response;
        try {
          response = (await context.channel.awaitMessages(m => (m.author.id === context.author.id && responses.includes(m.content)), { max: 1, time: 120000, errors: ['time'] })).first();
        } catch (e) {
          // user probably got bored lol
          return;
        } finally {
          await connection.setEngaged(context.member, false);
          await confirmMessage.delete();
        }

        if (response.content === `${context.prefix}confirm`) {
          const transaction = await connection.transaction();
          try {
            await connection.takeUserItem(context.member, item.id, amount);
            const newData = await connection.modifyCoinsTracked(context.member, gain);
            await transaction.commit();
            context.log('info', `user ${context.member.id}@${context.guild.id} sold item ${amount}x ${item.id} for ${gain} coins`);
            return await context.send(_('commands.store.complete', { CURRENCY: newData.currency, COINEMOJI: client.config.coin_emoji }));
          } catch (e) {
            return await context.send(_('commands.store.no_complete.sell'));
          } finally {
            await transaction.dispose();
          }
        }

        break;
      }
      
      default: {
        context.log('silly', 'user is viewing');

        const outputListing = [];

        outputListing.push(_('commands.store.enter'));

        if (userData.roaming_effect && userData.loc_store_potential % 3 === 0)
          outputListing.push(_('commands.store.effect'));

        if (userData.energy !== 0 && userData.quarter_remaining > 0.8)
          if (userData.state[0] === '1')
            outputListing.push(_('commands.store.warn_moving'));
          else if (userData.roaming_effect)
            outputListing.push(_('commands.store.warn_effect'));

        const storeItems = (await connection.getStoreItems(userData.loc_store_potential, userData.roaming_effect)).filter(x => x.available);

        const formattedItems = storeItems.map(x => _('commands.store.listing', { ITEM: _(x.name, { AMOUNT: 'concept' }), AMOUNT: x.actual_price, COINEMOJI: client.config.coin_emoji }));

        outputListing.push(''); // blank line
        formattedItems.map(x => outputListing.push(x)); // cheat way of loading them into the formatting list

        outputListing.push(_('commands.store.buy_help', { PREFIX: context.prefix }));
        outputListing.push(_('commands.store.sell_help', { PREFIX: context.prefix }));

        return await context.send(outputListing.join('\n'));
      }
    }
  }

  async handleParseItem(_, context, userData, args) {
    const storeItems = await context.connection.getStoreItems(userData.loc_store_potential, userData.roaming_effect);
    const itemLookup = new Collection();

    const clean = (x => x ? x.toLowerCase().replace(/ +/g, '') : null);

    storeItems.map(x => {
      // add all types for lookup
      itemLookup.set(clean(_(x.name, { AMOUNT: 'mass' })), x);
      itemLookup.set(clean(_(x.name, { AMOUNT: 'singular' })), x);
      itemLookup.set(clean(_(x.name, { AMOUNT: 'concept' })), x);
    });

    const re = /^(-?\d+)?(?:(.+)(-?\d+)|(.+))$/g;
    const match = re.exec(args.slice(1).join(' ').trim());

    if (!match)
      return await context.send(_('commands.store.unsure_buy'));

    let item, amount;

    if (itemLookup.has(clean(match[0]))) {
      // entire args, for stuff like '-store buy basic ball'
      item = itemLookup.get(clean(match[0]));
      amount = 1;
    } else if (itemLookup.has(clean(match[2]))) {
      // amount-final args, like '-store buy basic ball 3'
      item = itemLookup.get(clean(match[2]));
      amount = parseInt(clean(match[3]));
      amount = !isNaN(amount) ? amount : 1;
    } else if (itemLookup.has(clean(match[4]))) {
      // amount-initial args, like '-store buy 3 basic ball'
      item = itemLookup.get(clean(match[4]));
      amount = parseInt(clean(match[1]));
      amount = !isNaN(amount) ? amount : 1;
    } else {
      // no idea
      return null;
    }

    return { item, amount };
  }
}

module.exports = Store;
