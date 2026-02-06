import "dotenv/config";
import { Telegraf } from "telegraf";
import { initDb, saveUser, countUsers } from "./db.js";
import { setupTelegramBackup } from "./backup.js";
import { exportUsersJson } from "./db.js";


const bot = new Telegraf(process.env.BOT_TOKEN);

(async () => {
  await initDb();
setupTelegramBackup(bot, exportUsersJson);
bot.launch();

  bot.use(async (ctx, next) => {
    if (ctx.from) saveUser(ctx.from);
    return next();
  });

  bot.start(async (ctx) => {
    await ctx.reply("✅ Kamu sudah tersimpan di database.");
  });

  bot.command("count", async (ctx) => {
    const total = countUsers();
    await ctx.reply(`Total user tersimpan: ${total}`);
  });

  bot.command("getjson", async (ctx) => {
  await ctx.replyWithDocument({ source: "/app/data/users.json" });
});

  bot.launch();
  console.log("✅ Bot running...");
})();
