
const CommandBaseClass = require('../CommandBaseClass.js');

const { Collection } = require('discord.js');

class Search extends CommandBaseClass {
  constructor(...args) {
    super(...args);

    this.meta = {
      name: 'search',
      category: 'meta.help.categories.pokeblobs',
      description: 'meta.help.commands.search'
    };
  }

  async run(context) {
    const { message, client, connection } = context;

    context.log('silly', 'acquiring user data for search..');
    const userData = await connection.memberData(context.member);
    const _ = (...x) => client.localize(userData.locale, ...x);
    const _r = (...x) => client.localizeRandom(userData.locale, ...x);
    context.log('silly', 'got user data');

    message.delete({ timeout: 2500 }).catch(() => {});

    if (userData.state[1] === '1')
      // user is engaged
      return await context.send(_('commands.search.busy'));

    if (userData.energy === 0)
      return await context.send(_('commands.search.no_energy'));

    context.log('silly', 'engaging user..');
    await connection.setEngaged(context.member, true);

    try {
      await connection.modifyEnergy(context.member, -1);
      await connection.modifySearchCount(context.member, 1);

      context.log('silly', 'sending wait message');
      const msg = await context.send(_('commands.search.search_wait', { USER: context.member }));
      await client.wait(2500);

      context.log('silly', 'done waiting');

      const blobChance = 1 / 3;
      const moneyChance = 1 / 3;

      const roll = Math.random();

      if (roll < blobChance) {
        context.log('silly', 'rolled blob');
        const blob = await connection.getRandomWeightedBlob(userData.loc_search_potential, userData.roaming_effect);
        context.log('silly', `blob appeared: ${blob.id}`);

        let attempt = 0;
        let lastMsg = msg;
        const chance = userData.roaming_effect ? 0.65 : 0.5;

        // progressively reduce chances of being able to try again
        while ((Math.random() < chance ** attempt) && attempt < 4) {
          const { canContinue, resultMsg } = await this.catchOpportunity(context, userData, !attempt ? lastMsg : null, blob);

          attempt++;
          context.log('silly', `catch opportunity (attempt ${attempt})`);
          // remove the last message if it exists to reduce clutter
          if (lastMsg)
            lastMsg.delete({ timeout: 8000 }).catch(() => {});
          lastMsg = resultMsg;

          if (!canContinue)
            return;
        }
        context.log('silly', 'blob ran..');
        const genOpts = { USER: context.member.toString(), BLOB: `<:${blob.emoji_name}:${blob.emoji_id}>`, PREFIX: context.prefix };
        genOpts['CATCHOPTS'] = [_('commands.search.after_blob.run', genOpts), _('commands.search.search_blob.continue', genOpts)].join('\n');
        return await context.send(_r('commands.search.retry_blob.prompt', genOpts));

      } else if (roll < (blobChance + moneyChance)) {
        context.log('silly', 'rolled coin');
        // roll a coin count
        const coinAmount = Math.ceil(Math.random() * 10);
        // give them the coins
        const updatedUser = await connection.modifyCoinsTracked(context.member, coinAmount);
        if (userData.loc_strange)
          return await msg.edit(_('commands.search.search_coin_strange', { AMOUNT: coinAmount, COINEMOJI: client.config.coin_emoji, USER: context.member, TOTAL: updatedUser.currency, ENERGY: updatedUser.energy }));
        else
          return await msg.edit(_('commands.search.search_coin', { AMOUNT: coinAmount, COINEMOJI: client.config.coin_emoji, USER: context.member, TOTAL: updatedUser.currency, ENERGY: updatedUser.energy }));
      } else {
        context.log('silly', 'rolled none');
        if (userData.loc_strange)
          return await msg.edit(_('commands.search.search_lost', { USER: context.member, ENERGY: userData.energy - 1 }));
        else
          return await msg.edit(_('commands.search.search_nothing', { USER: context.member, ENERGY: userData.energy - 1 }));
      }

    } finally {
      // if a non-terminated transaction is active, dispose of it
      // this way the user won't get locked in an engaged state
      // if we didn't dispose here, turning off engagement would be part of the transaction
      // as transactions and connections are disposed on command exit, this change would therefore not go through
      // nobody wants to be locked into an engaged state
      await connection.disposeTransaction();
      await connection.setEngaged(context.member, false);
    }
  }

  async catchOpportunity(context, userData, editMessage, blob) {
    const { connection, client } = context;
    const _ = (...x) => client.localize(userData.locale, ...x);
    const _i = (...x) => client.localizeIndex(userData.locale, ...x);
    const _r = (...x) => client.localizeRandom(userData.locale, ...x);

    const blobClass = _(blob.rarity_name, { STATE: 'singular' });
    const blobEmote = `<:${blob.emoji_name}:${blob.emoji_id}>`;

    const userBalls = (await connection.getUserItems(context.member)).filter(x => x.mode === 1 && x.amount > 0);
    const userBallNames = userBalls.map(x => [_(x.name, { AMOUNT: 'concept' }), _(x.name, { AMOUNT: 'singular' })]);
    const canCatch = userBalls.length > 0;

    const opts = [];

    if (canCatch) {
      const lastBall = userBallNames.pop();

      // if the user has multiple ball types, create entry for each ball type
      if (userBallNames.length) {
        userBallNames.map(x => opts.push(_('commands.search.search_blob.catch_multi', { PREFIX: context.prefix, BALLNAME: x[0], BALL: x[1] })));
        opts.push(_('commands.search.search_blob.catch_remain', { PREFIX: context.prefix, BALL: lastBall[1] }));
      } else
        // otherwise just show the one they have with the default
        opts.push(_('commands.search.search_blob.catch_default', { PREFIX: context.prefix, BALL: lastBall[1] }));

      opts.push(''); // blank line
      opts.push(_('commands.search.search_blob.leave', { PREFIX: context.prefix }));
    } else {
      // user has no balls they can use, tell them and prompt to search again
      opts.push(_('commands.search.search_blob.catch_nope'));
      opts.push(_('commands.search.search_blob.continue', { PREFIX: context.prefix }));
    }

    // construct args to make passing this information less painful
    const passArgs = { USER: context.member.toString(), CLASS: blobClass, BLOB: blobEmote, ENERGY: userData.energy - 1, CATCHOPTS: opts.join('\n') };

    let returnMessage;

    // if this is the first catch opportunity, edit the existing message instead of making a new one
    if (editMessage)
      if (userData.loc_strange)
        await editMessage.edit(_('commands.search.search_blob.prompt_strange', passArgs));
      else
        await editMessage.edit(_('commands.search.search_blob.prompt', passArgs));
    else
      returnMessage = await context.send(_r('commands.search.retry_blob.prompt', passArgs));

    if (!canCatch)
      // if the user can't catch, terminate so they can search instead
      return {};

    const usedBall = await this.handleCatch(_, context, userBalls);

    if (!usedBall) {
      // blob was ignored ;(
      if (returnMessage)
        await returnMessage.delete();
      await context.send(_('commands.search.after_blob.run', passArgs));
      return {};
    }

    // start a transaction
    const transaction = await connection.transaction();

    try {
      await connection.takeUserItem(context.member, usedBall.id, 1);
    } catch (e) {
      await context.send(_('commands.search.after_blob.disappeared', { BALL: _(usedBall.name, { AMOUNT: 'concept' }) }));
      return {};
    }

    if (Math.random() < this.catchChance(context, usedBall, blob, userData)) {
      // woo!
      context.log('silly', 'catch attempt successful');
      // generate a blob by this definition and give it to them
      const caughtBlob = await context.connection.giveUserBlob(context.member, blob);
      context.log('info', `user ${context.member.id}@${context.guild.id} obtained blob ${caughtBlob.unique_id} (def ${blob.id}) by natural catch (used ball ${usedBall.id})`);
      // commit to destroy their ball and supply the blob
      await transaction.commit();

      passArgs['NAME'] = _i('blobs.names', caughtBlob.name_potential);

      if (returnMessage)
        await returnMessage.delete();
      // tell the user about it
      await context.send(_('commands.search.after_blob.caught', passArgs));
    } else {
      // they lost, commit to destroy their ball
      context.log('silly', 'catch attempt failed');
      await transaction.commit();
      return { canContinue: true, resultMsg: returnMessage };
    }

    return {};
  }

  async handleCatch(_, context, userBalls) {
    const itemLookup = new Collection();

    const clean = (x => x ? x.toLowerCase().replace(/ +/g, '') : null);

    // for default
    itemLookup.set(null, userBalls[userBalls.length - 1]);

    userBalls.map(x => {
      // add all types for lookup
      itemLookup.set(clean(_(x.name, { AMOUNT: 'mass' })), x);
      itemLookup.set(clean(_(x.name, { AMOUNT: 'singular' })), x);
      itemLookup.set(clean(_(x.name, { AMOUNT: 'concept' })), x);
    });

    const re = new RegExp(`^(?:${context.client.prefixRegex})(catch|ignore)(.*)$`);
    const filter = m => (m.author.id === context.author.id && re.test(m.content) && itemLookup.has(clean(re.exec(m.content)[2])));

    let response;
    try {
      response = re.exec((await context.channel.awaitMessages(filter, { max: 1, time: 60000, errors: ['time'] })).first().content);
    } catch (e) {
      // user probably got bored lol
      return;
    }

    // if the user didn't ignore, return the item definition of the ball they want to use
    if (response[1] === 'catch')
      return itemLookup.get(clean(response[2]));
  }

  catchChance(context, ball, blob, userData) {
    let b = ball.potential;
    const r = blob.rarity_scalar;

    // aqua
    if (ball.id === 5 && userData.loc_temperature <= 29 && userData.loc_humidity_potential > 80)
      b *= 2;

    // gale
    if (ball.id === 6 && userData.loc_wind_speed > 32)
      b *= 2;

    // calm
    if (ball.id === 7 && userData.loc_wind_speed <= 8)
      b *= 2;

    // desert
    if (ball.id === 8 && userData.loc_temperature > 29)
      b *= 2;

    // magic, do not touch
    const chance = Math.max(Math.min((5.8 * 10**-5) * r**2 + (-0.01) * r + (4.8 * 10**-5) * b**2 + (0.004) * b + (0.5), 1), 0);
    context.log('silly', `calculated chance using ball ${ball.id} on blob ${blob.id}: ${chance}`);
    return chance;
  }
}

module.exports = Search;
