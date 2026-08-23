import "dotenv/config";

import axios, {
  AxiosInstance,
} from "axios";

import crypto from "crypto";

export class BinanceClient {
  private readonly client: AxiosInstance;

  constructor() {
    const apiKey = process.env.BINANCE_API_KEY;
    const apiSecret = process.env.BINANCE_API_SECRET;
    const baseUrl =
      process.env.BINANCE_BASE_URL ||
      "https://fapi.binance.com";

    if (!apiKey) {
      throw new Error("BINANCE_API_KEY is missing");
    }

    if (!apiSecret) {
      throw new Error("BINANCE_API_SECRET is missing");
    }

    this.client = axios.create({
      baseURL: baseUrl,
      timeout: 15000,
      headers: {
        "X-MBX-APIKEY": apiKey,
      },
    });
  }

  async get(
    endpoint: string,
    params: Record<string, unknown> = {}
  ) {
    return (
      await this.client.get(endpoint, {
        params,
      })
    ).data;
  }

  async signedGet(
    endpoint: string,
    params: Record<string, unknown> = {}
  ) {
    return this.request(
      "GET",
      endpoint,
      params
    );
  }

  async signedPost(
    endpoint: string,
    params: Record<string, unknown> = {}
  ) {
    return this.request(
      "POST",
      endpoint,
      params
    );
  }

  async signedDelete(
    endpoint: string,
    params: Record<string, unknown> = {}
  ) {
    return this.request(
      "DELETE",
      endpoint,
      params
    );
  }

  private async request(
    method: "GET" | "POST" | "DELETE",
    endpoint: string,
    params: Record<string, unknown>
  ) {
    const apiSecret = process.env.BINANCE_API_SECRET;

    if (!apiSecret) {
      throw new Error("BINANCE_API_SECRET is missing");
    }

    const requestParams = {
      ...params,
      timestamp: Date.now(),
      recvWindow: 10000,
    };

    const query = new URLSearchParams();

    for (const [key, value] of Object.entries(
      requestParams
    )) {
      query.append(key, String(value));
    }

    const signature = crypto
      .createHmac("sha256", apiSecret)
      .update(query.toString())
      .digest("hex");

    try {
      const response =
        await this.client.request({
          method,
          url: endpoint,
          params: {
            ...requestParams,
            signature,
          },
        });

      return response.data;
    } catch (err: any) {
      const data =
        err?.response?.data;

      console.error(
        `[BINANCE ERROR] ${method} ${endpoint}`,
        {
          status: err?.response?.status,
          code: data?.code,
          message: data?.msg,
        }
      );

      throw err;
    }
  }
}