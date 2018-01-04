const Social = require('../base/Command.js');

class Store extends Social {
  constructor(client) {
    super(client, {
      name: 'store',
      description: 'Display All Store Items',
      usage: 'store <-buy|-sell|-add|-del|-view>',
      category: 'Economy',
      aliases: []
    });
  }

  async run(message, args, level) { // eslint-disable-line no-unused-vars
    const settings = this.client.settings.get(message.guild.id);
    if (!message.flags.length) {
      return message.reply(`|\`❌\`| ${this.help.usage}`);
    }

    switch (message.flags[0]) {
      case ('buy'): {
        const name = args.join(' ');
        
        if (!name) return this.client.commands.get('store').run(message, args, level);
            
        const item = this.client.store.filter(i => i.name.toLowerCase().includes(name.toLowerCase()));
        
        if (item.size > 1) return message.reply(`Please be more specific, there is more than one item on sale with ${name} as their name`);
        if (!item) return message.channel.send('That item doesn\'t exist, Please make sure it is spelled correctly');
        
        if (item.array()[0].price > message.member.score.points) {
          return message.channel.send(`You currently have <:blobcoin:${settings.blobCoin}>${message.member.score.points}, but the role costs ${item.array()[0].price}!`);
        }
        
        const response = await this.client.awaitReply(message, `Are you sure you want to purchase ${item.array()[0].name} for <:blobcoin:${settings.blobCoin}>${item.array()[0].price}?`, undefined, null);
        if (['y', 'yes'].includes(response.toLowerCase())) {
        
          message.member.takePoints(item.array()[0].price);
          message.channel.send('You have bought the item :tada: ');
        
        } else
        
        if (['n', 'no', 'cancel'].includes(response.toLowerCase())) {
          message.channel.send('Transaction cancelled.');
        }
        break;
      }

      case ('sell'): {
        const name = args.join(' ');
        
        if (!name) return this.client.commands.get('store').run(message, args, level);
            
        const item = this.client.store.filter(i => i.name.toLowerCase().includes(name.toLowerCase()));
              
        if (!item) return message.channel.send('That item doesn\'t exist, Please make sure it is spelled correctly');
        
        const returnPrice = Math.floor(item.array()[0].price/2);
        
        const response = await this.client.awaitReply(message, `Are you sure you want to sell ${item.array()[0].name} for <:blobcoin:${settings.blobCoin}>${returnPrice}?`, undefined, null);
        if (['y', 'yes'].includes(response.toLowerCase())) {
        
          message.member.givePoints(returnPrice);
          message.channel.send('You have sold the item :tada: ');
        
        } else
        
        if (['n', 'no', 'cancel'].includes(response.toLowerCase())) {
          message.channel.send('Transaction cancelled.');
        }
        break;
      }

      case ('add'): {
        const price = args.pop();
        const name = args.join(' ');

        if (!name) return message.reply('Please add the exact name of the item');
        
        if (this.client.store.has(name)) return message.reply('This item is already on sale');
        
        if (!price) return message.reply('Please specify a price');
        
        const item = { name: name.toLowerCase(), id: Math.random(), price: price, guildId: message.guild.id };
        this.client.store.set(item.id, item);
        message.reply(`${name} is now on sale `);
        break;
      }

      case ('del'): {
        const name = args.join(' ');
        if (!name) return message.reply('Please specify the exact name of the item');
        
        if (!this.client.store.has(name)) return message.reply('This item is not on sale');
        
        const response = await this.client.awaitReply(message, `Are you sure you want to remove ${name} from the shop?`);
        if (['y', 'yes'].includes(response)) {
        
          await this.client.store.delete(name);
          message.reply('The item is now off the store.');
        } else
        
        if (['n','no','cancel'].includes(response)) {
          message.reply('Action cancelled.');
        }
        break;
      }

      case ('view'): {
        const items = message.guild.store;
        if (items.length === 0) return message.channel.send('Nothing is for sale');
        message.channel.send(items.map(item => 
          `${message.guild.roles.get(item.id.toString()).name}: ${item.price} 💰`).join('\n'), { code: true }
        );
      }
    }
  }
}
module.exports = Store;