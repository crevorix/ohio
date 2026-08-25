import fs from "fs";
import path from "path";

import {
  getTop100,
  saveTop100,
  displayTop100,
  TopToken,
} from "./top100";

async function update() {
  try {
    console.log("\nUpdating Binance Top 100...\n");

    const tokens = await getTop100();

    if (tokens.length < 100) {
      console.warn(
        `WARNING: Only ${tokens.length} eligible tokens found.`
      );
    }

    saveTop100(tokens);
    displayTop100(tokens);
  } catch (error: any) {
    console.error("\nFailed to update Top 100:");

    if (error.response?.data) {
      console.error(error.response.data);
    } else {
      console.error(error.message);
    }

    process.exit(1);
  }
}

function list() {
  const filePath = path.join(
    process.cwd(),
    "top100",
    "data",
    "top100.json"
  );

  if (!fs.existsSync(filePath)) {
    console.log("No saved Top 100 data found.");
    console.log("Run:");
    console.log("npx tsx top100/index.ts update");
    return;
  }

  const tokens: TopToken[] = JSON.parse(
    fs.readFileSync(filePath, "utf8")
  );

  displayTop100(tokens);
}

async function main() {
  const command = process.argv[2];

  switch (command) {
    case "update":
      await update();
      break;

    case "list":
      list();
      break;

    default:
      console.log(`
Binance Top 100

Commands:

  npx tsx top100/index.ts update
      Update Top 100 by market cap

  npx tsx top100/index.ts list
      Display saved Top 100
`);
  }
}

main();