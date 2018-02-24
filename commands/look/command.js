
const CommandBaseClass = require('../CommandBaseClass.js');

const { MessageEmbed } = require('discord.js');

class Look extends CommandBaseClass {
  constructor(...args) {
    super(...args);

    this.meta = {
      name: 'look',
      category: 'meta.help.categories.pokeblobs',
      description: 'meta.help.commands.look'
    };
  }

  async run(context) {
    const { client, target } = context;

    const userData = await context.connection.memberData(target);
    const _ = (...x) => client.localize(userData.locale, ...x);
    const _i = (...x) => client.localizeIndex(userData.locale, ...x);

    const [temp, humidity, wind] = [userData.loc_temperature, userData.loc_humidity_potential, userData.loc_wind_speed];

    // prepare main description
    const descriptionAggregate = [];

    const placeName = (userData.loc_strange) ? _('commands.look.names.unknown') :
      _i('commands.look.names.second', userData.loc_name_index_2, { FIRST:
      _i('commands.look.names.first', userData.loc_name_index_1) });

    if (userData.energy === 0)
      descriptionAggregate.push(_('commands.look.energy.none'));
    else if (userData.energy <= 4)
      descriptionAggregate.push(_('commands.look.energy.peril', { AMOUNT: userData.energy }));
    else if (userData.energy <= 10)
      descriptionAggregate.push(_('commands.look.energy.warn', { AMOUNT: userData.energy }));
    else if (userData.energy <= 20)
      descriptionAggregate.push(_('commands.look.energy.ok', { AMOUNT: userData.energy }));
    else if (userData.energy <= 40)
      descriptionAggregate.push(_('commands.look.energy.good', { AMOUNT: userData.energy }));
    else if (userData.energy <= 60)
      descriptionAggregate.push(_('commands.look.energy.plenty', { AMOUNT: userData.energy }));
    else
      descriptionAggregate.push(_('commands.look.energy.lots', { AMOUNT: userData.energy }));

    if (userData.state_roaming)
      if (userData.energy > 0)
        descriptionAggregate.push(_('commands.look.roaming.on'));
      else
        descriptionAggregate.push(_('commands.look.roaming.force_off'));
    else
      descriptionAggregate.push(_('commands.look.roaming.off'));

    if (userData.loc_strange)
      descriptionAggregate.push(_('commands.look.roaming.strange'));
    else if (userData.roaming_effect)
      descriptionAggregate.push(_('commands.look.roaming.effect'));

    // if the user can move, and is about to, warn them
    if (userData.energy > 0 && userData.state_roaming && userData.quarter_remaining > 0.8)
      descriptionAggregate.push(_('commands.look.warn_moving'));

    // prepare stuff for weather field
    const weatherAggregate = [];

    // sky conditions
    if (temp <= 8)
      if (humidity > 80)
        weatherAggregate.push(_('commands.look.weather.cold_rain'));
      else
        weatherAggregate.push(_('commands.look.weather.cold'));
    else if (temp <= 14)
      if (humidity > 80)
        weatherAggregate.push(_('commands.look.weather.cool_rain'));
      else
        weatherAggregate.push(_('commands.look.weather.cool'));
    else if (temp <= 24)
      if (humidity > 80)
        weatherAggregate.push(_('commands.look.weather.moderate_rain'));
      else
        weatherAggregate.push(_('commands.look.weather.moderate'));
    else if (temp <= 29)
      if (humidity > 80)
        weatherAggregate.push(_('commands.look.weather.warm_rain'));
      else
        weatherAggregate.push(_('commands.look.weather.warm'));
    else
      weatherAggregate.push(_('commands.look.weather.hot'));

    // wind conditions
    if (wind > 6)
      if (wind <= 14)
        weatherAggregate.push(_('commands.look.weather.light_breeze'));
      else if (wind <= 22)
        weatherAggregate.push(_('commands.look.weather.moderate_breeze'));
      else if (wind <= 32)
        weatherAggregate.push(_('commands.look.weather.strong_breeze'));
      else
        weatherAggregate.push(_('commands.look.weather.fast_winds'));

    // prepare locations
    const locationAggregate = [];

    if (userData.loc_has_shop)
      locationAggregate.push(_('commands.look.places.shop'));
    if (userData.loc_has_center)
      locationAggregate.push(_('commands.look.places.center'));
    if (userData.loc_has_gym)
      locationAggregate.push(_('commands.look.places.gym'));

    if (locationAggregate.length === 0)
      locationAggregate.push(_('commands.look.places.none'));

    // change embed color pertaining to weather
    const embedColor = (temp > 24) ? [251, 110, 7] : (temp < 15) ? [158, 245, 255] : (humidity > 75) ? [92, 75, 255] : [128, 115, 254];

    // make the embed
    const embed = new MessageEmbed()
      .setAuthor(target.user.username, target.user.displayAvatarURL())
      .setTimestamp()
      .setColor(embedColor)
      .addField(_('commands.look.names.header'), placeName, false)
      .addField(_('commands.look.weather.header'), weatherAggregate.join('\n'), true)
      .addField(_('commands.look.places.header'), locationAggregate.join('\n'), true)
      .setDescription(descriptionAggregate.join('\n'))
      .setFooter(_('meta.pokeblobs'));

    // send it
    await context.send({ embed });
  }
}

module.exports = Look;
