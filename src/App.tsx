import "./App.css";
import { useState } from "react";
import useWS from "./useWS";

enum ProductIDs {
  BTC_USD = "BTC-USD",
  ETH_USD = "ETH-USD",
  LTC_USD = "LTC-USD",
}

interface SubscribedProductsInfo {
  productId: ProductIDs;
  ticker: any;
  level2: { bids: any[]; asks: any[] };
}

const formatPriceSize = (entry: any) =>
  `(${entry[0]?.toFixed(4)}, ${entry[1]?.toFixed(4)}) `;

function App() {
  const [subscribedProducts, setSubscribedProducts] = useState<
    Map<
      ProductIDs,
      | SubscribedProductsInfo
      | { productId: ProductIDs; ticker: null; level2: null }
    >
  >(new Map());

  const { subscribe, unsubscribe } = useWS({
    onTickerUpdate: (ticker) => {
      // update ticker info for the product
      setSubscribedProducts((prevStateMap) => {
        const { product_id } = ticker;
        const oldData = prevStateMap.get(product_id);
        // unsubscribed in the midst of update.
        if (!oldData) {
          return prevStateMap;
        }

        const newSubscription = new Map(prevStateMap);
        newSubscription.set(product_id, {
          ...oldData,
          ticker: ticker,
        });
        return newSubscription;
      });
    },
    onLevel2Update: (level2) => {
      // update level2 info for the product
      setSubscribedProducts((prevStateMap) => {
        const { product_id, bids, asks } = level2;
        const oldData = prevStateMap.get(product_id);
        // unsubscribed in the midst of update.
        if (!oldData) {
          return prevStateMap;
        }

        const newSubscription = new Map(prevStateMap);
        newSubscription.set(product_id, {
          ...oldData,
          level2: {
            bids,
            asks,
          },
        });
        return newSubscription;
      });
    },
  });

  const handleSubscribe = (product: ProductIDs) => {
    // already subscribed
    if (subscribedProducts.has(product)) {
      return;
    }
    // new susbcribtion
    setSubscribedProducts((prevStateMap) => {
      const newSubscription = new Map(prevStateMap);
      newSubscription.set(product, {
        productId: product,
        ticker: null,
        level2: null,
      });
      return newSubscription;
    });

    subscribe(product);
  };

  const handleUnsubscribe = (product: ProductIDs) => {
    unsubscribe(product);
    const productsSub = new Map(subscribedProducts);
    productsSub.delete(product);
    setSubscribedProducts(productsSub);
  };

  const renderSubscriptionData = () => {
    const results: React.ReactNode[] = [];
    subscribedProducts.forEach((productInfo) => {
      results.push(
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            rowGap: 12,
            border: "1px solid grey",
            padding: 8,
            width: "80%",
          }}
        >
          <label>{productInfo.productId}</label>
          <div>Price: {productInfo.ticker?.price}</div>
          <div>
            Latest 10 Asks: {productInfo.level2?.asks.map(formatPriceSize)}
          </div>
          <div>
            Latest 10 Bids: {productInfo.level2?.bids.map(formatPriceSize)}
          </div>
        </div>
      );
    });
    return results;
  };

  return (
    <div
      className="App"
      style={{
        display: "flex",
        flexDirection: "column",
        rowGap: 12,
        padding: 12,
      }}
    >
      <div>
        {Object.values(ProductIDs).map((productId) => (
          <button
            key={`subscribe-${productId}`}
            onClick={() => handleSubscribe(productId)}
            style={{ width: 200 }}
          >
            Subscribe to {productId}
          </button>
        ))}
      </div>
      <div>
        {Object.values(ProductIDs).map((productId) => (
          <button
            key={`ubsubscribe-${productId}`}
            onClick={() => handleUnsubscribe(productId)}
            style={{ width: 200 }}
          >
            UnSubscribe to {productId}
          </button>
        ))}
      </div>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          rowGap: 12,
        }}
      >
        {renderSubscriptionData()}
      </div>
    </div>
  );
}

export default App;
