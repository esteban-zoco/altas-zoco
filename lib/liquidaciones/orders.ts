import { OrderInfo } from "./types";
import { promises as fs } from "fs";
import path from "path";

const ordersFilePath = path.join(process.cwd(), "data", "liquidaciones", "orders.json");
const orderCache = new Map<string, OrderInfo>();
const debugEnabled = process.env.DEBUG_LIQUIDACIONES !== "false";
const debug = (...args: unknown[]) => {
  if (debugEnabled) console.log(...args);
};

const readLocalOrders = async (): Promise<Record<string, OrderInfo>> => {
  try {
    const content = await fs.readFile(ordersFilePath, "utf-8");
    let parsed: OrderInfo[] | Record<string, OrderInfo>;
    try {
      parsed = JSON.parse(content) as OrderInfo[] | Record<string, OrderInfo>;
    } catch (parseError) {
      console.warn("[liquidaciones][orders] orders.json invalido, se ignora");
      return {};
    }
    if (Array.isArray(parsed)) {
      return parsed.reduce<Record<string, OrderInfo>>((acc, item) => {
        acc[item.orderId] = item;
        return acc;
      }, {});
    }
    return parsed;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return {};
    }
    throw error;
  }
};

const mapOrderInfo = (orderId: string, payload: any): OrderInfo | null => {
  if (!payload) return null;
  const info = payload.info ?? payload.data ?? payload.result ?? payload;
  if (!info) return null;
  const organizerId = info.organizerId ?? info.organizer?.id ?? info.organizer_id;
  const organizerName = info.organizerName ?? info.organizer?.name ?? info.organizer_name;
  const eventId = info.eventId ?? info.event?.id ?? info.event_id;
  const resolvedOrderId = info.orderId ?? info._id ?? orderId;

  if (!organizerId || !organizerName) return null;

  return {
    orderId: String(resolvedOrderId),
    organizerId: String(organizerId),
    organizerName: String(organizerName),
    eventId: eventId ? String(eventId) : undefined,
  };
};

const buildAuthHeaders = (apiToken?: string): Record<string, string> => {
  if (!apiToken) return {};
  return { Authorization: `Bearer ${apiToken}` };
};

export const getOrder = async (orderId: string): Promise<OrderInfo | null> => {
  if (orderCache.has(orderId)) {
    return orderCache.get(orderId) ?? null;
  }

  const baseUrl = process.env.ORDERS_API_BASE_URL;
  const apiToken = process.env.ORDERS_API_TOKEN;
  if (baseUrl) {
    try {
      const normalizedBase = baseUrl.replace(/\/$/, "");
      const isTemplate = normalizedBase.includes("{id}");
      const isResolveEndpoint = /\/resolve$|\/getorderbyid$/i.test(normalizedBase);
      const authHeaders = buildAuthHeaders(apiToken);

      const tryPost = async (url: string) => {
        debug("[liquidaciones][orders] POST", url, "orderId:", orderId);
        const response = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...authHeaders },
          body: JSON.stringify({ id: orderId }),
        });
        if (!response.ok) {
          const text = await response.text().catch(() => "");
          debug("[liquidaciones][orders] POST status", response.status, text.slice(0, 300));
          return null;
        }
        const payload = await response.json();
        const mapped = mapOrderInfo(orderId, payload);
        if (!mapped) {
          debug("[liquidaciones][orders] POST payload sin organizerId/organizerName", payload);
        }
        return mapped;
      };

      const tryGet = async (url: string) => {
        debug("[liquidaciones][orders] GET", url, "orderId:", orderId);
        const response = await fetch(url, { headers: authHeaders });
        if (!response.ok) {
          const text = await response.text().catch(() => "");
          debug("[liquidaciones][orders] GET status", response.status, text.slice(0, 300));
          return null;
        }
        const payload = await response.json();
        const mapped = mapOrderInfo(orderId, payload);
        if (!mapped) {
          debug("[liquidaciones][orders] GET payload sin organizerId/organizerName", payload);
        }
        return mapped;
      };

      let mapped: OrderInfo | null = null;

      if (isResolveEndpoint) {
        mapped = await tryPost(normalizedBase);
      } else if (isTemplate) {
        mapped = await tryGet(normalizedBase.replace("{id}", orderId));
      } else {
        mapped =
          (await tryPost(`${normalizedBase}/api/app/order/resolve`)) ??
          (await tryPost(`${normalizedBase}/app/order/resolve`)) ??
          null;

        if (!mapped) {
          const ordersBase = normalizedBase.endsWith("/orders")
            ? normalizedBase
            : `${normalizedBase}/orders`;
          mapped = await tryGet(`${ordersBase}/${orderId}`);
        }
      }

      if (mapped) {
        orderCache.set(orderId, mapped);
        return mapped;
      }
      debug("[liquidaciones][orders] sin match en API para orderId", orderId);
    } catch (error) {
      console.warn("Error consultando orden externa", error);
    }
  }

  const localOrders = await readLocalOrders();
  if (localOrders[orderId]) {
    orderCache.set(orderId, localOrders[orderId]);
    return localOrders[orderId];
  }

  return null;
};
