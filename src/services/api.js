const BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000";


function getAccessToken() {
  return localStorage.getItem("accessToken");
}

function saveTokens({ accessToken, refreshToken }) {
  localStorage.setItem("accessToken", accessToken);
  localStorage.setItem("refreshToken", refreshToken);
}

function clearTokens() {
  localStorage.removeItem("accessToken");
  localStorage.removeItem("refreshToken");
  localStorage.removeItem("user");
}


let refreshPromise = null;

async function doRefresh() {
  const refreshToken = localStorage.getItem("refreshToken");
  if (!refreshToken) throw new Error("Sem refreshToken");

  const res = await fetch(`${BASE_URL}/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken }),
  });

  if (!res.ok) {
    clearTokens();
    throw new Error("Sessão expirada. Faça login novamente.");
  }

  const tokens = await res.json();
  saveTokens(tokens);
  return tokens.accessToken;
}


async function request(path, options = {}, retry = true) {
  const headers = { "Content-Type": "application/json", ...options.headers };

  const token = getAccessToken();
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${BASE_URL}${path}`, { ...options, headers });


  if (res.status === 401 && retry) {
    try {
      if (!refreshPromise) refreshPromise = doRefresh().finally(() => (refreshPromise = null));
      await refreshPromise;
      return request(path, options, false);
    } catch {
      clearTokens();
      throw new Error("Sessão expirada. Faça login novamente.");
    }
  }

  if (res.status === 204) return null;

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data?.error ?? `Erro ${res.status}`);
  }

  return data;
}


function normalizeProduct(p) {
  if (!p) return p;
  return {
    ...p,

    id: p._id?.toString() ?? p.id,
    _id: p._id?.toString() ?? p.id,

    image: p.imageUrl ?? p.image ?? "",
    imageUrl: p.imageUrl ?? p.image ?? "",

    category:
      typeof p.category === "object" && p.category !== null
        ? p.category.name ?? ""
        : p.category ?? "",
    categoryObj: typeof p.category === "object" ? p.category : null,

    price: Number(p.price ?? 0),

    rating: {
      rate: p.rating?.avg ?? p.rating?.rate ?? 0,
      count: p.rating?.total ?? p.rating?.count ?? 0,
      avg: p.rating?.avg ?? p.rating?.rate ?? 0,
      total: p.rating?.total ?? p.rating?.count ?? 0,
    },
  };
}


export const api = {

  getProducts: async (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    const data = await request(`/products${qs ? `?${qs}` : ""}`);
    return (data ?? []).map(normalizeProduct);
  },

  getProduct: async (id) => {
    const data = await request(`/products/${id}`);
    return normalizeProduct(data);
  },

  getByCategory: async (categoryId, params = {}) => {
    const qs = new URLSearchParams(params).toString();
    const data = await request(
      `/products/category/${categoryId}${qs ? `?${qs}` : ""}`
    );
    return (data ?? []).map(normalizeProduct);
  },


  getCategories: async () => {
    const data = await request("/products/categories");
    return (data ?? []).map((c) => (typeof c === "object" ? c.name : c));
  },

  getCategoriesFull: async () => {
    const data = await request("/products/categories");
    return data ?? [];
  },


  register: async ({ name, email, password }) => {
    const data = await request("/auth/register", {
      method: "POST",
      body: JSON.stringify({ name, email, password }),
    });
    saveTokens(data);
    localStorage.setItem("user", JSON.stringify(data.user));
    return data;
  },

  login: async ({ email, password }) => {
    const data = await request("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    saveTokens(data);
    localStorage.setItem("user", JSON.stringify(data.user));
    return data;
  },

  logout: async () => {
    const refreshToken = localStorage.getItem("refreshToken");
    try {
      await request("/auth/logout", {
        method: "POST",
        body: JSON.stringify({ refreshToken }),
      });
    } finally {
      clearTokens();
    }
  },

  getCurrentUser: () => {
    try {
      return JSON.parse(localStorage.getItem("user")) ?? null;
    } catch {
      return null;
    }
  },

  isAuthenticated: () => !!getAccessToken(),


  getCart: async () => {
    const data = await request("/cart");
    return (data ?? []).map((item) => ({
      ...item,
      product: item.product ? normalizeProduct(item.product) : null,
    }));
  },

  /**
   * Adiciona item ao carrinho
   * @param {string} productId
   * @param {number} quantity
   * @param {string|null} size
   */
  addToCart: (productId, quantity = 1, size = null) =>
    request("/cart", {
      method: "POST",
      body: JSON.stringify({ productId, quantity, ...(size ? { size } : {}) }),
    }),

  /**
   * Atualiza quantidade de um item
   * @param {string} productId
   * @param {number} quantity
   * @param {string|null} size
   */
  updateCartItem: (productId, quantity, size = null) =>
    request(`/cart/${productId}${size ? `?size=${size}` : ""}`, {
      method: "PATCH",
      body: JSON.stringify({ quantity }),
    }),

  /**
   * Remove item do carrinho
   * @param {string} productId
   * @param {string|null} size
   */
  removeFromCart: (productId, size = null) =>
    request(`/cart/${productId}${size ? `?size=${size}` : ""}`, {
      method: "DELETE",
    }),

  clearCart: () => request("/cart", { method: "DELETE" }),


  getReviews: (productId) => request(`/reviews/${productId}`),

  /**
   * Cria ou atualiza avaliação (requer login)
   * @param {string} productId
   * @param {number} rating  1-5
   * @param {string} comment
   */
  submitReview: (productId, rating, comment = "") =>
    request(`/reviews/${productId}`, {
      method: "POST",
      body: JSON.stringify({ rating, comment }),
    }),

  deleteReview: (productId) =>
    request(`/reviews/${productId}`, { method: "DELETE" }),
};