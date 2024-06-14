class SubscriptionManager {
  constructor() {
    this.subscribedClients = new Map();
  }

  addClient(product, ws) {
    if (!this.subscribedClients.has(product)) {
      this.subscribedClients.set(product, new Set());
    }
    this.subscribedClients.get(product).add(ws);
  }

  removeClient(product, ws) {
    if (this.subscribedClients.has(product)) {
      const clients = this.subscribedClients.get(product);
      clients.delete(ws);
      if (clients.size === 0) {
        this.subscribedClients.delete(product);
      }
    }
  }

  getClientList(product) {
    return this.subscribedClients.get(product) || new Set();
  }

  hasActiveSubscriptions() {
    for (const clients of this.subscribedClients.values()) {
      if (clients.size > 0) {
        return true;
      }
    }
    return false;
  }

  hasActiveSubscriptionsForProduct(product) {
    const clients = this.subscribedClients.get(product);
    return clients && clients.size > 0;
  }
}

module.exports = SubscriptionManager;
