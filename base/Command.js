class Command {
  constructor(client, {
    name = null,
    description = 'No description provided.',
    category = 'Miscellaneous',
    usage = 'No usage provided.',
    enabled = true,
    guildOnly = false,
    aliases = new Array(),
    extended = 'No information provided.',
    cost = 0,
    cooldown = 0,
    botPerms = [],
    permLevel = 'User',
    location = ''
  }) {
    this.client = client;
    this.conf = { 
      enabled, 
      guildOnly,
      aliases,
      permLevel,
      botPerms,
      location,
      cooldown
    };
    this.help = { 
      name,
      description,
      category,
      usage,
      extended,
      cost
    };
  }

  async verifyUser(user) {
    try {
      const match = /(?:<@!?)?([0-9]{17,20})>?/gi.exec(user);
      if (!match) throw 'Invalid user';
      const id = match[1];
      const check = await this.client.users.fetch(id);
      if (check.username !== undefined) return id;
    } catch (error) {
      throw error;
    }
  }

  async verifyMember(guild, member) {
    const user = await this.verifyUser(member);
    const target = await guild.members.fetch(user);
    return target;
  }
  
  async verifyMessage(message, msgid) {
    try {
      const match = /([0-9]{17,20})/.exec(msgid);
      if (!match) throw 'Invalid message id.';
      const id = match[1];
      const check = await message.channel.messages.fetch(id);
      if (check.cleanContent !== undefined) return id;
    } catch (error) {
      throw error;
    }
  }

  async verifyChannel(message, chanid) {
    try {
      const match = /([0-9]{17,20})/.exec(chanid);
      if (!match) return message.channel.id;
      const id = match[1];
      const check = await message.guild.channels.get(id);
      if (check.name !== undefined && check.type === 'text') return id;
    } catch (error) {
      throw error;
    }
  }
}
module.exports = Command;
