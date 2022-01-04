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

The MySQL user requires elevated permissions and must identify with mysql_native_password:
```mysql
CREATE USER 'username'@'localhost' IDENTIFIED WITH mysql_native_password BY 'password';
```

The Discord bot requires all Privileged Gateway Intents to be enabled.
[Applications](https://discord.com/developers/applications/) -> Bot -> Privileged Gateway Intents -> Tick all boxes.
