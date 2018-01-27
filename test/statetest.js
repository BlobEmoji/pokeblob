const assert = require('assert');
const mocha = require('mocha');

const describe = mocha.describe;
const it = mocha.it;
const run = mocha.run;

const clientFactory = require('../clientfactory.js');
const config = require('../config.js');

clientFactory({ config: config, fetchAllMembers: true }).then((client, err) => {
  if (err)
    throw err;

  describe('client', function() {
    describe('.unloadCommand', function() {
      it('should unload a pre-loaded command successfully', async function() {
        assert.strictEqual(await client.unloadCommand('./commands', 'blobs'), false);
      });
    });

    describe('.loadCommand', function() {
      it('should load an existing command successfully', function() {
        assert.strictEqual(client.loadCommand('./commands', 'blobs.js'), false);
      });
    });

    describe('.getSettings', function() {
      it('should get a valid settings object', function() {
        const settings = client.getSettings('1');

        assert.equal(typeof settings, 'object');
        assert.equal(typeof settings.prefix, 'string');
      });
    });

    describe('.db', function() {
      describe('.acquire', function() {
        it('should return a usable connection', async function() {
          const connection = await client.db.acquire();

          try {
            const record = await connection.query('SELECT 1 AS one, 2 AS two, 3 AS three');

            // lol
            assert.equal(typeof record, 'object');
            assert.equal(typeof record.rows, 'object');
            assert.equal(typeof record.rows[0], 'object');
            assert.equal(record.rows[0].one, 1);
            assert.equal(record.rows[0].two, 2);
            assert.equal(record.rows[0].three, 3);
          } finally {
            connection.release();
          }
        });
      });

      describe('.ensureMember', function() {
        it('should return a member with energy and currency', async function() {
          const connection = await client.db.acquire();

          try {
            const member = await client.db.ensureMember(connection, '1', '1');

            assert.equal(typeof member, 'object');
            assert.equal(typeof member.energy, 'number');
            assert.equal(typeof member.currency, 'number');
          } finally {
            connection.release();
          }
        });

        it('should supply the new user with their basic inventory', async function() {
          const connection = await client.db.acquire();

          try {
            const items = await client.db.getUserInventory(connection, '1', '1');

            assert.equal(typeof items, 'object');
            assert.equal(typeof items[0].amount, 'number');
            const itemSum = items.map(x => x.amount).reduce((a, b) => a + b, 0);

            assert.ok(itemSum >= 3);
          } finally {
            connection.release();
          }
        });
      });

      describe('.modifyMember', function() {
        it('should relatively modify a member\'s energy', async function() {
          const connection = await client.db.acquire();

          try {
            const member = await client.db.modifyMemberEnergy(connection, '1', '1', 3);

            assert.equal(typeof member, 'object');
            assert.equal(typeof member.energy, 'number');
            assert.ok(member.energy >= 3);

            const member2 = await client.db.modifyMemberEnergy(connection, '1', '1', 2);

            assert.equal(typeof member2, 'object');
            assert.equal(typeof member2.energy, 'number');
            assert.ok(member2.energy >= 5);

            assert.equal(member.energy + 2, member2.energy);

            const member3 = await client.db.modifyMemberEnergy(connection, '1', '1', -5);

            assert.equal(typeof member3, 'object');
            assert.equal(typeof member3.energy, 'number');

            assert.equal(member.energy - 3, member3.energy);
            assert.equal(member2.energy - 5, member3.energy);
          } finally {
            connection.release();
          }
        });
      });

      describe('.[give|take]UserItem', function() {
        it('should give to/take from a user a certain amount of a given item', async function() {
          const connection = await client.db.acquire();

          try {
            const item = await client.db.giveUserItem(connection, '1', '1', 2, 5);

            assert.equal(typeof item, 'object');
            assert.equal(typeof item.amount, 'number');
            assert.ok(item.amount >= 5);

            const itemAfter = await client.db.removeUserItem(connection, '1', '1', 2, 3);

            assert.equal(typeof itemAfter, 'object');
            assert.equal(typeof itemAfter.amount, 'number');

            assert.ok(itemAfter.amount < item.amount);
          } finally {
            connection.release();
          }
        });
      });

      describe('.[give|take]UserCurrency', function() {
        it('should give to/take from a user a certain amount of tracked currency', async function() {
          const connection = await client.db.acquire();

          try {
            const member = await client.db.giveUserCurrency(connection, '1', '1', 10);

            assert.equal(typeof member, 'object');
            assert.equal(typeof member.currency, 'number');
            assert.equal(typeof member.accumulated_currency, 'number');
            assert.ok(member.currency >= 10);
            assert.ok(member.accumulated_currency >= 10);

            const memberAfter = await client.db.takeUserCurrency(connection, '1', '1', 5);

            assert.equal(typeof memberAfter, 'object');
            assert.equal(typeof memberAfter.currency, 'number');
            assert.equal(typeof memberAfter.accumulated_currency, 'number');

            assert.ok(memberAfter.currency < member.currency);
            assert.equal(memberAfter.accumulated_currency, member.accumulated_currency);
          } finally {
            connection.release();
          }
        });
      });

      describe('.giveUserUntrackedCurrency', function() {
        it('should give a user untracked currency', async function() {
          const connection = await client.db.acquire();

          try {
            const member = await client.db.ensureMember(connection, '1', '1');

            assert.equal(typeof member, 'object');
            assert.equal(typeof member.currency, 'number');
            assert.equal(typeof member.accumulated_currency, 'number');

            const memberAfter = await client.db.giveUserUntrackedCurrency(connection, '1', '1', 10);

            assert.equal(typeof memberAfter, 'object');
            assert.equal(typeof memberAfter.currency, 'number');
            assert.equal(typeof memberAfter.accumulated_currency, 'number');

            assert.ok(memberAfter.currency > member.currency);
            assert.equal(memberAfter.accumulated_currency, member.accumulated_currency);
          } finally {
            connection.release();
          }
        });
      });

      describe('.acknowledgeBlob', function() {
        it('should acknowledge a blob being seen', async function() {
          const connection = await client.db.acquire();

          try {
            const blobDef = await client.db.getRandomWeightedBlob(connection);

            assert.equal(typeof blobDef, 'object');
            assert.equal(typeof blobDef.rarity_name, 'string');
            assert.equal(typeof blobDef.rarity_scalar, 'number');
            assert.equal(typeof blobDef.emoji_name, 'string');

            await client.db.acknowledgeBlob(connection, '1', '1', blobDef.unique_id, 1);

            const userBlobs = await client.db.getUserBlobs(connection, '1', '1');
            const blobIDs = userBlobs.map(x => x.blob_id);

            assert.ok(blobIDs.includes(blobDef.unique_id));
          } finally {
            connection.release();
          }
        });
      });

      describe('.[give|take]UserBlob', function() {
        it('should give/take a respective blob', async function() {
          const connection = await client.db.acquire();

          try {
            const blobDef = await client.db.getRandomWeightedBlob(connection);

            assert.equal(typeof blobDef, 'object');
            assert.equal(typeof blobDef.rarity_name, 'string');
            assert.equal(typeof blobDef.rarity_scalar, 'number');
            assert.equal(typeof blobDef.emoji_name, 'string');

            const blob = await client.db.giveUserBlob(connection, '1', '1', blobDef.unique_id, 1);

            assert.equal(typeof blob, 'object');
            assert.equal(typeof blob.amount, 'number');

            const blobAfter = await client.db.takeUserBlob(connection, '1', '1', blobDef.unique_id, 1);

            assert.equal(typeof blobAfter, 'object');
            assert.equal(typeof blobAfter.amount, 'number');

            assert.equal(blobAfter.amount, blob.amount - 1);
          } finally {
            connection.release();
          }
        });
      });

      describe('.giveUserEffect', function() {
        it('should give a user a status effect', async function() {
          const connection = await client.db.acquire();

          try {
            const effect = await client.db.giveUserEffect(connection, '1', '1', 1, 10);

            assert.equal(typeof effect, 'object');
            assert.equal(typeof effect.life, 'number');
            assert.ok(effect.life >= 10);
          } finally {
            connection.release();
          }
        });
      });

      describe('.consumeUserEffects', function() {
        it('should consume and return data on a certain type of active effects', async function() {
          const connection = await client.db.acquire();

          try {
            const effects = await client.db.getUserEffects(connection, '1', '1');

            assert.equal(typeof effects, 'object');
            assert.equal(typeof effects[0].life, 'number');
            const effectSum = effects.map(x => x.life).reduce((a, b) => a + b, 0);

            const effectsAfter = await client.db.consumeUserEffects(connection, '1', '1', 1);

            assert.equal(typeof effectsAfter, 'object');
            assert.equal(typeof effectsAfter[0].life, 'number');
            const effectsAfterSum = effectsAfter.map(x => x.life).reduce((a, b) => a + b, 0);

            // check effects have been consumed
            assert.ok(effectsAfterSum < effectSum);
          } finally {
            connection.release();
          }
        });
      });

      describe('.getUserEffects', function() {
        it('should return member effects', async function() {
          const connection = await client.db.acquire();

          try {
            const effects = await client.db.getUserEffects(connection, '1', '1');

            assert.equal(typeof effects, 'object');

            for (const effect of effects) {
              assert.equal(typeof effect, 'object');
              assert.equal(typeof effect.name, 'string');
              assert.equal(typeof effect.life, 'number');
            }
          } finally {
            connection.release();
          }
        });
      });

      describe('.getStoreItems', function() {
        it('should return an array of item definitions with names, descriptions and a value', async function() {
          const connection = await client.db.acquire();

          try {
            const itemDefinitions = await client.db.getStoreItems(connection);

            assert.equal(typeof itemDefinitions, 'object');
            
            for (const item of itemDefinitions) {
              assert.equal(typeof item, 'object');
              assert.equal(typeof item.name, 'string');
              assert.equal(typeof item.description, 'string');
              assert.equal(typeof item.value, 'number');
            }
          } finally {
            connection.release();
          }
        });
      });

      describe('.getStoreItemByName', function() {
        it('should get a item\'s definition by its name', async function() {
          const connection = await client.db.acquire();

          try {
            const item = await client.db.getStoreItemByName(connection, 'basic ball');

            assert.equal(typeof item, 'object');
            assert.equal(typeof item.name, 'string');
            assert.equal(typeof item.description, 'string');
            assert.equal(typeof item.value, 'number');
          } finally {
            connection.release();
          }
        });
      });

      describe('.getBlobByName', function() {
        it('should get a blob\'s definition by its name', async function() {
          const connection = await client.db.acquire();

          try {
            const blob = await client.db.getBlobByName(connection, 'blobsmile');

            assert.equal(typeof blob, 'object');
            assert.equal(typeof blob.rarity, 'number');
            assert.equal(typeof blob.emoji_name, 'string');
          } finally {
            connection.release();
          }
        });
      });

      describe('.getRandomWeightedBlob', function() {
        it('should return a random blob definition', async function() {
          const connection = await client.db.acquire();

          try {
            for (let index=0; index < 10; index++) {
              const blob = await client.db.getRandomWeightedBlob(connection);

              assert.equal(typeof blob, 'object');
              assert.equal(typeof blob.rarity_name, 'string');
              assert.equal(typeof blob.rarity_scalar, 'number');
              assert.equal(typeof blob.emoji_name, 'string');
              console.log(`Picking random blobs (${index + 1}/10): ${blob.emoji_name}:${blob.emoji_id}`);
            }
            console.log('These should be different every time the test passes.');
          } finally {
            connection.release();
          }
        });
      });

      describe('.updateMilestonesBackground', function() {
        it('should update a given user\'s milestones for coins', async function() {
          const connection = await client.db.acquire();

          try {
            const member = await client.db.giveUserCurrency(connection, '1', '1', 50);

            assert.equal(typeof member, 'object');
            assert.equal(typeof member.currency, 'number');
            assert.equal(typeof member.accumulated_currency, 'number');
            assert.ok(member.currency >= 50);
            assert.ok(member.accumulated_currency >= 50);

            await client.db.updateMilestonesBackground({ send: () => {} }, '1', '1');

            const memberAfter = await client.db.ensureMember(connection, '1', '1');

            assert.equal(typeof memberAfter, 'object');
            assert.equal(typeof memberAfter.currency, 'number');
            assert.equal(typeof memberAfter.accumulated_currency, 'number');
            assert.ok(memberAfter.currency > member.currency);
            assert.ok(memberAfter.accumulated_currency > member.accumulated_currency);
          } finally {
            connection.release();
          }
        });

        it('shouldn\'t reward a user twice for coins', async function() {
          const connection = await client.db.acquire();

          try {
            const member = await client.db.ensureMember(connection, '1', '1');

            assert.equal(typeof member, 'object');
            assert.equal(typeof member.currency, 'number');
            assert.equal(typeof member.accumulated_currency, 'number');

            await client.db.updateMilestonesBackground({ send: () => {} }, '1', '1');

            const memberAfter = await client.db.ensureMember(connection, '1', '1');

            assert.equal(typeof memberAfter, 'object');
            assert.equal(typeof memberAfter.currency, 'number');
            assert.equal(typeof memberAfter.accumulated_currency, 'number');

            assert.equal(memberAfter.currency, member.currency);
            assert.equal(memberAfter.accumulated_currency, member.accumulated_currency);

          } finally {
            connection.release();
          }
        });

        it('should update a given user\'s milestones for blobs', async function() {
          const connection = await client.db.acquire();

          try {
            const items = await client.db.getUserInventory(connection, '1', '1');

            assert.equal(typeof items, 'object');
            assert.equal(typeof items[0].amount, 'number');
            const itemSum = items.map(x => x.amount).reduce((a, b) => a + b, 0);

            for (let blobIndex = 1; blobIndex < 11; blobIndex++) {
              await client.db.giveUserBlob(connection, '1', '1', blobIndex, 1);
            }

            await client.db.updateMilestonesBackground({ send: () => {} }, '1', '1');

            const itemsAfter = await client.db.getUserInventory(connection, '1', '1');

            assert.equal(typeof itemsAfter, 'object');
            assert.equal(typeof itemsAfter[0].amount, 'number');
            const itemAfterSum = itemsAfter.map(x => x.amount).reduce((a, b) => a + b, 0);

            // check the user has received reward for catching a blob
            assert.ok(itemAfterSum > itemSum);

          } finally {
            connection.release();
          }
        });

        it('shouldn\'t reward a user twice for blobs', async function() {
          const connection = await client.db.acquire();

          try {
            const items = await client.db.getUserInventory(connection, '1', '1');

            assert.equal(typeof items, 'object');
            assert.equal(typeof items[0].amount, 'number');
            const itemSum = items.map(x => x.amount).reduce((a, b) => a + b, 0);

            await client.db.updateMilestonesBackground({ send: () => {} }, '1', '1');

            const itemsAfter = await client.db.getUserInventory(connection, '1', '1');

            assert.equal(typeof itemsAfter, 'object');
            assert.equal(typeof itemsAfter[0].amount, 'number');
            const itemAfterSum = itemsAfter.map(x => x.amount).reduce((a, b) => a + b, 0);

            assert.equal(itemAfterSum, itemSum);

          } finally {
            connection.release();
          }
        });

        it('should update a given user\'s milestones for searching', async function() {
          const connection = await client.db.acquire();

          try {
            const items = await client.db.getUserInventory(connection, '1', '1');

            assert.equal(typeof items, 'object');
            assert.equal(typeof items[0].amount, 'number');
            const itemSum = items.map(x => x.amount).reduce((a, b) => a + b, 0);

            // simulate 50 searches
            // inefficient, but authentic :tm:
            for (let searchCount = 0; searchCount < 50; searchCount++) {
              await client.db.bumpSearchCount(connection, '1', '1');
            }

            await client.db.updateMilestonesBackground({ send: () => {} }, '1', '1');

            const itemsAfter = await client.db.getUserInventory(connection, '1', '1');

            assert.equal(typeof itemsAfter, 'object');
            assert.equal(typeof itemsAfter[0].amount, 'number');
            const itemAfterSum = itemsAfter.map(x => x.amount).reduce((a, b) => a + b, 0);

            // check the user has received reward for their searches
            assert.ok(itemAfterSum > itemSum);

          } finally {
            connection.release();
          }
        });

        it('shouldn\'t reward a user twice for searching', async function() {
          const connection = await client.db.acquire();

          try {
            const items = await client.db.getUserInventory(connection, '1', '1');

            assert.equal(typeof items, 'object');
            assert.equal(typeof items[0].amount, 'number');
            const itemSum = items.map(x => x.amount).reduce((a, b) => a + b, 0);

            await client.db.updateMilestonesBackground({ send: () => {} }, '1', '1');

            const itemsAfter = await client.db.getUserInventory(connection, '1', '1');

            assert.equal(typeof itemsAfter, 'object');
            assert.equal(typeof itemsAfter[0].amount, 'number');
            const itemAfterSum = itemsAfter.map(x => x.amount).reduce((a, b) => a + b, 0);

            assert.equal(itemAfterSum, itemSum);

          } finally {
            connection.release();
          }
        });
      });
    });
  });

  // wait for commands and stuff to load in
  setTimeout(run, 1000);
});
