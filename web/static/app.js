"use strict";

const CSRF = document.querySelector('meta[name="csrf"]').content;

async function api(path, options = {}) {
  const opts = { ...options };
  opts.headers = Object.assign(
    { "Content-Type": "application/json" },
    opts.headers || {}
  );
  if (opts.method && opts.method !== "GET") {
    opts.headers["X-CSRF-Token"] = CSRF;
  }
  const res = await fetch(path, opts);
  if (res.status === 401) {
    window.location.href = "/admin/login";
    throw new Error("Session expirée");
  }
  if (res.status === 403) {
    throw new Error("Jeton CSRF invalide");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || ("Erreur " + res.status));
  return data;
}

function toast(msg, type = "") {
  const el = document.createElement("div");
  el.className = "toast " + type;
  el.textContent = msg;
  document.getElementById("toast-root").appendChild(el);
  setTimeout(() => el.remove(), 3500);
}

function money(n) {
  return Number(n || 0).toLocaleString("fr-FR") + " coins";
}

function openModal(html) {
  closeModal();
  const root = document.getElementById("modal-root");
  const bd = document.createElement("div");
  bd.className = "modal-backdrop";
  bd.innerHTML = '<div class="modal">' + html + "</div>";
  bd.addEventListener("click", (e) => {
    if (e.target === bd) closeModal();
  });
  root.appendChild(bd);
}

function closeModal() {
  document.getElementById("modal-root").innerHTML = "";
}

function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

function stockLabel(s) {
  return s === -1 ? "∞" : s;
}

const TX_LABELS = {
  purchase: "Achat", sale: "Vente", deposit: "Dépôt", withdraw: "Retrait",
  transfer_in: "Reçu", transfer_out: "Envoyé", add_money: "+ Admin",
  remove_money: "- Admin", set_balance: "Réglage", salary: "Salaire",
};

// ---------------------------------------------------------------------------
const Views = {};

Views.dashboard = async (el) => {
  const [stats, bot] = await Promise.all([api("/api/stats"), api("/api/bot")]);

  const guildHtml = (bot.guild_count
    ? bot.guilds.map((g) => `${escapeHtml(g.name)}<br><span class="badge gray">${g.member_count} membres</span>`).join("<br>")
    : "Aucun serveur");

  el.innerHTML = `
    <div class="grid">
      <div class="card"><div class="label">Utilisateurs enregistrés</div><div class="value">${stats.user_count}</div></div>
      <div class="card"><div class="label">Argent total en circulation</div><div class="value">${money(stats.total_balance)}</div></div>
      <div class="card"><div class="label">En banque</div><div class="value">${money(stats.total_bank)}</div></div>
      <div class="card"><div class="label">Transactions</div><div class="value">${stats.tx_count}</div></div>
      <div class="card"><div class="label">Shops</div><div class="value">${stats.shop_count}</div></div>
      <div class="card"><div class="label">Items actifs</div><div class="value">${stats.item_count}</div></div>
    </div>

    <div class="grid">
    <div class="panel" style="grid-column: span 1">
      <div class="panel-head"><h3>🤖 Statut du bot</h3></div>
      <div class="panel-body stack">
        ${bot.ready ? '<span class="badge green">En ligne</span>' : '<span class="badge red">Hors ligne</span>'}
        <div><b>${escapeHtml(bot.name || "?")}</b> (${bot.id || "?"})</div>
        <div>Latence : ${bot.latency_ms ?? "—"} ms</div>
        <div>Serveurs : ${bot.guild_count}</div>
        <button class="btn btn-primary btn-sm" id="btn-sync">🔄 Synchroniser les commandes slash</button>
      </div>
    </div>
    <div class="panel">
      <div class="panel-head"><h3>🌍 Serveurs connectés</h3></div>
      <div class="panel-body stack">${guildHtml}</div>
    </div>
    </div>

    <div class="panel">
      <div class="panel-head"><h3>🏆 Top 5 des plus riches</h3></div>
      <div class="panel-body">
        <table>
          <thead><tr><th>Utilisateur</th><th>Poche</th></tr></thead>
          <tbody>
            ${stats.top_users.map((u, i) => `
              <tr><td>#${i + 1} <code>${u.user_id}</code></td><td>${money(u.balance)}</td></tr>`).join("")}
          </tbody>
        </table>
      </div>
    </div>`;

  document.getElementById("btn-sync").addEventListener("click", async (e) => {
    e.target.disabled = true;
    try {
      const r = await api("/api/bot/sync", { method: "POST", body: "{}" });
      toast(`✅ ${r.synced} commandes synchronisées`, "success");
    } catch (err) {
      toast(err.message, "error");
    } finally {
      e.target.disabled = false;
    }
  });
};

// ---------------------------------------------------------------------------
Views.users = async (el, query = "") => {
  const q = encodeURIComponent(query);
  const { users, total } = await api(`/api/users?q=${q}&limit=100`);

  el.innerHTML = `
    <div class="toolbar">
      <input class="input" type="text" id="user-search" placeholder="Rechercher par ID Discord..." value="${escapeHtml(query)}">
      <button class="btn btn-primary" id="user-search-btn">Rechercher</button>
      <span class="badge gray">${total} utilisateurs</span>
    </div>
    <div class="panel">
      <div class="panel-body">
        <table>
          <thead><tr><th>Utilisateur</th><th>Poche</th><th>Banque</th><th>Total</th><th></th></tr></thead>
          <tbody>
            ${users.map((u) => `
              <tr>
                <td>${escapeHtml(u.name)}</td>
                <td>${money(u.balance)}</td>
                <td>${money(u.bank)}</td>
                <td>${money(u.balance + u.bank)}</td>
                <td><button class="btn btn-sm" data-open-user="${u.user_id}">Gérer</button></td>
              </tr>`).join("") || '<tr><td colspan="5" class="empty">Aucun utilisateur</td></tr>'}
          </tbody>
        </table>
      </div>
    </div>`;

  const search = () => Views.users(el, document.getElementById("user-search").value);
  document.getElementById("user-search-btn").addEventListener("click", search);
  document.getElementById("user-search").addEventListener("keydown", (e) => { if (e.key === "Enter") search(); });

  el.querySelectorAll("[data-open-user]").forEach((b) =>
    b.addEventListener("click", () => openUserModal(Number(b.dataset.openUser)))
  );
};

async function openUserModal(uid) {
  const u = await api(`/api/users/${uid}`);
  const inv = u.inventory.map((i) => `
    <tr>
      <td>${escapeHtml(i.name)} <span class="badge gray">${escapeHtml(i.shop)}</span></td>
      <td>${i.quantity}</td>
      <td>
        <button class="btn btn-sm btn-danger" data-remove="${escapeHtml(i.name)}">−1</button>
      </td>
    </tr>`).join("") || '<tr><td colspan="3" class="empty">Inventaire vide</td></tr>';

  openModal(`
    <h3>👤 ${escapeHtml(u.name)}</h3>
    <div class="form-row"><label>ID Discord</label><code>${u.user_id}</code></div>
    <div class="form-row">
      <label>Solde : <b>${money(u.balance)}</b> · Banque : <b>${money(u.bank)}</b></label>
    </div>

    <div class="form-row"><label>Modifier l'argent</label>
      <div style="display:flex; gap:8px">
        <input class="input" type="number" id="mod-amount" placeholder="Montant">
        <select class="input" id="mod-action">
          <option value="add">Ajouter</option>
          <option value="remove">Retirer</option>
          <option value="set">Fixer</option>
        </select>
        <button class="btn btn-primary" id="mod-money">OK</button>
      </div>
    </div>

    <div class="form-row"><label>Ajouter un item</label>
      <div style="display:flex; gap:8px">
        <input class="input" type="text" id="add-item-name" placeholder="Nom de l'item">
        <input class="input" type="number" id="add-item-qty" value="1" style="width:80px">
        <button class="btn btn-success" id="add-item">+</button>
      </div>
    </div>

    <table>
      <thead><tr><th>Item</th><th>Qté</th><th></th></tr></thead>
      <tbody>${inv}</tbody>
    </table>

    <div class="actions">
      <button class="btn" onclick="closeModal()">Fermer</button>
    </div>`);

  document.getElementById("mod-money").addEventListener("click", async () => {
    const amount = parseInt(document.getElementById("mod-amount").value, 10);
    const action = document.getElementById("mod-action").value;
    if (isNaN(amount)) return toast("Montant invalide", "error");
    try {
      await api(`/api/users/${uid}/money`, {
        method: "POST",
        body: JSON.stringify({ action, amount }),
      });
      toast("✅ Solde modifié", "success");
      closeModal();
      Views.users(document.getElementById("view"));
    } catch (err) { toast(err.message, "error"); }
  });

  document.getElementById("add-item").addEventListener("click", async () => {
    const item_name = document.getElementById("add-item-name").value.trim();
    const quantity = parseInt(document.getElementById("add-item-qty").value, 10) || 1;
    if (!item_name) return toast("Nom d'item requis", "error");
    try {
      await api(`/api/users/${uid}/inventory`, {
        method: "POST",
        body: JSON.stringify({ item_name, quantity }),
      });
      toast("✅ Item ajouté", "success");
      closeModal();
      Views.users(document.getElementById("view"));
    } catch (err) { toast(err.message, "error"); }
  });

  document.getElementById("view").querySelectorAll("[data-remove]").forEach((b) =>
    b.addEventListener("click", async () => {
      const name = b.dataset.remove;
      const item = u.inventory.find((i) => i.name === name);
      if (!item) return;
      if (!confirm(`Retirer 1× \"${name}\" de l'inventaire ?`)) return;
      // récupère item_id/shop_id via l'API items
      try {
        const items = await api("/api/items");
        const it = items.find((i) => i.name === name);
        if (!it) return toast("Item introuvable", "error");
        await api(`/api/users/${uid}/inventory/remove`, {
          method: "POST",
          body: JSON.stringify({ item_id: it.item_id, shop_id: it.shop_id, quantity: 1 }),
        });
        toast("✅ Item retiré", "success");
        closeModal();
        Views.users(document.getElementById("view"));
      } catch (err) { toast(err.message, "error"); }
    })
  );
}

// ---------------------------------------------------------------------------
Views.shops = async (el) => {
  const shops = await api("/api/shops");

  el.innerHTML = `
    <div class="toolbar">
      <button class="btn btn-primary" id="shop-add">+ Nouveau shop</button>
    </div>
    <div class="panel">
      <div class="panel-body">
        <table>
          <thead><tr><th>ID</th><th>Nom</th><th>Description</th><th>Items</th><th></th></tr></thead>
          <tbody>
            ${shops.map((s) => `
              <tr>
                <td>${s.shop_id}</td>
                <td><b>${escapeHtml(s.name)}</b></td>
                <td>${escapeHtml(s.description || "")}</td>
                <td><button class="btn btn-sm" data-shop-items="${s.shop_id}">Voir</button></td>
                <td><button class="btn btn-sm btn-danger" data-shop-del="${s.shop_id}">Supprimer</button></td>
              </tr>`).join("") || '<tr><td colspan="5" class="empty">Aucun shop</td></tr>'}
          </tbody>
        </table>
      </div>
    </div>`;

  document.getElementById("shop-add").addEventListener("click", () => {
    openModal(`
      <h3>🏪 Nouveau shop</h3>
      <div class="form-row"><label>Nom</label><input class="input" id="shop-name"></div>
      <div class="form-row"><label>Description</label><input class="input" id="shop-desc"></div>
      <div class="actions">
        <button class="btn" onclick="closeModal()">Annuler</button>
        <button class="btn btn-primary" id="shop-create">Créer</button>
      </div>`);
    document.getElementById("shop-create").addEventListener("click", async () => {
      const name = document.getElementById("shop-name").value.trim();
      const description = document.getElementById("shop-desc").value.trim();
      if (!name) return toast("Nom requis", "error");
      try {
        await api("/api/shops", { method: "POST", body: JSON.stringify({ name, description }) });
        toast("✅ Shop créé", "success");
        closeModal();
        Views.shops(document.getElementById("view"));
      } catch (err) { toast(err.message, "error"); }
    });
  });

  el.querySelectorAll("[data-shop-del]").forEach((b) =>
    b.addEventListener("click", async () => {
      if (!confirm("Supprimer ce shop et tous ses items ?")) return;
      try {
        await api(`/api/shops/${b.dataset.shopDel}`, { method: "DELETE" });
        toast("🗑️ Shop supprimé", "success");
        Views.shops(document.getElementById("view"));
      } catch (err) { toast(err.message, "error"); }
    })
  );

  el.querySelectorAll("[data-shop-items]").forEach((b) =>
    b.addEventListener("click", async () => {
      const items = await api(`/api/shops/${b.dataset.shopItems}/items`);
      openModal(`
        <h3>🏪 Items du shop #${b.dataset.shopItems}</h3>
        <table>
          <thead><tr><th>ID</th><th>Nom</th><th>Prix</th><th>Stock</th><th>État</th></tr></thead>
          <tbody>
            ${items.map((i) => `
              <tr>
                <td>${i.item_id}</td>
                <td>${escapeHtml(i.name)}</td>
                <td>${money(i.price)}</td>
                <td>${stockLabel(i.stock)}</td>
                <td>${i.active === 1 ? '<span class="badge green">actif</span>' : '<span class="badge red">inactif</span>'}</td>
              </tr>`).join("")}
          </tbody>
        </table>
        <div class="actions"><button class="btn" onclick="closeModal()">Fermer</button></div>`);
    })
  );
};

// ---------------------------------------------------------------------------
Views.items = async (el) => {
  const [items, shops] = await Promise.all([api("/api/items"), api("/api/shops")]);

  el.innerHTML = `
    <div class="toolbar">
      <button class="btn btn-primary" id="item-add">+ Ajouter un item</button>
    </div>
    <div class="panel">
      <div class="panel-body">
        <table>
          <thead><tr><th>ID</th><th>Shop</th><th>Nom</th><th>Prix</th><th>Stock</th><th>État</th><th></th></tr></thead>
          <tbody>
            ${items.map((i) => `
              <tr>
                <td>${i.item_id}</td>
                <td>#${i.shop_id}</td>
                <td>${escapeHtml(i.name)}</td>
                <td>${money(i.price)}</td>
                <td>${stockLabel(i.stock)}</td>
                <td>${i.active === 1 ? '<span class="badge green">actif</span>' : '<span class="badge red">inactif</span>'}</td>
                <td>
                  ${i.active === 1
                    ? `<button class="btn btn-sm btn-danger" data-item-off="${i.item_id}">Désactiver</button>`
                    : `<button class="btn btn-sm btn-success" data-item-on="${i.item_id}">Réactiver</button>`}
                </td>
              </tr>`).join("") || '<tr><td colspan="7" class="empty">Aucun item</td></tr>'}
          </tbody>
        </table>
      </div>
    </div>`;

  document.getElementById("item-add").addEventListener("click", () => {
    openModal(`
      <h3>📦 Nouvel item</h3>
      <div class="form-row"><label>Nom</label><input class="input" id="it-name"></div>
      <div class="form-row"><label>Shop</label>
        <select class="input" id="it-shop">
          ${shops.map((s) => `<option value="${s.shop_id}">${escapeHtml(s.name)} (#${s.shop_id})</option>`).join("")}
        </select>
      </div>
      <div class="form-row"><label>Prix</label><input class="input" type="number" id="it-price" value="100"></div>
      <div class="form-row"><label>Stock (-1 = illimité)</label><input class="input" type="number" id="it-stock" value="-1"></div>
      <div class="form-row"><label>Description</label><input class="input" id="it-desc"></div>
      <div class="actions">
        <button class="btn" onclick="closeModal()">Annuler</button>
        <button class="btn btn-primary" id="item-create">Créer</button>
      </div>`);
    document.getElementById("item-create").addEventListener("click", async () => {
      const body = {
        shop_id: parseInt(document.getElementById("it-shop").value, 10),
        name: document.getElementById("it-name").value.trim(),
        price: parseInt(document.getElementById("it-price").value, 10),
        stock: parseInt(document.getElementById("it-stock").value, 10),
        description: document.getElementById("it-desc").value.trim(),
      };
      if (!body.name) return toast("Nom requis", "error");
      try {
        await api("/api/items", { method: "POST", body: JSON.stringify(body) });
        toast("✅ Item créé", "success");
        closeModal();
        Views.items(document.getElementById("view"));
      } catch (err) { toast(err.message, "error"); }
    });
  });

  el.querySelectorAll("[data-item-off]").forEach((b) =>
    b.addEventListener("click", async () => {
      if (!confirm("Désactiver cet item ?")) return;
      try {
        await api(`/api/items/${b.dataset.itemOff}`, { method: "DELETE" });
        toast("🗑️ Item désactivé", "success");
        Views.items(document.getElementById("view"));
      } catch (err) { toast(err.message, "error"); }
    })
  );

  el.querySelectorAll("[data-item-on]").forEach((b) =>
    b.addEventListener("click", async () => {
      const stock = prompt("Nouveau stock (-1 = illimité) :");
      if (stock === null) return;
      try {
        await api(`/api/items/${b.dataset.itemOn}/reactivate`, {
          method: "POST",
          body: JSON.stringify({ stock: stock === "" ? null : parseInt(stock, 10) }),
        });
        toast("✅ Item réactivé", "success");
        Views.items(document.getElementById("view"));
      } catch (err) { toast(err.message, "error"); }
    })
  );
};

// ---------------------------------------------------------------------------
Views.salaries = async (el) => {
  const salaries = await api("/api/salaries");

  el.innerHTML = `
    <div class="toolbar">
      <button class="btn btn-primary" id="sal-add">+ Attribuer un salaire</button>
    </div>
    <div class="panel">
      <div class="panel-body">
        <table>
          <thead><tr><th>Rôle</th><th>ID</th><th>Salaire</th><th>Cooldown</th><th></th></tr></thead>
          <tbody>
            ${salaries.map((s) => `
              <tr>
                <td>${escapeHtml(s.name)}</td>
                <td>${s.role_id}</td>
                <td>${money(s.salary)}</td>
                <td>${(s.cooldown / 3600).toFixed(1)} h</td>
                <td><button class="btn btn-sm btn-danger" data-sal-del="${s.role_id}">Supprimer</button></td>
              </tr>`).join("") || '<tr><td colspan="5" class="empty">Aucun salaire attribué</td></tr>'}
          </tbody>
        </table>
      </div>
    </div>`;

  document.getElementById("sal-add").addEventListener("click", () => {
    openModal(`
      <h3>💰 Attribuer un salaire</h3>
      <div class="form-row"><label>ID du rôle Discord</label><input class="input" type="number" id="sal-role"></div>
      <div class="form-row"><label>Salaire (coins)</label><input class="input" type="number" id="sal-salary" value="100"></div>
      <div class="form-row"><label>Cooldown (secondes)</label><input class="input" type="number" id="sal-cooldown" value="3600"></div>
      <div class="actions">
        <button class="btn" onclick="closeModal()">Annuler</button>
        <button class="btn btn-primary" id="sal-create">Enregistrer</button>
      </div>`);
    document.getElementById("sal-create").addEventListener("click", async () => {
      const body = {
        role_id: parseInt(document.getElementById("sal-role").value, 10),
        salary: parseInt(document.getElementById("sal-salary").value, 10),
        cooldown: parseInt(document.getElementById("sal-cooldown").value, 10) || 3600,
      };
      if (!body.role_id || !body.salary) return toast("Rôle et salaire requis", "error");
      try {
        await api("/api/salaries", { method: "POST", body: JSON.stringify(body) });
        toast("✅ Salaire enregistré", "success");
        closeModal();
        Views.salaries(document.getElementById("view"));
      } catch (err) { toast(err.message, "error"); }
    });
  });

  el.querySelectorAll("[data-sal-del]").forEach((b) =>
    b.addEventListener("click", async () => {
      if (!confirm("Supprimer ce salaire ?")) return;
      try {
        await api(`/api/salaries/${b.dataset.salDel}`, { method: "DELETE" });
        toast("🗑️ Salaire supprimé", "success");
        Views.salaries(document.getElementById("view"));
      } catch (err) { toast(err.message, "error"); }
    })
  );
};

// ---------------------------------------------------------------------------
Views.transactions = async (el, type = "", uid = "") => {
  const params = new URLSearchParams({ limit: 150 });
  if (type) params.set("type", type);
  if (uid) params.set("user_id", uid);
  const rows = await api(`/api/transactions?${params}`);

  el.innerHTML = `
    <div class="toolbar">
      <select class="input" id="tx-type">
        <option value="">Tous les types</option>
        ${Object.entries(TX_LABELS).map(([k, v]) => `<option value="${k}" ${k === type ? "selected" : ""}>${v}</option>`).join("")}
      </select>
      <input class="input" type="text" id="tx-user" placeholder="Filtrer par ID utilisateur..." value="${escapeHtml(uid)}">
      <button class="btn btn-primary" id="tx-filter">Filtrer</button>
    </div>
    <div class="panel">
      <div class="panel-body">
        <table>
          <thead><tr><th>Date</th><th>Utilisateur</th><th>Type</th><th>Montant</th><th>Détail</th></tr></thead>
          <tbody>
            ${rows.map((r) => `
              <tr>
                <td>${r.created_at}</td>
                <td>${escapeHtml(r.name)}</td>
                <td><span class="badge gray">${TX_LABELS[r.type] || r.type}</span></td>
                <td class="${["purchase", "withdraw", "transfer_out", "remove_money"].includes(r.type) ? "neg" : "pos"}">
                  ${["purchase", "withdraw", "transfer_out", "remove_money"].includes(r.type) ? "−" : "+"}${money(r.amount)}
                </td>
                <td>${escapeHtml(r.details || (r.item_name ? `${r.quantity}x ${r.item_name}` : ""))}</td>
              </tr>`).join("") || '<tr><td colspan="5" class="empty">Aucune transaction</td></tr>'}
          </tbody>
        </table>
      </div>
    </div>`;

  document.getElementById("tx-filter").addEventListener("click", () =>
    Views.transactions(
      el,
      document.getElementById("tx-type").value,
      document.getElementById("tx-user").value.trim()
    )
  );
};

// ---------------------------------------------------------------------------
Views.audit = async (el) => {
  const rows = await api("/api/audit");
  el.innerHTML = `
    <div class="panel">
      <div class="panel-head"><h3>📜 Journal des actions admin</h3></div>
      <div class="panel-body">
        <table>
          <thead><tr><th>Date</th><th>Action</th><th>Cible</th><th>Détails</th></tr></thead>
          <tbody>
            ${rows.map((r) => `
              <tr>
                <td>${r.created_at}</td>
                <td><span class="badge orange">${escapeHtml(r.action)}</span></td>
                <td>${escapeHtml(r.target)}</td>
                <td>${escapeHtml(r.details)}</td>
              </tr>`).join("") || '<tr><td colspan="4" class="empty">Aucune entrée</td></tr>'}
          </tbody>
        </table>
      </div>
    </div>`;
};

// ---------------------------------------------------------------------------
async function render(view, keep = false) {
  const el = document.getElementById("view");
  const titles = {
    dashboard: ["📊 Dashboard", "Vue d'ensemble du bot et de l'économie"],
    users: ["👥 Utilisateurs", "Gérez les soldes et les inventaires"],
    shops: ["🏪 Shops", "Créez et gèrez les magasins"],
    items: ["📦 Items", "Gérez le catalogue d'items"],
    salaries: ["💰 Salaires", "Salaires attribués aux rôles"],
    transactions: ["🧾 Transactions", "Journal de toutes les transactions"],
    audit: ["📜 Journal", "Traçabilité des actions d'administration"],
  };
  const [title, sub] = titles[view] || ["", ""];
  document.getElementById("topbar").innerHTML = `<h2>${title}</h2><p>${sub}</p>`;

  if (!keep) {
    el.innerHTML = '<div class="skeleton">Chargement...</div>';
  }
  try {
    await Views[view](el);
  } catch (err) {
    el.innerHTML = `<div class="panel"><div class="panel-body"><div class="error-box">${escapeHtml(err.message)}</div></div></div>`;
    toast(err.message, "error");
  }
}

// ---------------------------------------------------------------------------
const NAV = document.getElementById("nav");

NAV.querySelectorAll("a").forEach((a) =>
  a.addEventListener("click", () => {
    NAV.querySelectorAll("a").forEach((x) => x.classList.remove("active"));
    a.classList.add("active");
    render(a.dataset.view);
  })
);

render("dashboard");