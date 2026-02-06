import "dotenv/config";
import { Telegraf } from "telegraf";
import { initDb, saveUser, countUsers } from "./db.js";
import fs from "fs";

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

  bot.command("getdb", async (ctx) => {
  const file = "/app/data/crm.sqlite";
  if (!fs.existsSync(file)) {
    return ctx.reply("Database belum ada.");
  }
  await ctx.replyWithDocument({ source: file });
});
  
  bot.on("message", async (ctx) => {
    await ctx.reply("OK 👍");
  });

  bot.launch();
  console.log("✅ Bot running...");
})();
