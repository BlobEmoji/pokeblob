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
            WHEN user_data.energy > 0 AND get_bit(user_data."state", 0) = 1 AND user_data.last_acked_location < quarter_timestamp() THEN generate_location()
            ELSE user_data.location
          END,
          energy = CASE
            WHEN user_data.energy < 50 AND user_data.last_used_energy < day_timestamp() THEN 50
            WHEN user_data.energy > 0 AND get_bit(user_data."state", 0) = 1 AND user_data.last_acked_location < quarter_timestamp() THEN user_data.energy - 1
            ELSE user_data.energy
          END,
          last_moved_location = CASE
            WHEN user_data.energy > 0 AND get_bit(user_data."state", 0) = 1 AND user_data.last_acked_location < quarter_timestamp() THEN quarter_timestamp()
            ELSE user_data.last_moved_location
          END,
          last_used_energy = day_timestamp(),
          last_acked_location = quarter_timestamp()
        RETURNING *, xmax != 0 AS updated
      )
      SELECT *,
        quarter_remaining() AS quarter_remaining,
        last_acked_location = last_moved_location AS roaming_effect
      FROM final_query, parse_location(final_query.location), guild_table
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

  async updateParty(member, blobList) {
    const updateList = blobList.slice(0, 4);
    const memberData = await this.memberData(member);
    if (updateList.length === 0) {
      // no blobs, so clear their party
      await this.query(`
        UPDATE blobs
        SET party_addition_time = NULL
        WHERE user_id = $1
      `, [memberData.unique_id]);
      // return emptylist because we just cleared the list
      return [];
    } else {
      const sqlListing = [];
      const argumentListing = [];

      // create SQL prepared arg string and the respective values
      blobList.map((blobID, index) => {
        sqlListing.push(`$${index+2}`);
        argumentListing.push(blobID);
      });

      // remove all blobs from party that aren't in this list
      await this.query(`
        UPDATE blobs
        SET party_addition_time = NULL
        WHERE user_id = $1
        AND unique_id NOT IN (${sqlListing.join(', ')})
      `, [memberData.unique_id, ...argumentListing]);

      // update blobs to add any blobs in this list that aren't in the party
      const resp = await this.query(`
        UPDATE blobs
        SET party_addition_time = CASE
          WHEN blobs.party_addition_time IS NULL THEN now()::TIMESTAMP
          ELSE blobs.party_addition_time -- don't change timestamp on blobs that already have one
        END -- we could do this using when but then existing party members aren't returned
        WHERE user_id = $1
        AND unique_id IN (${sqlListing.join(', ')})
        RETURNING *
      `, [memberData.unique_id, ...argumentListing]);

      return resp.rows;
    }
  }

  async getParty(member) {
    const memberData = await this.memberData(member);
    const resp = await this.query(`
      SELECT * FROM blobs
      WHERE user_id = $1
      AND party_addition_time IS NOT NULL
    `, [memberData.unique_id]);
    return resp.rows;
  }

  async updateRoamingState(member, yesNo) {
    const memberData = await this.memberData(member);
    const resp = await this.query(`
      UPDATE user_data
      SET state = set_bit(user_data.state, 0, $2::BOOLEAN::INTEGER)
      WHERE unique_id = $1
      RETURNING *
    `, [memberData.unique_id, yesNo]);
    return resp.rows[0];
  }

  // startup function if the bot dies while a user was engaged
  async clearEngaged() {
    await this.query(`
      UPDATE user_data
      SET state = set_bit(user_data.state, 1, 0)
    `);
  }

  async setEngaged(member, yesNo) {
    const memberData = await this.memberData(member);
    const resp = await this.query(`
      UPDATE user_data
      SET state = set_bit(user_data.state, 1, $2::BOOLEAN::INTEGER)
      WHERE unique_id = $1
      RETURNING *
    `, [memberData.unique_id, yesNo]);
    return resp.rows[0];
  }

  async modifyEnergy(member, amount) {
    const memberData = await this.memberData(member);
    const resp = await this.query(`
      UPDATE user_data
      SET energy = energy + $2
      WHERE unique_id = $1
      RETURNING *
    `, [memberData.unique_id, amount]);
    return resp.rows[0];
  }

  async modifySearchCount(member, amount) {
    const memberData = await this.memberData(member);
    const resp = await this.query(`
      UPDATE user_data
      SET search_count = search_count + $2
      WHERE unique_id = $1
      RETURNING *
    `, [memberData.unique_id, amount]);
    return resp.rows[0];
  }

  async getRandomWeightedBlob(potential, effect) {
    const resp = await this.query(`
      SELECT blobdefs.id, blobdefs.emoji_id, blobdefs.emoji_name,
      blobrarity.name AS rarity_name, blobrarity.rarity_scalar
      FROM blobdefs INNER JOIN blobrarity
      ON blobdefs.rarity = blobrarity.id
      ORDER BY random() * (
        exp(ln(blobrarity.rarity_scalar) * (
          CASE WHEN $2::BOOLEAN THEN 0.7
          ELSE 0.8 END + (
            SQRT(961 - (
              ((blobdefs.id + $2::BOOLEAN::INT) * $1::BIGINT) % 961
            )) * 0.015
          )
        ))
      )
      LIMIT 1
    `, [potential, effect]);
    return resp.rows[0];
  }

  async modifyCoinsTracked(member, amount) {
    const memberData = await this.memberData(member);
    const resp = await this.query(`
      UPDATE user_data
      SET currency = currency + $2,
      accumulated_currency = accumulated_currency + GREATEST($2, 0)
      WHERE unique_id = $1
      RETURNING *
    `, [memberData.unique_id, amount]);
    return resp.rows[0];
  }

  async modifyCoinsUntracked(member, amount) {
    const memberData = await this.memberData(member);
    const resp = await this.query(`
      UPDATE user_data
      SET currency = currency + $2
      WHERE unique_id = $1
      RETURNING *
    `, [memberData.unique_id, amount]);
    return resp.rows[0];
  }

  async getStoreItems(potential, effect) {
    const resp = await this.query(`
      SELECT *,
      (exp(ln(value) * (
          CASE WHEN $2::BOOLEAN AND $1 % 3 = 0 THEN 0.7
          ELSE 0.8 END + (
            SQRT(1764 - (
              ((value) * $1::BIGINT) % 1764
            )) * 0.005
          )
        )
      ))::INTEGER AS actual_price,
      (($1 + id) % appearance_modulus) < appearance_threshold AS available
      FROM itemdefs
    `, [potential, effect]);
    return resp.rows;
  }

  async giveUserItem(member, itemID, amount) {
    const memberData = await this.memberData(member);
    const resp = await this.query(`
      INSERT INTO items (item_id, user_id, amount)
      VALUES ($2::BIGINT, $1::BIGINT, $3)
      ON CONFLICT (item_id, user_id)
      DO UPDATE SET
      amount = items.amount + $3
      RETURNING *
    `, [memberData.unique_id, itemID, amount]);
    return resp.rows[0];
  }

  async takeUserItem(member, itemID, amount) {
    const memberData = await this.memberData(member);
    const resp = await this.query(`
      UPDATE items
      SET amount = items.amount - $3
      WHERE item_id = $2::BIGINT AND user_id = $1::BIGINT
      RETURNING *
    `, [memberData.unique_id, itemID, amount]);
    if (!resp.rows[0])
      throw { code: -1, error: 'no item entry' };
    return resp.rows[0];
  }

  async getUserItems(member) {
    const memberData = await this.memberData(member);
    const resp = await this.query(`
      SELECT * FROM items
      INNER JOIN itemdefs
      ON items.item_id = itemdefs.id
      WHERE user_id = $1::BIGINT
      ORDER BY potential DESC
    `, [memberData.unique_id]);
    return resp.rows;
  }

  async giveUserBlob(member, blobDef, addToParty) {
    const memberData = await this.memberData(member);
    const resp = await this.query(`
      WITH stat_info AS (
        SELECT
        (20 + (random() * 8 * ln($3 / 2)))::INT as health,
        (5 + (random() * 2.5 * ln($3)))::INT as atk,
        (random() * ln($3))::INT as atk_dev,
        (2 + (random() * 2 * ln($3)))::INT as def,
        (random() * 0.5 * ln($3))::INT as def_dev,
        (3 + (random() * ln($3)))::INT as spc,
        (random() * 0.33 * ln($3))::INT as spc_dev,
        5 as spd,
        (random() * 0.25 * ln($3))::INT as spd_dev,
        CASE WHEN $4::BOOLEAN THEN now() AT TIME ZONE 'UTC'
        ELSE NULL END AS add_party
      )
      INSERT INTO blobs (blob_id, user_id, vitality, health, attack, attack_dev,
        defense, defense_dev, special, special_dev, speed, speed_dev, party_addition_time)
      SELECT $2::BIGINT, $1::BIGINT, health, health, atk, atk_dev,
      def, def_dev, spc, spc_dev, spd, spd_dev, add_party
      FROM stat_info
      RETURNING *
    `, [memberData.unique_id, blobDef.id, blobDef.rarity_scalar, addToParty]);
    return resp.rows[0];
  }

  async giveBlobParty(member, blobDef) {
    const party = await this.getParty(member);
    const addToParty = party.length < 4;
    const blob = await this.giveUserBlob(member, blobDef, addToParty);
    if (addToParty)
      party.push(blob);
    return { blob, addToParty, party };
  }

  async changeGuildLocale(guild_id, locale) {
    const resp = await this.query(`
      UPDATE guilds
      SET locale = $2
      WHERE id = $1::BIGINT
      RETURNING *
    `, [guild_id, locale]);
    return resp.rows[0];
  }
}

module.exports = ConnectionInterface;
