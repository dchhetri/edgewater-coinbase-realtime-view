const WebSocket = require("ws");
const SubscriptionManager = require("./subscriptionManager");
const CacheManager = require("./cacheManager");

const SupportedProductIds = {
  "BTC-USD": "BTC-USD",
  "ETH-USD": "ETH-USD",
  "LTC-USD": "LTC-USD",
};

const CoinbaseAPI = {
  subscribe: (ws, products) => {
    const message = JSON.stringify({
      type: "subscribe",
      channels: ["ticker", "level2_batch"],
      product_ids: products,
    });
    ws.send(message);
  },

  unsubscribe: (ws, productId) => {
    const message = JSON.stringify({
      type: "unsubscribe",
      product_ids: [productId],
      channels: ["ticker", "level2_batch"],
    });
    ws.send(message);
  },
};

class CoinbaseWS {
  static wss_url = "wss://ws-feed.exchange.coinbase.com";

  static LEVEL_2_REFRESH_MS = 8000;

  ws;

  cacheManager;

  subscriptionManager;

  constructor() {
    this.tickerChannelCacheManager = new CacheManager();
    this.level2ChannelCacheManager = new CacheManager();
    this.subscriptionManager = new SubscriptionManager();
  }

  subscribe = async (product, ws) => {
    this.validateSubscribe(product);

    await this.connectOnce();

    this.subscriptionManager.addClient(product, ws);

    CoinbaseAPI.subscribe(this.coinbaseWS, [SupportedProductIds[product]]);

    const priceCache = this.tickerChannelCacheManager.get(product);
    if (priceCache) {
      this.broadcast(product, {
        type: "tickerUpdate",
        data: priceCache,
      });
    }
    const level2Cache = this.level2ChannelCacheManager.get(product);
    if (level2Cache) {
      const { bids, asks } = level2Cache;
      this.broadcast(product, {
        type: "level2Update",
        data: {
          product_id: product,
          // just send the latest 10 for example purpose
          bids: Array.from(bids).reverse().slice(0, 10),
          asks: Array.from(asks).reverse().slice(0, 10),
        },
      });
    }

    // On close, clear out any subscription for this ws
    ws.on("close", () => {
      Object.values(SupportedProductIds).forEach((productId) => {
        this.unsubscribe(productId, ws);
      });
    });
  };

  unsubscribe = (product, ws) => {
    this.subscriptionManager.removeClient(product, ws);
    // If no clients left for product, remove the subscription
    if (!this.subscriptionManager.hasActiveSubscriptionsForProduct(product)) {
      CoinbaseAPI.unsubscribe(this.coinbaseWS, product);
    }
  };

  validateSubscribe = (productId) => {
    if (!SupportedProductIds[productId]) {
      throw new Error(`Subscription to "${productId}" is not allowed.`);
    }
  };

  // private
  refreshAllProductCaches = () => {};

  connectOnce = async () => {
    if (!this.coinbaseWS) {
      this.coinbaseWS = new WebSocket(CoinbaseWS.wss_url);
      return new Promise((resolve, reject) => {
        this.coinbaseWS.onopen = resolve;
        this.coinbaseWS.onerror = reject;
        this.coinbaseWS.onmessage = this.handleWSMessageReceived.bind(this);
      });
    }
  };

  handleWSMessageReceived = async (data) => {
    try {
      const message = JSON.parse(data.data);
      switch (message.type) {
        case "ticker": {
          this.handleTickerChannelMessageReceived(message);
          break;
        }
        case "snapshot": {
          this.handleLevel2SnapshotMessageReceived(message);
          break;
        }

        case "l2update": {
          this.handleLevel2UpdateMessageReceived(message);
          break;
        }

        default: {
          console.warn(`Unknown message received `, message);
          break;
        }
      }
    } catch (e) {
      console.error("Error: ", e);
    }
  };

  handleTickerChannelMessageReceived = async (tickerUpdate) => {
    const { product_id } = tickerUpdate;
    this.tickerChannelCacheManager.set(product_id, tickerUpdate);
    this.broadcast(product_id, {
      type: "tickerUpdate",
      data: tickerUpdate,
    });
  };

  // Initially snapshot is sent for level2 data that contains most  bids/asks
  handleLevel2SnapshotMessageReceived = async (level2Snapshot) => {
    const {
      product_id,
      asks: rawAsks,
      bids: rawBids,
      time: updatedAt,
    } = level2Snapshot;

    // pull only the latest 10 bids for example purpose
    const asks = new Map(
      rawAsks
        .slice(0, 10)
        .map(([price, size]) => [parseFloat(price), parseFloat(size)])
    );

    // pull only the latest 10 bids for example purpose
    const bids = new Map(
      rawBids
        .slice(0, 10)
        .map(([price, size]) => [parseFloat(price), parseFloat(size)])
    );

    this.level2ChannelCacheManager.set(product_id, {
      asks,
      bids,
      updatedAt,
    });

    this.broadcast(product_id, {
      type: "level2Update",
      data: {
        product_id,
        bids: Array.from(bids),
        asks: Array.from(asks),
      },
    });
  };

  handleLevel2UpdateMessageReceived = async (level2Update) => {
    const { product_id, changes, time: currentUpdatedAt } = level2Update;
    const cacheItem = this.level2ChannelCacheManager.get(product_id);
    if (cacheItem) {
      const { asks, bids, updatedAt: lastUpdatedAt } = cacheItem;
      const lastUpdatedDate = new Date(lastUpdatedAt);
      const currentUpdatedDate = new Date(currentUpdatedAt);
      const timeDelta =
        currentUpdatedDate.getTime() - lastUpdatedDate.getTime();

      if (timeDelta < CoinbaseWS.LEVEL_2_REFRESH_MS) {
        return;
      }

      for (const entry of changes) {
        const [side, price, size] = entry;
        if (side === "buy") {
          // coinbase says size is not delta but the new size
          bids.set(parseFloat(price), parseFloat(size));
        } else if (side === "sell") {
          asks.set(parseFloat(price), parseFloat(size));
        }
      }

      cacheItem.updatedAt = currentUpdatedAt;
      this.broadcast(product_id, {
        type: "level2Update",
        data: {
          product_id,
          // just send the latest 10 for example purpose
          bids: Array.from(bids).reverse().slice(0, 10),
          asks: Array.from(asks).reverse().slice(0, 10),
        },
      });
    } else {
      console.warn(`Warning: No level2 cache exists for ${product_id}`);
    }
  };

  broadcast = (productId, data) => {
    const clients = this.subscriptionManager.getClientList(productId);
    for (const clientWS of clients) {
      clientWS.send(JSON.stringify(data));
    }
  };
}

module.exports = CoinbaseWS;
