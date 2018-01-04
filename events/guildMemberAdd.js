module.exports = class {
  constructor(client) {
    this.client = client;
  }

  async run(member) {
    if (!member || !member.id || !member.guild) return;
    const guild = member.guild;
    this.client.points.set(`${guild.id}-${member.id}`, { points: 200, level:1, user: member.id, guild: guild.id, daily: 1504120109 });

    const settings = this.client.settings.get(member.guild.id);
    if (settings.welcomeEnabled !== 'true') return;
    const welcomeMessage = settings.welcomeMessage.replace('{{user}}', member.user.tag);
    member.guild.channels.find('name', settings.welcomeChannel).send(welcomeMessage).catch(console.error);
  }
};