
const CommandBaseClass = require('../CommandBaseClass.js');

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
        const blobClass = _(blob.rarity_name, { STATE: 'singular' });
        const blobEmote = `<:${blob.emoji_name}:${blob.emoji_id}>`;

        const catchOpts = ['commands.search.search_blob.continue', 'commands.search.search_blob.leave'];
        const optsFormat = catchOpts.map(x => _(x, { PREFIX: context.prefix })).join('\n');

        const passArgs = { USER: context.member, CLASS: blobClass, BLOB: blobEmote, ENERGY: userData.energy - 1, CATCHOPTS: optsFormat };
        if (userData.loc_strange)
          await msg.edit(_('commands.search.search_blob.prompt_strange', passArgs));
        else
          await msg.edit(_('commands.search.search_blob.prompt', passArgs));

        // todo

        return;
      } else if (roll < (blobChance + moneyChance)) {
        context.log('silly', 'rolled coin');
        const coinAmount = Math.ceil(Math.random() * 10);
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
      await connection.setEngaged(context.member, false);
    }
  }
}

module.exports = Search;
