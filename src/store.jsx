import { createContext, useContext, useEffect, useMemo, useReducer } from "react";

const StoreContext = createContext(null);
const CART_KEY = "fakestore_cart_v1";

function loadCart() {
  try {
    return JSON.parse(localStorage.getItem(CART_KEY)) ?? [];
  } catch {
    return [];
  }
}

const initialState = {
  cart: loadCart(),
};

function reducer(state, action) {
  switch (action.type) {
    case "ADD": {
      const p = action.payload;
      const key = (item) => `${item.id}::${item.size ?? ""}`;
      const found = state.cart.find((x) => key(x) === key(p));
      const cart = found
        ? state.cart.map((x) =>
            key(x) === key(p) ? { ...x, qty: x.qty + (p.qty ?? 1) } : x
          )
        : [...state.cart, { ...p, qty: p.qty ?? 1 }];
      return { ...state, cart };
    }

    case "REMOVE": {
      const { id, size } = action.payload;
      return {
        ...state,
        cart: state.cart.filter(
          (x) => !(x.id === id && (x.size ?? null) === (size ?? null))
        ),
      };
    }

    case "QTY": {
      const { id, qty, size } = action.payload;
      const q = Math.max(1, Number(qty) || 1);
      return {
        ...state,
        cart: state.cart.map((x) =>
          x.id === id && (x.size ?? null) === (size ?? null)
            ? { ...x, qty: q }
            : x
        ),
      };
    }

    case "SET_SIZE": {
      const { id, size } = action.payload;
      return {
        ...state,
        cart: state.cart.map((x) => (x.id === id ? { ...x, size } : x)),
      };
    }

    case "CLEAR":
      return { ...state, cart: [] };

    case "SET_CART":
      return { ...state, cart: action.payload };

    default:
      return state;
  }
}

export function StoreProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  useEffect(() => {
    localStorage.setItem(CART_KEY, JSON.stringify(state.cart));
  }, [state.cart]);

  const actions = useMemo(() => {

    const addToCart = (p, qty = 1) =>
      dispatch({
        type: "ADD",
        payload: {
          id: p._id ?? p.id,
          title: p.title,
          price: Number(p.price ?? 0),
          image: p.imageUrl ?? p.image ?? "",
          size: p.size ?? null,
          qty,
        },
      });

    const removeFromCart = (id, size = null) =>
      dispatch({ type: "REMOVE", payload: { id, size } });

    const setQty = (id, qty, size = null) =>
      dispatch({ type: "QTY", payload: { id, qty, size } });

    const setSize = (id, size) =>
      dispatch({ type: "SET_SIZE", payload: { id, size } });

    const clearCart = () => dispatch({ type: "CLEAR" });

    const syncCart = (serverItems) => {
      const normalized = serverItems.map((item) => ({
        id: item.productId ?? item.product?._id?.toString(),
        title: item.product?.title ?? "",
        price: Number(item.product?.price ?? 0),
        image: item.product?.imageUrl ?? item.product?.image ?? "",
        size: item.size ?? null,
        qty: item.quantity ?? 1,
      }));
      dispatch({ type: "SET_CART", payload: normalized });
    };

    return { addToCart, removeFromCart, setQty, setSize, clearCart, syncCart };
  }, []);

  const cartCount = state.cart.reduce((acc, x) => acc + (x.qty ?? 0), 0);
  const cartTotal = state.cart.reduce(
    (acc, x) => acc + (x.price ?? 0) * (x.qty ?? 0),
    0
  );

  const value = useMemo(
    () => ({ state, ...actions, cartCount, cartTotal }),
    [state, actions, cartCount, cartTotal]
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore precisa estar dentro de <StoreProvider>");
  return ctx;
}