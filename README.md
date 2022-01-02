# lia-bot

Lia bot used for the Knuckle Cracker Discord server.
discord.gg/knucklecracker

Prerequisites:
  * Node v16.13 or higher
  * MySQL 8

The bot expects an `auth.json` file be placed in the root directory with the following structure:
```json
{
    "token": "discord bot token here",
    "sql": {
        "user": "root",
        "password": "root"
    }
}
```
