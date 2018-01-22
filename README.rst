PokéBlob
=========

.. |d.js| image:: https://img.shields.io/badge/Discord.js-12.0-blue.svg

.. |node| image:: https://img.shields.io/badge/Node-8.9.4-brightgreen.svg?label=Node
   :target: https://nodejs.org/en/download/

.. |circleci| image:: https://img.shields.io/circleci/project/github/BlobEmoji/pokeblob.svg?label=CircleCI
   :target: https://circleci.com/gh/BlobEmoji/pokeblob

.. |issues| image:: https://img.shields.io/github/issues/BlobEmoji/pokeblob.svg?colorB=3333ff
   :target: https://github.com/BlobEmoji/pokeblob/issues

.. |commits| image:: https://img.shields.io/github/commit-activity/w/BlobEmoji/pokeblob.svg
   :target: https://github.com/BlobEmoji/pokeblob/commits

|d.js| |node| |circleci| |issues| |commits|

PokéBlob is the bot created by the Google Emoji team for the 1 year server anniversary.
It requires Node >=8 and the `Discord.js <https://www.npmjs.com/package/discord.js>`__ library.

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

After all the dependencies install, you will be prompted for your bots token. Simply paste that into the console, and hit enter. The setup script will write the config for you.

.. code-block:: sh

   node .

And the bot will launch.

Launching with docker-compose
^^^^^^^^^^^^^^^^^^^^^^^^^^^^^

First, we need to install all dependencies.

.. code-block:: sh

   node ./util/setup.js

Running this setup.js file will prompt you for your token. Simply input it, and it'll write the config for you.

.. code-block:: sh

   docker-compose up

This will build the bot. However, the bot will not launch, due to PostgreSQL being slow on the first launch. You just need to do `Ctrl + C` and run `docker-compose up` again.

Common Errors
-------------

If you get an error saying the bot cannot find a package, you simply need to run the following, replacing package name with the name of the package.

.. code-block:: sh

   npm install <package name>