const Command = require('../base/Command.js');

class Use extends Command {
  constructor(client) {
    super(client, {
      name: 'use',
      description: 'Uses an item from your inventory.',
      category: 'Pokéblob',
      usage: 'use <item number>',
      guildOnly: true,
      botPerms: ['SEND_MESSAGES'],
      permLevel: 'User'
    });
  }

  array_shuffle(a) {
    var j, x, i;
    for (i = a.length - 1; i > 0; i--) {
      j = Math.floor(Math.random() * (i + 1));
      x = a[i];
      a[i] = a[j];
      a[j] = x;
    }
    return a;
  }

  async run(message, args, level) { //eslint-disable-line no-unused-vars
    const connection = await this.client.db.acquire();
    try {
      const consumable = args.join(' ');
      const item = await this.client.db.getStoreItemByName(connection, consumable);
      if (!item) {
        return message.channel.send('I don\'t know what this item is.');
      }
      
      await connection.query('BEGIN');

      const consumed = await this.client.db.removeUserItem(connection, message.guild.id, message.author.id, item.id, 1);

      if (!consumed) {
        await connection.query('ROLLBACK');
        return message.channel.send('You can\'t use something you don\'t have.');
      }

      // if the user attempts to use a ball
      if (item.mode === 1) {
        const comments = this.array_shuffle(['professional-grade', 'genuine-edition', 'locally-sourced', 'as-seen-on-TV', 'celebrity-endorsed']);
        const comment = `Ah yes, it's one of those ${comments.slice(0, 3).join(' ')} **${item.name}s** you've heard so much about. You should probably use it to catch something.`;

        // we rollback here as to not actually consume the ball
        await connection.query('ROLLBACK');
        return message.channel.send(comment);
      }

      // otherwise
      if (item.mode === 2) {
        // consumable for energy
        await this.client.db.modifyMemberEnergy(connection, message.guild.id, message.author.id, item.potential);
      } else if (item.mode === 3) {
        // lure effect
        await this.client.db.giveUserEffect(connection, message.guild.id, message.author.id, 1, item.potential);
      }

      await connection.query('COMMIT');
      message.channel.send(`${message.author} used a ${item.name}, ${item.confirm_use_message}`);
    } finally {
      connection.release();
    }
  }
}

module.exports = Use;
