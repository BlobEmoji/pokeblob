const { Pool } = require('pg');

const errorEnum = { // eslint-disable-line no-unused-vars
  FOREIGN_KEY_VIOLATION: '23503',
  UNIQUE_VIOLATION: '23505',
  CHECK_VIOLATION: '23514'
};

class DatabaseBackend {
  constructor(credentials) {
    this.pool = new Pool(credentials);
  }

  async acquire() {
    return await this.pool.connect();
  }

  async ensureGuild(client, guildID) {
    await client.query(`
      INSERT INTO guilds (id)
      VALUES ($1::BIGINT)
      ON CONFLICT (id) DO NOTHING
      `, [guildID]);
  }

  async ensureMember(client, guildID, memberID) {
    await this.ensureGuild(client, guildID);
    const res = await client.query(`
      INSERT INTO users (id, guild)
      VALUES (
        $1::BIGINT,
        $2::BIGINT
      ) ON CONFLICT (id, guild) DO UPDATE
      SET energy = CASE
        WHEN users.energy < 50 AND users.last_used_energy < day_timestamp() THEN 50
        ELSE users.energy
        END,
      last_used_energy = day_timestamp()
      RETURNING id, unique_id, guild, energy, last_used_energy, xmax != 0 as updated
    `, [memberID, guildID]);
    if (res.rows[0] && !res.rows[0].updated) await this.supplyBasicInventory(client, guildID, memberID);
    return res.rows[0];
  }

  async supplyBasicInventory(client, guildID, memberID) {
    await this.giveUserItem(client, guildID, memberID, 1, 3);
  }

  async modifyMemberEnergy(client, guildID, memberID, amount) {
    const member = await this.ensureMember(client, guildID, memberID);
    const res = await client.query(`
      UPDATE users
      SET energy = users.energy + $1
      WHERE unique_id = $2::BIGINT
      RETURNING id, guild, energy, last_used_energy
    `, [amount, member.unique_id]);
    return res.rows[0];
  }

  async updateMemberEnergy(client, guildID, memberID, amount) {
    const member = await this.ensureMember(client, guildID, memberID);
    const res = await client.query(`
      UPDATE users
      SET energy = $1
      WHERE unique_id = $2::BIGINT
      RETURNING id, guild, energy, last_used_energy
    `, [amount, member.unique_id]);
    return res.rows[0];
  }

  async giveUserItem(client, guildID, memberID, itemID, amount) {
    const member = await this.ensureMember(client, guildID, memberID);
    const res = await client.query(`
      INSERT INTO items (item_id, user_id, amount)
      VALUES ($1::BIGINT, $2::BIGINT, $3)
      ON CONFLICT (item_id, user_id)
      DO UPDATE SET
      amount = items.amount + $3
      RETURNING unique_id, item_id, user_id, amount
    `, [itemID, member.unique_id, amount]);
    return res.rows[0];
  }

  async removeUserItem(client, guildID, memberID, itemID, amount) {
    const member = await this.ensureMember(client, guildID, memberID);
    const res = await client.query(`
      UPDATE items SET
      amount = items.amount - $3
      WHERE item_id = $1::BIGINT AND user_id = $2::BIGINT AND amount >= $3
      RETURNING unique_id, item_id, user_id, amount
    `, [itemID, member.unique_id, amount]);

    // if this returns undefined the user doesn't have the required amount of said item
    return res.rows[0];
  }

  async giveUserCurrency(client, guildID, memberID, amount) {
    const member = await this.ensureMember(client, guildID, memberID);
    const res = await client.query(`
      UPDATE users
      SET currency = users.currency + $1,
      accumulated_currency = users.accumulated_currency + $1
      WHERE unique_id = $2::BIGINT
      RETURNING id, guild, currency, accumulated_currency
    `, [amount, member.unique_id]);
    return res.rows[0];
  }

  async takeUserCurrency(client, guildID, memberID, amount) {
    const member = await this.ensureMember(client, guildID, memberID);
    const res = await client.query(`
      UPDATE users
      SET currency = users.currency - $1
      WHERE unique_id = $2::BIGINT AND currency >= $1
      RETURNING id, guild, currency, accumulated_currency
    `, [amount, member.unique_id]);

    // if this returns undefined the user doesn't have the required amount of currency
    return res.rows[0];
  }

  async acknowledgeBlob(client, guildID, memberID, blobID) {
    const member = await this.ensureMember(client, guildID, memberID);
    await client.query(`
      INSERT INTO blobs (blob_id, user_id)
      VALUES ($1::BIGINT, $2::BIGINT)
      ON CONFLICT (blob_id, user_id)
      DO NOTHING
    `, [blobID, member.unique_id]);
  }

  async giveUserBlob(client, guildID, memberID, blobID, amount) {
    const member = await this.ensureMember(client, guildID, memberID);
    const res = await client.query(`
      INSERT INTO blobs (blob_id, user_id, caught, amount)
      VALUES ($1::BIGINT, $2::BIGINT, TRUE, $3)
      ON CONFLICT (blob_id, user_id)
      DO UPDATE SET
      amount = blobs.amount + $3,
      caught = TRUE
      RETURNING unique_id, blob_id, user_id, amount
    `, [blobID, member.unique_id, amount]);
    return res.rows[0];
  }

  async takeUserBlob(client, guildID, memberID, blobID, amount) {
    const member = await this.ensureMember(client, guildID, memberID);
    const res = await client.query(`
      UPDATE blobs SET
      amount = blobs.amount - $3
      WHERE blob_id = $1::BIGINT AND user_id = $2::BIGINT AND amount >= $3
      RETURNING unique_id, blob_id, user_id, amount
    `, [blobID, member.unique_id, amount]);

    // if this returns undefined the user doesn't have the required blob count
    return res.rows[0];
  }

  async giveUserEffect(client, guildID, memberID, effectID, life) {
    const member = await this.ensureMember(client, guildID, memberID);
    const res = await client.query(`
      INSERT INTO effects (effect_id, user_id, life)
      VALUES ($1::BIGINT, $2::BIGINT, $3)
      ON CONFLICT (effect_id, user_id)
      DO UPDATE SET
      life = effects.life + $3
      RETURNING unique_id, effect_id, user_id, life
    `, [effectID, member.unique_id, life]);
    return res.rows[0];
  }

  async consumeUserEffects(client, guildID, memberID, effectType) {
    const member = await this.ensureMember(client, guildID, memberID);
    const res = await client.query(`
      UPDATE effects SET
      life = effects.life - 1
      FROM effectdefs
      WHERE user_id = $1::BIGINT AND life >= 1
      AND effects.effect_id = effectdefs.unique_id AND effectdefs.type = $2
      RETURNING effects.unique_id, effects.effect_id, effects.user_id, effects.life, effectdefs.name
    `, [member.unique_id, effectType]);

    // returns relevant effects
    return res.rows;
  }

  async getUserData(client, guildID, memberID) {
    const member = await this.ensureMember(client, guildID, memberID);
    const res = await client.query(`
      SELECT * FROM users WHERE unique_id = $1::BIGINT
    `, [member.unique_id]);
    return res.rows[0];
  }

  async getUserInventory(client, guildID, memberID) {
    const member = await this.ensureMember(client, guildID, memberID);
    const res = await client.query(`
      SELECT items.unique_id, items.item_id, items.amount,
      itemdefs.name, itemdefs.value, itemdefs.potential, itemdefs.mode
      FROM items
      INNER JOIN itemdefs ON items.item_id = itemdefs.id
      WHERE user_id = $1::BIGINT
    `, [member.unique_id]);
    return res.rows;
  }

  async getUserBlobs(client, guildID, memberID) {
    const member = await this.ensureMember(client, guildID, memberID);
    const res = await client.query(`
      SELECT blobs.unique_id, blobs.blob_id, blobs.caught, blobs.amount,
      blobdefs.emoji_id, blobdefs.emoji_name,
      blobrarity.rarity_scalar
      FROM blobs
      INNER JOIN blobdefs ON blobs.blob_id = blobdefs.unique_id
      INNER JOIN blobrarity ON blobdefs.rarity = blobrarity.id
      WHERE user_id = $1::BIGINT
      ORDER BY
      blobrarity.rarity_scalar DESC,
      blobs.amount DESC,
      blobdefs.emoji_name ASC
    `, [member.unique_id]);
    return res.rows;
  }

  async getUserEffects(client, guildID, memberID) {
    const member = await this.ensureMember(client, guildID, memberID);
    const res = await client.query(`
      SELECT effects.unique_id, effects.effect_id, effects.life,
      effectdefs.name
      FROM effects
      INNER JOIN effectdefs ON effects.effect_id = effectdefs.unique_id
      WHERE user_id = $1::BIGINT
    `, [member.unique_id]);
    return res.rows;
  }

  async getStoreItems(client) {
    const res = await client.query(`
      SELECT * FROM itemdefs
      WHERE value >= 0
    `);
    return res.rows;
  }

  async getStoreItemByName(client, name) {
    const res = await client.query(`
      SELECT * FROM itemdefs
      WHERE value >= 0 AND LOWER(TRANSLATE("name", '- ', '')) = LOWER(TRANSLATE($1, '- ', ''))
    `, [name]);
    return res.rows[0];
  }

  async getBlobByName(client, blobName) {
    const res = await client.query(`
        SELECT * FROM blobdefs
        WHERE LOWER(TRANSLATE(emoji_name, '- ', '')) = LOWER(TRANSLATE($1, '- ', ''))
    `, [blobName]);

    // this returns undefined if the emoji is not in the database
    return res.rows[0];
  }

  async getRandomWeightedBlob(client) {
    const res = await client.query(`
      SELECT blobdefs.unique_id, blobdefs.emoji_id, blobdefs.emoji_name,
      blobrarity.name AS rarity_name, blobrarity.rarity_scalar
      FROM blobdefs INNER JOIN blobrarity
      ON blobdefs.rarity = blobrarity.id
      ORDER BY random() * blobrarity.rarity_scalar
      LIMIT 1
    `);
    return res.rows[0];
  }

  async checkHasBlobs(client, guildID, senderID, senderBlobID, receiverID, receiverBlobID) {
    const sender = await this.ensureMember(client, guildID, senderID);
    const receiver = await this.ensureMember(client, guildID, receiverID);
    const res = await client.query(`
      SELECT users.id AS user_id FROM blobs
      INNER JOIN users ON blobs.user_id = users.unique_id
      WHERE
      ((blobs.blob_id = $2::BIGINT AND blobs.user_id = $1::BIGINT) OR
      (blobs.blob_id = $4::BIGINT AND blobs.user_id = $3::BIGINT)) AND
      blobs.amount > 0
    `, [sender.unique_id, senderBlobID, receiver.unique_id, receiverBlobID]);

    // returns the discord IDs of those who pass this check
    // if the length is equal to 2, both users passed
    return res.rows.map(x => x.user_id);
  }
}

module.exports = DatabaseBackend;
