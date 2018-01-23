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
      RETURNING *, xmax != 0 as updated
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

  async bumpSearchCount(client, guildID, memberID) {
    const member = await this.ensureMember(client, guildID, memberID);
    const res = await client.query(`
      UPDATE users
      SET search_count = search_count + 1
      WHERE unique_id = $1::BIGINT
      RETURNING id, guild, search_count
    `, [member.unique_id]);
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
      blobdefs.emoji_id, blobdefs.emoji_name, blobdefs.rarity,
      blobrarity.rarity_scalar, blobrarity."name" as rarity_name
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

  async updateMilestonesBackground(destination, guildID, memberID) {
    const client = await this.acquire();
    try {
      const member = await this.ensureMember(client, guildID, memberID);

      await client.query('BEGIN');

      const milestones = [];

      const lifetimeLookup = [[50, 5], [100, 10], [200, 20], [300, 30], [500, 40], [750, 50], [1000, 60], [1500, 70],
        [2000, 80], [2500, 90], [3000, 100], [4000, 110], [5000, 120], [7500, 130], [10000, 140], [15000, 150], [20000, 160]];

      // coins over lifetime, this one is easy to calculate
      for (const coinSet of lifetimeLookup) {
        const coinAmount = coinSet[1];
        const threshold = coinSet[0];
        if (member.accumulated_currency >= threshold && member.accumulated_currency_milestone < threshold) {
          await client.query(`
            UPDATE users
            SET currency = users.currency + $1,
            accumulated_currency = users.accumulated_currency + $1,
            accumulated_currency_milestone = $2
            WHERE unique_id = $3::BIGINT
            RETURNING *
          `, [coinAmount, threshold, member.unique_id]);
          milestones.push(`You've found ${threshold} Coins over your lifetime! You've earned ${coinAmount} as a bonus!`);
        }
      }

      const pocketLookup = [[25, 5], [50, 10], [100, 20], [150, 30], [200, 40], [300, 50], [400, 60], [500, 70]];

      // coins in pocket
      for (const coinSet of pocketLookup) {
        const coinAmount = coinSet[1];
        const threshold = coinSet[0];
        if (member.currency >= threshold && member.currency_milestone < threshold) {
          await client.query(`
            UPDATE users
            SET currency = users.currency + $1,
            accumulated_currency = users.accumulated_currency + $1,
            currency_milestone = $2
            WHERE unique_id = $3::BIGINT
            RETURNING *
          `, [coinAmount, threshold, member.unique_id]);
          milestones.push(`You have ${threshold} Coins in your pocket! You've earned ${coinAmount} as a bonus for saving up!`);
        }
      }

      const itemDefLookup = await this.getStoreItems(client);

      // unique blobs
      // this is the lookup to determine tiers and items given
      // works like: [<blob amount>, [[<item 1 id>, <item 1 amount>], [<item 2 id>, <item 2 amount>]]]
      const blobItemLookup = [
        [1, [[1, 3]]],
        [10, [[2, 1], [5, 1]]],
        [25, [[2, 2]]],
        [50, [[2, 3]]],
        [75, [[3, 1]]],
        [100, [[3, 2]]],
        [125, [[3, 3]]],
        [150, [[4, 1]]],
        [175, [[4, 2]]],
        [200, [[4, 3]]]
      ];

      const blobCaughtAmount = (await this.getUserBlobs(client, guildID, memberID)).filter(x => x.caught).length;
      for (const blobTier of blobItemLookup) {
        if (blobCaughtAmount >= blobTier[0] && member.unique_blob_milestone < blobTier[0]) {
          await client.query(`
            UPDATE users
            SET unique_blob_milestone = $1
            WHERE unique_id = $2::BIGINT
            RETURNING *
          `, [blobTier[0], member.unique_id]);
          const itemList = [];
          for (const itemSet of blobTier[1]) {
            await this.giveUserItem(client, guildID, memberID, itemSet[0], itemSet[1]);
            const itemDef = itemDefLookup.filter(x => x.id === itemSet[0])[0];
            itemList.push(`${itemSet[1]}x ${itemDef.name}`);
          }
          const itemFormatting = itemList.join(', ');
          milestones.push(`Great job, you've owned ${blobTier[0]} unique blob(s)! As a reward, you've been given ${itemFormatting}.`);
        }
      }

      // search milestones
      const searchItemLookup = [
        [50, [[5, 1]]],
        [100, [[5, 2]]],
        [150, [[6, 1]]],
        [300, [[6, 2]]],
        [500, [[7, 1]]],
        [750, [[7, 2]]],
        [1000, [[7, 2], [5, 1]]],
        [1500, [[7, 2], [5, 2]]],
        [2000, [[7, 2], [6, 1]]],
        [2500, [[7, 2], [6, 2]]],
        [3000, [[7, 3]]],
        [4000, [[7, 3], [5, 1]]],
        [5000, [[7, 3], [5, 2]]],
        [7500, [[7, 3], [6, 1]]],
        [10000, [[7, 3], [6, 2]]],
        [15000, [[7, 4]]],
        [20000, [[7, 4], [5, 1]]]
      ];

      for (const searchTier of searchItemLookup) {
        if (member.search_count >= searchTier[0] && member.search_count_milestone < searchTier[0]) {
          await client.query(`
            UPDATE users
            SET search_count_milestone = $1
            WHERE unique_id = $2::BIGINT
            RETURNING *
          `, [searchTier[0], member.unique_id]);
          const itemList = [];
          for (const itemSet of searchTier[1]) {
            await this.giveUserItem(client, guildID, memberID, itemSet[0], itemSet[1]);
            const itemDef = itemDefLookup.filter(x => x.id === itemSet[0])[0];
            itemList.push(`${itemSet[1]}x ${itemDef.name}`);
          }
          const itemFormatting = itemList.join(', ');
          milestones.push(`You've been searching a lot! As a reward for completing ${searchTier[0]} searches, you've been given ${itemFormatting}. Go out and search more!`);
        }
      }

      if (milestones.length > 0) {
        const milestoneFormatting = milestones.map(x => `- ${x}`).join('\n');
        const finalMessage = `<@${memberID}>, you've earned some milestones:\n${milestoneFormatting}`;
        
        await client.query('COMMIT');
        await destination.send(finalMessage, { split: true });
      } else {
        // no point even committing
        await client.query('ROLLBACK');
      }
    } finally {
      client.release();
    }
  }
}

module.exports = DatabaseBackend;
