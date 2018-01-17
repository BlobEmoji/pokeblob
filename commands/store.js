const Command = require('../base/Command.js');

class Store extends Command {
  constructor(client) {
    super(client, {
      name: 'store',
      description: 'Display All Store Items',
      category: 'Pokéblob',
      usage: 'store <buy|sell|view>',
      aliases: []
    });
  }

  detectAmount(args) {
    const maybeAmount = parseInt(args[args.length - 1]);
    if (isNaN(maybeAmount)) {
      return {amount: 1, name: args.join(' ')};
    } else {
      return {amount: maybeAmount, name: args.slice(0, -1).join(' ')};
    }
  }

  async run(message, rawargs, level) { // eslint-disable-line no-unused-vars
    const trigger = rawargs[0];
    const args = rawargs.slice(1);

    switch (trigger) {
      case ('buy'): {
        const { name, amount } = this.detectAmount(args);

        if (amount <= 0) {
          return message.channel.send('You must buy at least one item from the store.');
        } else if (amount >= 100) {
          return message.channel.send('I\'m not even sure if I have that much stock on me..');
        }
        
        const connection = await this.client.db.acquire();
        let storeItem;
        try {
          storeItem = await this.client.db.getStoreItemByName(connection, name);

          if (!storeItem) return message.channel.send('I\'m not sure what that item is, did you spell it correctly?');

          const response = await this.client.awaitReply(message, `Are you sure you want to purchase ${amount}x ${storeItem.name} for <:blobcoin:398579309276823562> ${storeItem.value * amount}? (yes/no)\n"${storeItem.description}"`, undefined, null);
          if (['y', 'yes'].includes(response.toLowerCase())) {
          
            await connection.query('BEGIN');
            const deducted = await this.client.db.takeUserCurrency(connection, message.guild.id, message.author.id, storeItem.value * amount);
            if (!deducted) {
              await connection.query('ROLLBACK');
              return message.channel.send('You don\'t appear to have the funds for that.');
            }
            await this.client.db.giveUserItem(connection, message.guild.id, message.author.id, storeItem.id, amount);
            await connection.query('COMMIT');
            return message.channel.send(`You have bought ${amount}x ${storeItem.name} :tada:`);
          } else
          
          if (['n', 'no', 'cancel'].includes(response.toLowerCase())) {
            return message.channel.send('Transaction cancelled.');
          }
        } finally {
          connection.release();
        }
        break;
      }

      case ('sell'): {
        const { name, amount } = this.detectAmount(args);

        if (amount <= 0) {
          return message.channel.send('You must sell at least one item to the store.');
        } else if (amount >= 100) {
          return message.channel.send('I won\'t be able to hold that much stuff!');
        }

        const connection = await this.client.db.acquire();
        let storeItem;
        try {
          storeItem = await this.client.db.getStoreItemByName(connection, name);

          const returnPrice = Math.floor(storeItem.value/2);

          if (!storeItem) return message.channel.send('I\'m not sure what that item is, did you spell it correctly?');

          const response = await this.client.awaitReply(message, `Are you sure you want to sell ${amount}x ${storeItem.name} for <:blobcoin:398579309276823562> ${returnPrice * amount}? (yes/no)`, undefined, null);
          if (['y', 'yes'].includes(response.toLowerCase())) {
          
            await connection.query('BEGIN');
            const deducted = await this.client.db.removeUserItem(connection, message.guild.id, message.author.id, storeItem.id, amount);
            if (!deducted) {
              await connection.query('ROLLBACK');
              return message.channel.send(`You don't appear to actually have ${amount === 1 ? 'that item' : 'those items'}.`);
            }
            await this.client.db.giveUserCurrency(connection, message.guild.id, message.author.id, returnPrice * amount);
            await connection.query('COMMIT');
            return message.channel.send(`You have sold ${amount}x ${storeItem.name} :tada:`);
          } else
          
          if (['n', 'no', 'cancel'].includes(response.toLowerCase())) {
            return message.channel.send('Transaction cancelled.');
          }
        } finally {
          connection.release();
        }
        break;
      }

      case ('view'): {
        const connection = await this.client.db.acquire();
        let storeItems, userData;
        try {
          storeItems = await this.client.db.getStoreItems(connection);
          userData = await this.client.db.getUserData(connection, message.guild.id, message.author.id);
        } finally {
          connection.release();
        }
        if (storeItems.length === 0) return message.channel.send('Nothing is for sale');
        const map = storeItems.map(item => `**${item.name}**: ${item.value} <:blobcoin:398579309276823562> | ${item.description}`).join('\n');
        return message.channel.send(`Welcome to the PokéBlob shop! You currently have ${userData.currency} <:blobcoin:398579309276823562>\n${map}`);
      }

      default: {
        return message.reply(`|\`❌\`| ${this.help.usage}`);
      }
    }
  }
}
module.exports = Store;
