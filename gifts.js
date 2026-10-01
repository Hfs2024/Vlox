import schemas from "./schemas.js";
import mongoose from "mongoose";
import readline from "readline/promises";
import bcrypt from "bcrypt";
import config from "./config/backend.js";
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});
mongoose.connect(config.MONGO_URI)
  .then(() => handleCreateGift())
  .catch(err => console.log(`Failed to connect MongoDB: ${err.message}`));

async function handleCreateGift() {
  try {
    console.log("--- Create a New Lovely Gift 💜 ---");

    const password = await rl.question("Enter Password: ");
    const isMatch = await bcrypt.compare(password, config.ADMIN_PASSWORD);
    if (!isMatch) return console.log("Invalid password!");

    const count = parseInt(await rl.question("Enter Gift Uses Count: "));
    if (Number.isNaN(count) || count <= 0 || count > config.GIFT_USES_MAX) return console.error("Invalid input. Please enter a positive integer between 1 and 100.");

    const name = await rl.question("Enter Gift Name: ");
    if (!name.length || name.length > config.GIFT_NAME_MAX_LENGTH) return console.error("Invalid input. Gift name must be a type of string between 1 and 100.");

    const result = new schemas.Gifts({
      usesCount: count,
      name: name
    });

    await result.save();

    console.log(`Success! Gift created with ID: ${result._id}`);
  } catch (e) {
    console.error(`Error: ${e.message}`);
  } finally {
    rl.close();
    await mongoose.disconnect();
  }
}
