require("dotenv").config({ quiet: true });

const axios = require("axios");
const crypto = require("crypto");

const apiKey = process.env.BINANCE_API_KEY;
const apiSecret = process.env.BINANCE_API_SECRET;

if (!apiKey) {
    console.error("BINANCE_API_KEY is missing");
    process.exit(1);
}

if (!apiSecret) {
    console.error("BINANCE_API_SECRET is missing");
    process.exit(1);
}

const timestamp = Date.now();
const recvWindow = 10000;

const queryString =
    `timestamp=${timestamp}&recvWindow=${recvWindow}`;

const signature =
    crypto
        .createHmac("sha256", apiSecret)
        .update(queryString)
        .digest("hex");

async function main() {

    console.log("Testing Binance USD-M Futures authentication...");
    console.log("API Key:", apiKey.slice(0, 8) + "...");
    console.log("Timestamp:", timestamp);

    try {

        const response =
            await axios.get(
                "https://fapi.binance.com/fapi/v3/account",
                {
                    params: {
                        timestamp,
                        recvWindow,
                        signature,
                    },

                    headers: {
                        "X-MBX-APIKEY": apiKey,
                    },

                    timeout: 10000,
                }
            );

        console.log("\nSUCCESS");
        console.log("HTTP:", response.status);

        const account = response.data;

        const usdt =
            account.assets?.find(
                asset => asset.asset === "USDT"
            );

        if (usdt) {

            console.log(
                "USDT Wallet Balance:",
                usdt.walletBalance
            );

            console.log(
                "USDT Available Balance:",
                usdt.availableBalance
            );

        }

    } catch (error) {

        console.log("\nFAILED");

        console.log(
            "HTTP:",
            error.response?.status
        );

        console.log(
            "Binance Code:",
            error.response?.data?.code
        );

        console.log(
            "Binance Message:",
            error.response?.data?.msg
        );

    }
}

main();