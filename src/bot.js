import "dotenv/config";
import { Telegraf } from "telegraf";
import { initDb, saveUser, countUsers } from "./db.js";

const bot = new Telegraf(process.env.BOT_TOKEN);

(async () => {
  await initDb();

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

  bot.on("message", async (ctx) => {
    await ctx.reply("OK 👍");
  });

  bot.launch();
  console.log("✅ Bot running...");
})();
