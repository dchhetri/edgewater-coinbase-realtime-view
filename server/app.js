const express = require("express");
const expressWs = require("express-ws");
const CoinbaseWS = require("./coinbaseWS");

const { app } = expressWs(express());

const coinbaseWS = new CoinbaseWS();

// Ignore cors issue for now
app.use(function (req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "*");
  next();
});

app.ws("/", (ws) => {
  ws.onmessage = (message) => {
    const data = JSON.parse(message.data);

    switch (data.type) {
      case "subscribe": {
        const product = data.product;
        coinbaseWS.subscribe(product, ws);
        break;
      }

      case "unsubscribe": {
        const product = data.product;
        coinbaseWS.unsubscribe(product, ws);
        break;
      }

      default:
        console.warn("Received unknown message type:", data.type);
    }
  };
});

const port = process.env.PORT || 4000;
app.listen(port, () => console.log(`Server listening on port ${port}`));

module.exports = app;
