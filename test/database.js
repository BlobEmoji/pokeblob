// mocha
const assert = require('assert');
const mocha = require('mocha');

const describe = mocha.describe;
const it = mocha.it;
const run = mocha.run;

// test subject
const Director = require('../models/database/Director.js');


// actual test starts here
const director = new Director();

const mockMember = {
  guild: {
    id: 1,
    name: 'Test'
  },
  user: {
    id: 1,
    username: 'Test',
    discriminator: 1234,
    bot: false
  }
};

describe('Director', function() {
  describe('acquire', function() {
    it('should provide an active ConnectionInterface', async function() {
      const connection = await director.acquire();

      try {
        assert.ok(connection);
        assert.ok(connection.connection);
      } finally {
        await connection.release();
      }
    });
  });
});

describe('ConnectionInterfaceBase', function() {
  describe('query', function() {
    it('should receive query responses from postgres', async function() {
      const connection = await director.acquire();

      try {
        const response = await connection.query('SELECT 1 as one');

        assert.ok(response);
        assert.ok(response.rows);
        assert.ok(response.rows[0]);
        assert.ok(response.rows[0].one);
        assert.strictEqual(response.rows[0].one, 1);
      } finally {
        await connection.release();
      }
    });
  });

  describe('transaction', function() {
    it('should create and close transactions', async function() {
      const connection = await director.acquire();

      try {
        const transaction = await connection.transaction();

        assert.ok(transaction);

        // lol that's basically it
      } finally {
        await connection.release();
      }
    });

    it('should throw on duplicate transactions', async function() {
      const connection = await director.acquire();

      try {
        const transaction = await connection.transaction();

        assert.ok(transaction);

        let threw;

        try {
          await connection.transaction();
        } catch (e) {
          threw = e;
        }

        // confirm it DID throw
        assert.ok(threw);
      } finally {
        await connection.release();
      }
    });
  });

  describe('on::notification', function() {
    it('should receive notifications from postgres when they are fired', async function() {
      const connection = await director.acquire();

      try {
        const promise = new Promise(function(fulfill, reject) {
          let fulfilled = false;
          connection.on('notification', function(msg) {
            fulfilled = true;
            fulfill(msg);
          });

          setTimeout(function() {
            if (!fulfilled)
              reject('no response from postgres in time');
          }, 500);
        });

        await connection.query('LISTEN test_channel');
        await connection.query('NOTIFY test_channel, \'Hello from unit test!\'');

        const response = await promise;

        assert.ok(response);
        assert.strictEqual(response.channel, 'test_channel');
        assert.strictEqual(response.payload, 'Hello from unit test!');
      } finally {
        await connection.release();
      }
    });
  });
});

describe('Transaction', function() {
  describe('savepoint|rollbackTo', function() {
    it('should allow mid-transaction rollbacks', async function() {
      const connection = await director.acquire();

      try {
        const transaction = await connection.transaction();

        const dataOne = await connection.query('SELECT * FROM guilds WHERE name = \'hi\'');

        await connection.query('INSERT INTO guilds (id, "name") VALUES (-1, \'hi\')');

        const dataTwo = await connection.query('SELECT * FROM guilds WHERE name = \'hi\'');

        assert.strictEqual(dataOne.rows.length + 1, dataTwo.rows.length);

        const save = await transaction.savepoint();

        await connection.query('INSERT INTO guilds (id, "name") VALUES (-2, \'hi\')');

        const dataThree = await connection.query('SELECT * FROM guilds WHERE name = \'hi\'');

        assert.strictEqual(dataTwo.rows.length + 1, dataThree.rows.length);

        await transaction.rollbackTo(save);

        const dataFour = await connection.query('SELECT * FROM guilds WHERE name = \'hi\'');

        assert.strictEqual(dataTwo.rows.length, dataFour.rows.length);

        await transaction.rollback();

        const dataFive = await connection.query('SELECT * FROM guilds WHERE name = \'hi\'');

        assert.strictEqual(dataOne.rows.length, dataFive.rows.length);
      } finally {
        await connection.release();
      }
    });
  });
});

describe('ConnectionInterface', function() {
  describe('memberData', function() {
    it('should create a new user in a location with a center', async function() {
      const connection = await director.acquire();

      try {
        // transaction is here mainly for coverage *shrug*
        const transaction = await connection.transaction();

        const data = await connection.memberData(mockMember);

        assert.ok(data);
        assert.strictEqual(data.energy, 50);
        assert.strictEqual(data.loc_has_center, true);

        await transaction.commit();
      } finally {
        await connection.release();
      }
    });
  });

  describe('updateRoamingState', function() {
    it('should set users as roaming or not', async function() {
      const connection = await director.acquire();

      try {
        // throwaway transaction, will be disposed when the connection dies
        // this stops this unit test from affecting anything live
        // also doubles up as a transaction unit test
        await connection.transaction();

        const data = await connection.memberData(mockMember);

        assert.ok(data);
        assert.strictEqual(data.state[0], '0');  // not roaming

        const data2 = await connection.updateRoamingState(mockMember, true);

        assert.ok(data2);
        assert.strictEqual(data2.state[0], '1');  // roaming

        // second affirmation
        const data3 = await connection.memberData(mockMember);

        assert.ok(data3);
        assert.strictEqual(data3.state[0], '1');  // roaming

        const data4 = await connection.updateRoamingState(mockMember, false);

        assert.ok(data4);
        assert.strictEqual(data4.state[0], '0');  // not roaming

        // second affirmation
        const data5 = await connection.memberData(mockMember);

        assert.ok(data5);
        assert.strictEqual(data5.state[0], '0');  // not roaming
      } finally {
        await connection.release();
      }
    });
  });

  describe('clearEngaged|setEngaged', function() {
    it('should set users as engaged or not', async function() {
      const connection = await director.acquire();

      try {
        // ditto
        await connection.transaction();

        const data = await connection.memberData(mockMember);

        assert.ok(data);
        assert.strictEqual(data.state[1], '0');  // not engaged

        const data2 = await connection.setEngaged(mockMember, true);

        assert.ok(data2);
        assert.strictEqual(data2.state[1], '1');  // engaged

        // second affirmation
        const data3 = await connection.memberData(mockMember);

        assert.ok(data3);
        assert.strictEqual(data3.state[1], '1');  // engaged

        await connection.clearEngaged();

        const data4 = await connection.memberData(mockMember);

        assert.ok(data4);
        assert.strictEqual(data4.state[1], '0');  // not engaged
      } finally {
        await connection.release();
      }
    });
  });

  describe('modifyEnergy', function() {
    it('should modify user energy', async function() {
      const connection = await director.acquire();

      try {
        // ditto
        await connection.transaction();

        const data = await connection.memberData(mockMember);

        assert.ok(data);
        assert.strictEqual(data.energy, 50);

        const data2 = await connection.modifyEnergy(mockMember, 5);

        assert.ok(data2);
        assert.strictEqual(data2.energy, 55);

        // second affirmation
        const data3 = await connection.memberData(mockMember);

        assert.ok(data3);
        assert.strictEqual(data3.energy, 55);

        const data4 = await connection.modifyEnergy(mockMember, -5);

        assert.ok(data4);
        assert.strictEqual(data4.energy, 50);

        // second affirmation
        const data5 = await connection.memberData(mockMember);

        assert.ok(data5);
        assert.strictEqual(data5.energy, 50);

      } finally {
        await connection.release();
      }
    });
  });

  describe('modifySearchCount', function() {
    it('should modify user search count', async function() {
      const connection = await director.acquire();

      try {
        // ditto
        await connection.transaction();

        const data = await connection.memberData(mockMember);

        assert.ok(data);
        assert.strictEqual(data.search_count, 0);

        const data2 = await connection.modifySearchCount(mockMember, 5);

        assert.ok(data2);
        assert.strictEqual(data2.search_count, 5);

        // second affirmation
        const data3 = await connection.memberData(mockMember);

        assert.ok(data3);
        assert.strictEqual(data3.search_count, 5);

        const data4 = await connection.modifySearchCount(mockMember, -5);

        assert.ok(data4);
        assert.strictEqual(data4.search_count, 0);

        // second affirmation
        const data5 = await connection.memberData(mockMember);

        assert.ok(data5);
        assert.strictEqual(data5.search_count, 0);

      } finally {
        await connection.release();
      }
    });
  });

  describe('modifyCoinsTracked', function() {
    it('should modify coins, tracking the milestone', async function() {
      const connection = await director.acquire();

      try {
        // ditto
        await connection.transaction();

        const data = await connection.memberData(mockMember);

        assert.ok(data);
        assert.strictEqual(data.currency, 0);
        assert.strictEqual(data.accumulated_currency, 0);

        const data2 = await connection.modifyCoinsTracked(mockMember, 5);

        assert.ok(data2);
        assert.strictEqual(data2.currency, 5);
        assert.strictEqual(data2.accumulated_currency, 5);

        // second affirmation
        const data3 = await connection.memberData(mockMember);

        assert.ok(data3);
        assert.strictEqual(data3.currency, 5);
        assert.strictEqual(data3.accumulated_currency, 5);

        const data4 = await connection.modifyCoinsTracked(mockMember, -5);

        assert.ok(data4);
        assert.strictEqual(data4.currency, 0);
        assert.strictEqual(data4.accumulated_currency, 5);

        // second affirmation
        const data5 = await connection.memberData(mockMember);

        assert.ok(data5);
        assert.strictEqual(data4.currency, 0);
        assert.strictEqual(data4.accumulated_currency, 5);

      } finally {
        await connection.release();
      }
    });
  });

  describe('modifyCoinsUntracked', function() {
    it('should modify coins, not counting to the milestone', async function() {
      const connection = await director.acquire();

      try {
        // ditto
        await connection.transaction();

        const data = await connection.memberData(mockMember);

        assert.ok(data);
        assert.strictEqual(data.currency, 0);
        assert.strictEqual(data.accumulated_currency, 0);

        const data2 = await connection.modifyCoinsUntracked(mockMember, 5);

        assert.ok(data2);
        assert.strictEqual(data2.currency, 5);
        assert.strictEqual(data2.accumulated_currency, 0);

        // second affirmation
        const data3 = await connection.memberData(mockMember);

        assert.ok(data3);
        assert.strictEqual(data3.currency, 5);
        assert.strictEqual(data3.accumulated_currency, 0);

        const data4 = await connection.modifyCoinsUntracked(mockMember, -5);

        assert.ok(data4);
        assert.strictEqual(data4.currency, 0);
        assert.strictEqual(data4.accumulated_currency, 0);

        // second affirmation
        const data5 = await connection.memberData(mockMember);

        assert.ok(data5);
        assert.strictEqual(data4.currency, 0);
        assert.strictEqual(data4.accumulated_currency, 0);

      } finally {
        await connection.release();
      }
    });
  });

  describe('changeGuildLocale', function() {
    it('should change the locale of a guild', async function() {
      const connection = await director.acquire();

      try {
        // ditto
        await connection.transaction();

        const data = await connection.memberData(mockMember);

        assert.ok(data);
        assert.strictEqual(data.locale, 'en');

        const data2 = await connection.changeGuildLocale(mockMember.guild.id, 'ja');

        assert.ok(data2);
        assert.strictEqual(data2.locale, 'ja');

        // second affirmation
        const data3 = await connection.memberData(mockMember);

        assert.ok(data3);
        assert.strictEqual(data3.locale, 'ja');

        const data4 = await connection.changeGuildLocale(mockMember.guild.id, 'en');

        assert.ok(data4);
        assert.strictEqual(data4.locale, 'en');

        // second affirmation
        const data5 = await connection.memberData(mockMember);

        assert.ok(data5);
        assert.strictEqual(data5.locale, 'en');

      } finally {
        await connection.release();
      }
    });
  });

  describe('giveUserItem|takeUserItem|getUserItems', function() {
    it('should give/remove items from user, throwing if they don\'t have said item', async function() {
      const connection = await director.acquire();

      try {
        // ditto
        const transaction = await connection.transaction();

        // give improbability ball
        const itemOne = await connection.giveUserItem(mockMember, 9, 1);

        // use improbability ball
        const itemTwo = await connection.takeUserItem(mockMember, 9, 1);

        assert.strictEqual(itemOne.amount - 1, itemTwo.amount);

        let threw1;

        try {
          // take item user does not have
          await connection.takeUserItem(mockMember, 13, 1);
        } catch (e) {
          threw1 = e;
          // transaction doesn't need to be disposed because no entry is handled clientside
        }

        // confirm it DID throw
        assert.ok(threw1);

        let threw2;

        try {
          // try to take a ball off them they don't have
          await connection.takeUserItem(mockMember, 9, 1);
        } catch (e) {
          threw2 = e;
          // transaction must be destroyed else postgres complains (cannot commit broken transaction)
          await transaction.dispose();
        }

        // confirm it DID throw
        assert.ok(threw2);

        const items = await connection.getUserItems(mockMember);
        const itemThree = items.find(x => x.id === 9);

        assert.ok(itemThree === undefined || itemThree.amount === 0);

      } finally {
        await connection.release();
      }
    });
  });

  describe('getStoreItems', function() {
    it('should get items based on store potential', async function() {
      const connection = await director.acquire();

      try {
        // ditto
        await connection.transaction();

        const data = await connection.memberData(mockMember);

        const items = await connection.getStoreItems(data.loc_store_potential, data.roaming_effect);

        assert.ok(items);
        assert.ok(items.length >= 1);

      } finally {
        await connection.release();
      }
    });
  });

  describe('getRandomWeightedBlob|giveUserBlob', function() {
    it('should get random blobs based on area and give them to the user', async function() {
      const connection = await director.acquire();

      try {
        // ditto
        await connection.transaction();

        const data = await connection.memberData(mockMember);

        for (let index = 0; index < 5; index++) {
          const blobDef = await connection.getRandomWeightedBlob(data.loc_search_potential, data.roaming_effect);

          const blob = await connection.giveUserBlob(mockMember, blobDef, false);

          assert.strictEqual(blobDef.id, blob.blob_id);
        }

      } finally {
        await connection.release();
      }
    });
  });

  describe('updateParty|getParty|giveBlobParty|getUserBlobs', function() {
    it('should update or get the current party of the user', async function() {
      const connection = await director.acquire();

      try {
        // ditto
        await connection.transaction();

        const data = await connection.memberData(mockMember);

        const partyOne = await connection.getParty(mockMember);
        assert.strictEqual(partyOne.length, 0);

        const blobDef = await connection.getRandomWeightedBlob(data.loc_search_potential, data.roaming_effect);

        const { blob } = await connection.giveBlobParty(mockMember, blobDef);

        const partyTwo = await connection.getParty(mockMember);
        assert.strictEqual(partyTwo.length, 1);

        // add 5 random definitions to test the 4-blob ceiling works
        for (let index = 0; index < 5; index++) {
          const randomDef = await connection.getRandomWeightedBlob(data.loc_search_potential, data.roaming_effect);

          await connection.giveBlobParty(mockMember, randomDef);
        }

        // might as well throw this in here
        const fullBlobs = await connection.getUserBlobs(mockMember);
        assert.strictEqual(fullBlobs.length, 6);

        const partyThree = await connection.getParty(mockMember);
        assert.strictEqual(partyThree.length, 4);

        await connection.updateParty(mockMember, []);

        const partyFour = await connection.getParty(mockMember);
        assert.strictEqual(partyFour.length, 0);

        await connection.updateParty(mockMember, [blob.unique_id]);

        const partyFive = await connection.getParty(mockMember);
        assert.strictEqual(partyFive.length, 1);

      } finally {
        await connection.release();
      }
    });
  });

  describe('getUserEffects|giveUserEffect|consumeUserEffects', function() {
    it('should retrieve, give and consume effects on a user', async function() {
      const connection = await director.acquire();

      try {
        // ditto
        await connection.transaction();

        const effects1 = await connection.getUserEffects(mockMember);

        assert.strictEqual(effects1.length, 0);

        await connection.giveUserEffect(mockMember, 1, 3);

        // user now has effect
        const effects2 = await connection.getUserEffects(mockMember);

        assert.strictEqual(effects2.length, 1);
        assert.strictEqual(effects2[0].life, 3);

        // user's consumed effects
        const effects3 = await connection.consumeUserEffects(mockMember, 1, 2);

        assert.strictEqual(effects3.length, 1);
        assert.strictEqual(effects3[0].life, 1);

        // user should still have effect
        const effects4 = await connection.getUserEffects(mockMember);

        assert.strictEqual(effects4.length, 1);
        assert.strictEqual(effects4[0].life, 1);

        // consume last of effect
        const effects5 = await connection.consumeUserEffects(mockMember, 1);

        assert.strictEqual(effects5.length, 1);
        assert.strictEqual(effects5[0].life, 0);

        // user should no longer have effect
        const effects6 = await connection.getUserEffects(mockMember);

        assert.strictEqual(effects6.length, 0);

      } finally {
        await connection.release();
      }
    });
  });
});

describe('Director', function() {
  describe('release', function() {
    it('should release all connections', async function() {
      await director.release();
      // no asserts here, just checking if this throws
    });
  });
});

setTimeout(run, 1000);
