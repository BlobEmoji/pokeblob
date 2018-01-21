
CREATE TABLE IF NOT EXISTS guilds (
    id BIGINT NOT NULL PRIMARY KEY
);

CREATE OR REPLACE FUNCTION day_timestamp() RETURNS INT AS
$$ SELECT floor(extract(epoch from now()) / 86400)::INT $$
LANGUAGE SQL;

CREATE TABLE IF NOT EXISTS users (
    -- unique ID is a single number used to identify this member-guild id pair.
    -- it doesn't have any particular significance except for foreign keys from
    -- other tables.
    unique_id BIGSERIAL PRIMARY KEY,

    -- this member's discord ID
    id BIGINT NOT NULL,

    -- the ID of the guild this record corresponds to
    guild BIGINT NOT NULL REFERENCES guilds ON DELETE RESTRICT,

    -- this causes conflicts on the same member but not on the same member
    -- in different guilds for testing reasons
    UNIQUE (id, guild),

    -- energy the user has right now (or the last time it was relevant)
    -- bot will update this as it checks for user existence during interactions
    energy INT CONSTRAINT energy_clamp CHECK (energy >= 0) DEFAULT 50,

    -- defined as floor(extract(epoch from now()) / 86400)
    -- number defining how many days has passed since 1970-01-01 00:00 UTC
    last_used_energy SMALLINT DEFAULT day_timestamp(),

    -- how much money the user has at the present time
    currency INT DEFAULT 0,

    -- total currency a user has acquired in their lifetime (non-deductable)
    accumulated_currency INT DEFAULT 0,

    -- amount of searches a user has done in their lifetime (non-deductable)
    search_count INT DEFAULT 0,


    -- milestone stuff, this covers the 'steps' of a milestone a user has already received rewards for
    unique_blob_milestone INT DEFAULT 0,
    search_count_milestone INT DEFAULT 0,
    accumulated_currency_milestone INT DEFAULT 0,
    currency_milestone INT DEFAULT 0
);

CREATE TABLE IF NOT EXISTS itemmodes (
    -- what mode this item is, this determines how the code will react to it
    id SERIAL PRIMARY KEY
);

CREATE TABLE IF NOT EXISTS itemdefs (
    -- the behavior of these items should be determinable just from their records
    -- however in edge cases or for other reasons the ID can be used to specify
    -- specific unique behaviors if required.
    id SERIAL PRIMARY KEY,

    -- name of this item, and therefore how it should display as text.
    "name" VARCHAR(128),

    -- value is how much this item sells in the store for.
    -- if this is a minus number, do not show this in the store.
    "value" INT,

    -- potential is defined on a mode-specific basis
    -- for example, for a ball this may be its effectiveness as a percentage
    -- but for an energy regen it might be how much energy it gives you
    "potential" INT,

    mode INT REFERENCES itemmodes ON DELETE RESTRICT,

    "description" TEXT,

    confirm_use_message TEXT
);

CREATE TABLE IF NOT EXISTS items (
    -- unique ID is a single number used to identify this item-member id pair.
    -- it doesn't have any particular significance except for foreign keys from
    -- other tables.
    unique_id BIGSERIAL PRIMARY KEY,

    -- ID of the item this corresponds to
    item_id INT NOT NULL REFERENCES itemdefs ON DELETE RESTRICT,

    -- ID of the user this item belongs to
    user_id BIGINT NOT NULL REFERENCES users ON DELETE RESTRICT,

    UNIQUE (item_id, user_id),

    -- is this item currently in effect? (for lures, etc)
    active BOOLEAN DEFAULT false,

    -- how much 'life' the item has left, (for lures, etc)
    activity_lifetime INT CONSTRAINT lifetime_clamp CHECK (activity_lifetime >= 0) DEFAULT 10,

    -- amount of the item the user possesses at the time
    amount INT CONSTRAINT amount_clamp CHECK (amount >= 0) DEFAULT 1
);

CREATE TABLE IF NOT EXISTS blobrarity (
    id SERIAL PRIMARY KEY,

    "name" VARCHAR(128),

    -- scalar for random rolls that decreases winning roll chance
    -- e.g. 20 will unfairly bias against rolling the blob at an
    -- avg of 50% lose rate compared to normal blobs
    rarity_scalar INT DEFAULT 10
);

CREATE TABLE IF NOT EXISTS blobdefs (
    -- unique ID is a single number used to identify this blob.
    -- this way if the emoji ID changes we won't break everything
    unique_id BIGSERIAL PRIMARY KEY,

    -- the ID of the emoji in discord
    emoji_id BIGINT,

    -- the name of the emoji in discord
    emoji_name VARCHAR(32),

    -- rarity of this blob
    rarity INT NOT NULL REFERENCES blobrarity ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS blobs (

    unique_id BIGSERIAL PRIMARY KEY,

    blob_id BIGINT NOT NULL REFERENCES blobdefs ON DELETE RESTRICT,

    user_id BIGINT NOT NULL REFERENCES users ON DELETE RESTRICT,

    UNIQUE (blob_id, user_id),

    -- whether this blob has been caught before
    caught BOOLEAN DEFAULT false,

    amount INT CONSTRAINT amount_clamp CHECK (amount >= 0) DEFAULT 0
);

CREATE TABLE IF NOT EXISTS effecttypes (
    id SERIAL PRIMARY KEY
);

CREATE TABLE IF NOT EXISTS effectdefs (

    unique_id SERIAL PRIMARY KEY,

    "name" TEXT,

    -- this effect's 'potential', if applicable.
    "potential" INT,

    "type" INT NOT NULL REFERENCES effecttypes
);

CREATE TABLE IF NOT EXISTS effects (

    unique_id BIGSERIAL PRIMARY KEY,

    effect_id INT NOT NULL REFERENCES effectdefs ON DELETE RESTRICT,

    user_id BIGINT NOT NULL REFERENCES users ON DELETE RESTRICT,

    UNIQUE(effect_id, user_id),

    -- how much 'life' this effect has left before it expires
    life INT CONSTRAINT life_clamp CHECK (life >= 0) DEFAULT 0
);
