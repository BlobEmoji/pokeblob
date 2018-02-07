const ConnectionInterfaceBase = require('./ConnectionInterfaceBase.js');


class ConnectionInterface extends ConnectionInterfaceBase {
  async memberData(member) {
    const resp = await this.query(`
    WITH guild_table AS (
      INSERT INTO guilds (id, "name", locale)
      VALUES (
        $1::BIGINT,
        $2,
        'en'
      )
      ON CONFLICT (id)
      DO UPDATE SET
        "name" = $2
      RETURNING guilds.id as guild_id, guilds.locale
    ), user_table AS (
      INSERT INTO users (id, "name", discriminator, bot)
      VALUES (
        $3::BIGINT,
        $4,
        $5::SMALLINT,
        $6::BOOLEAN
      )
      ON CONFLICT (id)
      DO UPDATE SET
        "name" = $4,
        discriminator = $5::SMALLINT,
        bot = $6::BOOLEAN
      RETURNING users.id
    ), final_query AS (
      INSERT INTO user_data ("user", guild)
        SELECT user_table.id, guild_table.guild_id FROM user_table, guild_table
      ON CONFLICT ("user", guild)
      DO UPDATE SET
        location = CASE
          WHEN user_data.energy > 0 AND get_bit(user_data."state", 0) = 1 AND user_data.last_moved_location < quarter_timestamp() THEN generate_location()
          ELSE user_data.location
        END,
        energy = CASE
          WHEN user_data.energy < 50 AND user_data.last_used_energy < day_timestamp() THEN 50
          WHEN user_data.energy > 0 AND get_bit(user_data."state", 0) = 1 AND user_data.last_moved_location < quarter_timestamp() THEN user_data.energy - 1
          ELSE user_data.energy
        END,
        last_used_energy = day_timestamp(),
        last_moved_location = quarter_timestamp()
      RETURNING *, xmax != 0 AS updated
    )
    SELECT * FROM final_query, parse_location(final_query.location), guild_table
    `, [
      member.guild.id,
      member.guild.name,
      member.user.id,
      member.user.username,
      member.user.discriminator,
      member.user.bot
    ]);
    // add supply logic here
    return resp.rows[0];
  }
}

module.exports = ConnectionInterface;
