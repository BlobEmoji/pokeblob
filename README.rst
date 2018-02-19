PokéBlob
=========

.. |d.js| image:: https://img.shields.io/badge/Discord.js-12.0-blue.svg
   :target: https://discord.js.org/

.. |node| image:: https://img.shields.io/badge/Node-9.4.0-brightgreen.svg?label=Node
   :target: https://nodejs.org/en/download/

.. |circleci| image:: https://img.shields.io/circleci/project/github/BlobEmoji/pokeblob.svg?label=CircleCI
   :target: https://circleci.com/gh/BlobEmoji/pokeblob

.. |issues| image:: https://img.shields.io/github/issues/BlobEmoji/pokeblob.svg?colorB=3333ff
   :target: https://github.com/BlobEmoji/pokeblob/issues

.. |commits| image:: https://img.shields.io/github/commit-activity/w/BlobEmoji/pokeblob.svg
   :target: https://github.com/BlobEmoji/pokeblob/commits

|d.js| |node| |circleci| |issues| |commits|

+-------------------------------------------------------------------------------------------------------------------------------------------------+
| You are currently on the **post-event** branch of PokéBlob.                                                                                     |
|                                                                                                                                                 |
| It is being primarily maintained and developed by `Gorialis <https://github.com/Gorialis>`__.                                                   |
|                                                                                                                                                 |
| It is:                                                                                                                                          |
|                                                                                                                                                 |
| - Incomplete                                                                                                                                    |
| - Unstable                                                                                                                                      |
| - Subject to change at any time                                                                                                                 |
|                                                                                                                                                 |
| Schema and internal changes may be made without prior warning or instruction.                                                                   |
|                                                                                                                                                 |
| **Any data collected or stored by the bot as it is on this branch may be irrecoverably destroyed or inaccessible by even a single commit.**     |
|                                                                                                                                                 |
| **Only** run the bot to debug its features or commands.                                                                                         |
|                                                                                                                                                 |
| In addition:                                                                                                                                    |
|                                                                                                                                                 |
| - Do not push directly to this branch. Unauthorized direct pushes will be rebased out.                                                          |
| - Only PR to this branch if you have seeked guidance regarding implementation and design beforehand.                                            |
| - Do not rely on the branch history to remain linear. Rebases may require you to reset any clones you have of this branch.                      |
+-------------------------------------------------------------------------------------------------------------------------------------------------+

PokéBlob is the bot created by the Blob Emoji team for the 1 year server anniversary.
It requires Node >=9.4 and the `discord.js <https://www.npmjs.com/package/discord.js>`__ library.

It is not recommended to run an instance of this bot yourself. The code is here primarily for reference and bug fixing.

Prerequisites
-------------

This project has a number of requirements for deployment:

- ``git`` and ``npm``, for installing dependencies
- A PostgreSQL >=9.6 server to store data
- Docker and docker-compose (Optional)

Running the Bot
---------------

Launch with Node
^^^^^^^^^^^^^^^^
First, install all dependencies.

.. code-block:: sh

   npm install

After all the dependencies install, copy the `config.example.yml <https://github.com/BlobEmoji/pokeblob/blob/post-event/config.example.yml>`__ included in the root directory. Rename it to ``config.yml`` and substitute information in as necessary.

And the bot will launch.

Launching with docker-compose
^^^^^^^^^^^^^^^^^^^^^^^^^^^^^

First, copy the config as above. Once your config is ready, just run

.. code-block:: sh

   docker-compose up

This will build and start the bot. If you need to rebuild the bot, just use:

.. code-block:: sh

   docker-compose down
   docker-compose rm -f
   docker-compose build --no-cache
   docker-compose up

Common Errors
-------------

If you get an error saying the bot cannot find a package, you simply need to run the following, replacing package name with the name of the package.

.. code-block:: sh

   npm install <package name>

License
--------
PokéBlob is released under the `MIT License`_.

.. _MIT License: https://github.com/BlobEmoji/pokeblob/blob/master/LICENSE
