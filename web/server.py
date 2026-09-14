"""
Serveur web d'administration du bot.

Authentification :
  - mot de passe (variable d'env ADMIN_PASSWORD)
  - Discord OAuth2 optionnel (IDENTIFY scope), restreint aux IDs de ADMIN_IDS

Toutes les routes /api/* nécessitent une session authentifiée + un jeton CSRF
pour les méthodes mutantes (POST/PATCH/DELETE).
"""

import asyncio
import hmac
import os
import secrets
import time
import urllib.parse
import urllib.request
import json as jsonlib

from flask import Flask, session, request, redirect, url_for, render_template, jsonify, abort

import database

logger = __import__("logging").getLogger(__name__)

# ---------------------------------------------------------------------------
# Configuration (variables d'environnement)
# ---------------------------------------------------------------------------
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD") or ""
ADMIN_IDS = [i.strip() for i in os.getenv("ADMIN_IDS", "").split(",") if i.strip()]
CLIENT_ID = os.getenv("DISCORD_CLIENT_ID", "")
CLIENT_SECRET = os.getenv("DISCORD_CLIENT_SECRET", "")
REDIRECT_URI = os.getenv("DISCORD_REDIRECT_URI", "")
SECRET_KEY = os.getenv("SECRET_KEY", "") or secrets.token_hex(32)

AUTHORIZE_URL = "https://discord.com/oauth2/authorize"
TOKEN_URL = "https://discord.com/api/oauth2/token"
API_BASE = "https://discord.com/api"

LOGIN_RATE_LIMIT = 10          # tentatives max
LOGIN_RATE_WINDOW = 300        # secondes
_login_attempts = {}


def create_app(bot):
    app = Flask(__name__)
    app.secret_key = SECRET_KEY

    @app.context_processor
    def _inject_globals():
        return {
            "discord_oauth": bool(CLIENT_ID and CLIENT_SECRET and REDIRECT_URI),
            "admin_name": session.get("admin_name", "Admin"),
        }

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------
    def is_authenticated():
        return session.get("admin") is True

    def csrf_token():
        if "_csrf" not in session:
            session["_csrf"] = secrets.token_hex(32)
        return session["_csrf"]

    def check_csrf():
        token = request.headers.get("X-CSRF-Token") or request.form.get("csrf")
        return bool(token) and hmac.compare_digest(token, session.get("_csrf", ""))

    def require_auth():
        if not is_authenticated():
            if request.path.startswith("/api/") or request.accept_mimetypes.best == "application/json":
                abort(401)
            return redirect(url_for("login"))
        return None

    def rate_limited(ip):
        now = time.time()
        attempts = _login_attempts.get(ip, [])
        attempts = [t for t in attempts if now - t < LOGIN_RATE_WINDOW]
        if len(attempts) >= LOGIN_RATE_LIMIT:
            _login_attempts[ip] = attempts
            return True
        attempts.append(now)
        _login_attempts[ip] = attempts
        return False

    def resolve_names(ids):
        """Transforme des IDs Discord en noms lus depuis le cache du bot."""
        names = {}
        for uid in ids:
            uid = int(uid)
            name = str(uid)
            try:
                for guild in bot.guilds:
                    member = guild.get_member(uid)
                    if member:
                        name = f"{member.display_name} ({uid})"
                        break
            except Exception:
                pass
            names[uid] = name
        return names

    def bot_status():
        try:
            guilds = [
                {
                    "id": g.id,
                    "name": g.name,
                    "member_count": g.member_count,
                }
                for g in bot.guilds
            ]
            return {
                "ready": bot.is_ready(),
                "name": bot.user.display_name if bot.user else None,
                "id": bot.user.id if bot.user else None,
                "latency_ms": round(bot.latency * 1000, 1) if bot.is_ready() else None,
                "guilds": guilds,
                "guild_count": len(guilds),
            }
        except Exception as e:
            logger.exception("Erreur statut bot")
            return {"ready": False, "error": str(e)}

    # ------------------------------------------------------------------
    # Pages
    # ------------------------------------------------------------------
    @app.route("/")
    def index():
        if is_authenticated():
            return redirect(url_for("admin"))
        return redirect(url_for("login"))

    @app.route("/health")
    def health():
        return "OK", 200

    @app.route("/admin/login", methods=["GET", "POST"])
    def login():
        if is_authenticated():
            return redirect(url_for("admin"))

        if request.method == "POST":
            if rate_limited(request.remote_addr or ""):
                return render_template("login.html", error="Trop de tentatives, réessaie plus tard.", csrf=csrf_token()), 429

            if not check_csrf():
                return render_template("login.html", error="Jeton de session invalide. Réessaie.", csrf=csrf_token()), 403

            password = request.form.get("password", "")
            if not ADMIN_PASSWORD:
                return render_template("login.html", error="Aucun mot de passe configuré (variable ADMIN_PASSWORD).", csrf=csrf_token()), 500

            if hmac.compare_digest(password, ADMIN_PASSWORD):
                session.clear()
                session["admin"] = True
                csrf_token()
                return redirect(url_for("admin"))
            return render_template("login.html", error="Mot de passe incorrect.", csrf=csrf_token()), 401

        return render_template("login.html", error=None, csrf=csrf_token())

    @app.route("/admin/auth/discord")
    def discord_auth_start():
        if not (CLIENT_ID and CLIENT_SECRET and REDIRECT_URI):
            abort(404, "Discord OAuth non configuré")
        state = secrets.token_urlsafe(16)
        session["oauth_state"] = state
        params = urllib.parse.urlencode({
            "client_id": CLIENT_ID,
            "redirect_uri": REDIRECT_URI,
            "response_type": "code",
            "scope": "identify",
            "state": state,
        })
        return redirect(f"{AUTHORIZE_URL}?{params}")

    @app.route("/admin/auth/discord/callback")
    def discord_auth_callback():
        if not (CLIENT_ID and CLIENT_SECRET and REDIRECT_URI):
            abort(404, "Discord OAuth non configuré")

        code = request.args.get("code")
        state = request.args.get("state")
        if not code or state != session.pop("oauth_state", None):
            return render_template("login.html", error="Échec de l'authentification Discord.", csrf=csrf_token()), 403

        try:
            data = urllib.parse.urlencode({
                "client_id": CLIENT_ID,
                "client_secret": CLIENT_SECRET,
                "grant_type": "authorization_code",
                "code": code,
                "redirect_uri": REDIRECT_URI,
            }).encode()
            req = urllib.request.Request(TOKEN_URL, data=data, headers={
                "Content-Type": "application/x-www-form-urlencoded",
            })
            with urllib.request.urlopen(req, timeout=15) as resp:
                token_data = jsonlib.loads(resp.read().decode())

            access_token = token_data["access_token"]
        except Exception as e:
            logger.exception("Échec échange token OAuth")
            return render_template("login.html", error=f"Échec OAuth : {e}", csrf=csrf_token()), 502

        try:
            req = urllib.request.Request(
                f"{API_BASE}/users/@me",
                headers={"Authorization": f"Bearer {access_token}"},
            )
            with urllib.request.urlopen(req, timeout=15) as resp:
                me = jsonlib.loads(resp.read().decode())
        except Exception as e:
            logger.exception("Échec récupération identité Discord")
            return render_template("login.html", error=f"Échec récupération identité : {e}", csrf=csrf_token()), 502

        if str(me.get("id")) not in ADMIN_IDS:
            return render_template("login.html", error="Ce compte Discord n'est pas autorisé.", csrf=csrf_token()), 403

        session.clear()
        session["admin"] = True
        session["admin_name"] = me.get("username")
        csrf_token()
        return redirect(url_for("admin"))

    @app.route("/admin/logout", methods=["POST"])
    def logout():
        session.clear()
        return redirect(url_for("login"))

    @app.route("/admin")
    def admin():
        guard = require_auth()
        if guard:
            return guard
        return render_template("admin.html", csrf=csrf_token(), admin_name=session.get("admin_name", "Admin"))

    # ------------------------------------------------------------------
    # API
    # ------------------------------------------------------------------
    def api_guard():
        if not is_authenticated():
            abort(401)
        if request.method in ("POST", "PATCH", "DELETE") and not check_csrf():
            abort(403)

    @app.before_request
    def _api_guard():
        if request.path.startswith("/api/"):
            api_guard()

    def audit(action, target="", details=""):
        database.add_audit_log(0, action, target, details)

    # --- Statistiques & bot -------------------------------------------------
    @app.route("/api/stats")
    def api_stats():
        try:
            return jsonify(database.get_stats())
        except Exception as e:
            logger.exception("Erreur /api/stats")
            return jsonify({"error": str(e)}), 500

    @app.route("/api/bot")
    def api_bot():
        return jsonify(bot_status())

    @app.post("/api/bot/sync")
    def api_bot_sync():
        try:
            fut = asyncio.run_coroutine_threadsafe(bot.tree.sync(), bot.loop)
            count = fut.result(timeout=60)
            audit("bot_sync", "discord", f"{len(count)} commandes")
            return jsonify({"ok": True, "synced": len(count)})
        except Exception as e:
            logger.exception("Erreur sync via web")
            return jsonify({"ok": False, "error": str(e)}), 500

    # --- Utilisateurs ---------------------------------------------------------
    @app.route("/api/users")
    def api_users():
        q = request.args.get("q", "")
        limit = min(int(request.args.get("limit", 50)), 200)
        offset = int(request.args.get("offset", 0))
        users, total = database.list_users(q, limit, offset)
        names = resolve_names([u[0] for u in users])
        data = [
            {"user_id": u[0], "name": names.get(u[0], str(u[0])), "balance": u[1], "bank": u[2]}
            for u in users
        ]
        return jsonify({"users": data, "total": total, "limit": limit, "offset": offset})

    @app.route("/api/users/<int:uid>")
    def api_user(uid):
        inventory = [
            {"name": i[0], "quantity": i[1], "shop": i[2]}
            for i in database.get_user_inventory(uid)
        ]
        return jsonify({
            "user_id": uid,
            "name": resolve_names([uid]).get(uid, str(uid)),
            "balance": database.get_balance(uid),
            "bank": database.get_deposit(uid),
            "inventory": inventory,
        })

    @app.route("/api/users/<int:uid>/money", methods=["POST"])
    def api_user_money(uid):
        data = request.get_json(silent=True) or {}
        action = data.get("action")
        try:
            amount = int(data["amount"])
        except (TypeError, KeyError, ValueError):
            return jsonify({"error": "Montant invalide"}), 400

        try:
            if action == "set":
                if amount < 0:
                    return jsonify({"error": "Montant invalide"}), 400
                database.set_balance(uid, amount)
            elif action == "add":
                database.add_money(uid, amount)
            elif action == "remove":
                database.remove_money(uid, amount)
            else:
                return jsonify({"error": "action inconnue (set|add|remove)"}), 400
        except ValueError as e:
            return jsonify({"error": str(e)}), 400
        except Exception as e:
            logger.exception("Erreur modification solde")
            return jsonify({"error": str(e)}), 500

        audit("user_money", str(uid), f"{action} {amount}")
        return jsonify({"ok": True, "balance": database.get_balance(uid)})

    @app.route("/api/users/<int:uid>/inventory", methods=["POST"])
    def api_user_inventory_add(uid):
        data = request.get_json(silent=True) or {}
        try:
            quantity = max(1, int(data.get("quantity", 1)))
            item = None
            if data.get("item_id") is not None:
                item = database.get_item_by_id(int(data["item_id"]))
            elif data.get("item_name"):
                # get_item_by_name ne renvoie pas shop_id → on résout via l'ID
                named = database.get_item_by_name(data["item_name"])
                if named:
                    item = database.get_item_by_id(named[0])
            if not item:
                return jsonify({"error": "Item introuvable"}), 404
            # item vient de get_item_by_id : (item_id, shop_id, name, ...)
            shop_id = item[1]
            database.add_user_item(uid, shop_id, item[0], quantity)
        except Exception as e:
            logger.exception("Erreur ajout item inventaire")
            return jsonify({"error": str(e)}), 500

        audit("inventory_add", str(uid), f"{quantity}x item #{item[0]} (shop {shop_id})")
        return jsonify({"ok": True})

    @app.route("/api/users/<int:uid>/inventory/remove", methods=["POST"])
    def api_user_inventory_remove(uid):
        data = request.get_json(silent=True) or {}
        try:
            quantity = max(1, int(data.get("quantity", 1)))
            item_id = int(data["item_id"])
            shop_id = int(data["shop_id"])
            database.remove_user_item(uid, shop_id, item_id, quantity)
        except KeyError:
            return jsonify({"error": "item_id et shop_id requis"}), 400
        except ValueError as e:
            return jsonify({"error": str(e) if str(e) != "NOT_ENOUGH_ITEMS" else "Quantité insuffisante dans l'inventaire"}), 400
        except Exception as e:
            logger.exception("Erreur retrait item inventaire")
            return jsonify({"error": str(e)}), 500

        audit("inventory_remove", str(uid), f"{quantity}x item #{item_id} (shop {shop_id})")
        return jsonify({"ok": True})

    # --- Shops ----------------------------------------------------------------
    @app.route("/api/shops")
    def api_shops():
        shops = database.get_shops()
        return jsonify([
            {"shop_id": s[0], "name": s[1], "description": s[2]}
            for s in shops
        ])

    @app.route("/api/shops", methods=["POST"])
    def api_shops_create():
        data = request.get_json(silent=True) or {}
        name = (data.get("name") or "").strip()
        if not name:
            return jsonify({"error": "Nom requis"}), 400
        shop_id = database.create_shop(name, data.get("description", ""))
        audit("shop_create", str(shop_id), name)
        return jsonify({"ok": True, "shop_id": shop_id}), 201

    @app.route("/api/shops/<int:shop_id>", methods=["DELETE"])
    def api_shops_delete(shop_id):
        if not database.delete_shop(shop_id):
            return jsonify({"error": "Shop introuvable"}), 404
        audit("shop_delete", str(shop_id))
        return jsonify({"ok": True})

    @app.route("/api/shops/<int:shop_id>/items")
    def api_shop_items(shop_id):
        items = database.get_shop_items_all(shop_id)
        return jsonify([
            {
                "item_id": i[0], "name": i[1], "price": i[2],
                "description": i[3], "stock": i[4], "active": i[5],
            }
            for i in items
        ])

    # --- Items -----------------------------------------------------------------
    @app.route("/api/items")
    def api_items():
        items = database.get_all_items()
        return jsonify([
            {
                "item_id": i[0], "name": i[1], "price": i[2],
                "description": i[3], "shop_id": i[4], "stock": i[5], "active": i[6],
            }
            for i in items
        ])

    @app.route("/api/items", methods=["POST"])
    def api_items_create():
        data = request.get_json(silent=True) or {}
        shop_id = data.get("shop_id")
        name = (data.get("name") or "").strip()
        try:
            price = int(data["price"])
        except (KeyError, TypeError, ValueError):
            return jsonify({"error": "Prix invalide"}), 400
        if not shop_id or not name or price <= 0:
            return jsonify({"error": "shop_id, nom et prix (>0) requis"}), 400
        try:
            item_id = database.add_item_to_shop(
                int(shop_id), name, price,
                data.get("description", ""),
                data.get("stock", -1) if data.get("stock") != "" else -1,
            )
        except ValueError as e:
            return jsonify({"error": str(e)}), 400
        audit("item_create", str(item_id), name)
        return jsonify({"ok": True, "item_id": item_id}), 201

    @app.route("/api/items/<int:item_id>", methods=["DELETE"])
    def api_items_delete(item_id):
        if not database.get_item_by_id(item_id):
            return jsonify({"error": "Item introuvable"}), 404
        database.remove_item(item_id)
        audit("item_deactivate", str(item_id))
        return jsonify({"ok": True})

    @app.route("/api/items/<int:item_id>/reactivate", methods=["POST"])
    def api_items_reactivate(item_id):
        if not database.get_item_by_id(item_id):
            return jsonify({"error": "Item introuvable"}), 404
        data = request.get_json(silent=True) or {}
        stock = data.get("stock")
        try:
            stock = int(stock) if stock not in (None, "") else None
        except ValueError:
            return jsonify({"error": "Stock invalide"}), 400
        database.reactivate_item(item_id, stock)
        audit("item_reactivate", str(item_id), f"stock={stock}")
        return jsonify({"ok": True})

    # --- Salaires ---------------------------------------------------------------
    @app.route("/api/salaries")
    def api_salaries():
        salaries = database.get_all_roles_salaries()
        names = resolve_names([s[0] for s in salaries])
        return jsonify([
            {
                "role_id": s[0],
                "name": names.get(s[0], str(s[0])),
                "salary": s[1],
                "cooldown": s[2],
            }
            for s in salaries
        ])

    @app.route("/api/salaries", methods=["POST"])
    def api_salaries_create():
        data = request.get_json(silent=True) or {}
        try:
            salary = int(data["salary"])
            role_id = int(data["role_id"])
            cooldown = int(data.get("cooldown", 3600))
        except (KeyError, TypeError, ValueError):
            return jsonify({"error": "role_id, salary et cooldown requis"}), 400
        if salary <= 0:
            return jsonify({"error": "Salaire invalide"}), 400
        database.assign_role_salary(role_id, salary, cooldown)
        audit("salary_upsert", str(role_id), f"{salary} / {cooldown}s")
        return jsonify({"ok": True})

    @app.route("/api/salaries/<int:role_id>", methods=["PATCH"])
    def api_salaries_update(role_id):
        data = request.get_json(silent=True) or {}
        try:
            salary = int(data["salary"])
            cooldown = int(data.get("cooldown", 3600))
        except (TypeError, ValueError, KeyError):
            return jsonify({"error": "salary et cooldown requis"}), 400
        database.assign_role_salary(role_id, salary, cooldown)
        audit("salary_upsert", str(role_id), f"{salary} / {cooldown}s")
        return jsonify({"ok": True})

    @app.route("/api/salaries/<int:role_id>", methods=["DELETE"])
    def api_salaries_delete(role_id):
        database.remove_role_salary(role_id)
        audit("salary_delete", str(role_id))
        return jsonify({"ok": True})

    # --- Transactions & audit ----------------------------------------------------
    @app.route("/api/transactions")
    def api_transactions():
        limit = min(int(request.args.get("limit", 100)), 500)
        uid = request.args.get("user_id")
        uid = int(uid) if uid else None
        tx_type = request.args.get("type") or None
        rows = database.get_transactions(limit, uid, tx_type)
        names = resolve_names([r[1] for r in rows])
        return jsonify([
            {
                "id": r[0],
                "user_id": r[1],
                "name": names.get(r[1], str(r[1])),
                "type": r[2],
                "amount": r[3],
                "item_id": r[4],
                "shop_id": r[5],
                "item_name": r[6],
                "quantity": r[7],
                "details": r[8],
                "created_at": r[9].strftime("%d/%m/%Y %H:%M:%S") if r[9] else None,
            }
            for r in rows
        ])

    @app.route("/api/audit")
    def api_audit():
        rows = database.get_audit_logs(100)
        return jsonify([
            {
                "id": r[0],
                "admin_id": r[1],
                "action": r[2],
                "target": r[3],
                "details": r[4],
                "created_at": r[5].strftime("%d/%m/%Y %H:%M:%S") if r[5] else None,
            }
            for r in rows
        ])

    @app.errorhandler(401)
    def _unauthorized(e):
        if request.path.startswith("/api/"):
            return jsonify({"error": "Non authentifié"}), 401
        return redirect(url_for("login"))

    @app.errorhandler(403)
    def _forbidden(e):
        if request.path.startswith("/api/"):
            return jsonify({"error": "Jeton CSRF invalide"}), 403
        return redirect(url_for("login"))

    @app.errorhandler(404)
    def _not_found(e):
        if request.path.startswith("/api/"):
            return jsonify({"error": "Route inconnue"}), 404
        return "Page introuvable", 404

    return app