# lia-bot

Lia bot used for the Knuckle Cracker Discord server.
discord.gg/knucklecracker

# Prerequisites
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

# Adding new commands
Most commands are defined in the root `bot.js` file. The `addCommand` method expects a settings object to be passed in with the following properties:
  * `baseNames: string | string[]` - The first name for the command. If an array is passed in, all strings in the array can be used to call this command. The first element in the array will be used as the primary name displayed in `!help`, and the rest of the elements will be aliases.
  * `commandNames: string | string[] | null` - Optional. The second name for the command, that must be followed by a space after the first name. If an array is passed in, it works the same way as with `baseNames`.
  * `categoryNames: string | string[]` - The name of the category this command will be a part of. This will categorize the command in `!help`. If an array is passed in, it works the same way as with `baseNames`.
  * `authorityLevel: string | string[] | null` - This is used to restrict which roles have access to the command. `null` means the command is admin only. `"EVERYONE"` means that the command is not restricted. Any other chosen string, e.g. `"MODERATOR"`, has to be then registered on Discord by an admin using `!role MODERATOR <role_id_or_ping>`.

## Authority levels
  * The following authority level names are used to restrict commands: `"MODERATOR"`, `"EMERITUS_MODERATOR"`, `"EVENT_MOD"`.
  * `"CHAMPION_OF_KC"`, if registered, will be used for Competition winners and Experience players.
  * `"MASTER_OF_CHRONOM"`, if registered, will be used for Chronom players.
