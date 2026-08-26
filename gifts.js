require("dotenv").config({ quiet: true });
const schemas = require("./schemas.js");
const mongoose = require("mongoose");
const readline = require("readline/promises");
const bcrypt = require("bcrypt");
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

// Connect MonogDB
mongoose.connect(process.env.PRODUCTION_MONGO_URI)
  .then(() => handleCreateGift())
  .catch(err => console.log(`Failed to connect MongoDB: ${err.message}`));

// Handle create gifts
async function handleCreateGift() {
  try {
    console.log('--- Create a New Lovely Gift 💜 ---');

    // Auth
    const password = await rl.question("Enter Password: ");
    const isMatch = await bcrypt.compare(password, ADMIN_PASSWORD);
    if (!isMatch) {
      console.log("Invalid password!");
      return;
    }

    // Count
    const count = parseInt(await rl.question("Enter Gift Uses Count: "));
    if (isNaN(count) || count <= 0 || count > 100) {
      console.error("Invalid input. Please enter a positive integer between 1 and 100.");
      return;
    }

    // Name
    const name = String(await rl.question("Enter Gift Name: "));
    if (!name || name.length <= 0 || name.length > 100) {
      console.error("Invalid input. Gift name must be a type of string between 1 and 100.");
      return;
    }

    // Insert
    const result = new schemas.Gifts({
      usesCount: count,
      name: name
    });

    await result.save();

    // Success
    console.log(`Success! Gift created with ID: ${result._id}`);
  } catch (e) {
    console.error(`Error: ${e.message}`);
  } finally {
    rl.close();
    await mongoose.disconnect(); 
  }
}
