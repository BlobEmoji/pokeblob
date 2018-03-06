module.exports = class {
  constructor(client) {
    this.client = client;
  }

  async run(member) {
    if (!member || !member.id || !member.guild) return;
    const guild = member.guild;

    if (!guild.id === '408709336861507584') return;

    const checkGuild = this.client.guilds.get('272885620769161216');
    const checkMember = checkGuild.members.get(member.id);
    const role = checkGuild.roles.find('name', 'PokéBlob Master');
    if (!checkMember.has(role.id)) {
      return;
    } else {
      member.addRole('name', 'PokéBlob Master');
    }
  }
};
