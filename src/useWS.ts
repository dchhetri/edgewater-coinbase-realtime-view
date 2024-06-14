import { useEffect, useRef, useCallback } from "react";

const API_URL = "ws://localhost:4000";

interface UseWSProps {
  onTickerUpdate?: (data: any) => void;
  onLevel2Update?: (data: any) => void;
}

const useWS = ({ onTickerUpdate, onLevel2Update }: UseWSProps) => {
  const wsRef = useRef<WebSocket | null>(null);

  const subscribe = useCallback((product: string) => {
    if (!wsRef.current) {
      return;
    }

    const message: { type: string; product: string } = {
      type: "subscribe",
      product: product,
    };
    wsRef.current!.send(JSON.stringify(message));
  }, []);

  const unsubscribe = useCallback((product: string) => {
    if (!wsRef.current) {
      return;
    }
    wsRef.current!.send(JSON.stringify({ type: "unsubscribe", product }));
  }, []);

  useEffect(() => {
    const ws = new WebSocket(API_URL);
    wsRef.current = ws;
    ws.onopen = () => console.log("WebSocket connection opened");
    ws.onclose = (event: CloseEvent) => {
      console.log("WebSocket connection closed:", event.code, event.reason);
    };
    ws.onerror = (error: any) => console.error("WebSocket error:", error);
    ws.onmessage = (message: MessageEvent) => {
      try {
        const parsedMessage = JSON.parse(message.data);
        switch (parsedMessage.type) {
          case "tickerUpdate": {
            return onTickerUpdate?.(parsedMessage.data);
          }
          case "level2Update": {
            return onLevel2Update?.(parsedMessage.data);
          }
        }
      } catch (e) {
        console.log("Failed to parse message ", e);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { subscribe, unsubscribe };
};

export default useWS;
