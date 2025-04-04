import discord
from discord import app_commands
from discord.ext import commands
from discord.ui import Button, View
import database
import asyncio

class Shop(commands.Cog):
    def __init__(self, bot):
        self.bot = bot
        self.active_paginators = {}

    class PaginatorView(View):
        def __init__(self, pages, timeout=60):
            super().__init__(timeout=timeout)
            self.pages = pages
            self.current_page = 0
            self.message = None

            # Boutons précédent/suivant
            self.prev_button = Button(emoji="⬅️", style=discord.ButtonStyle.blurple)
            self.next_button = Button(emoji="➡️", style=discord.ButtonStyle.blurple)
            
            self.prev_button.callback = self.previous_page
            self.next_button.callback = self.next_page
            
            self.add_item(self.prev_button)
            self.add_item(self.next_button)
            self.update_buttons()

        def update_buttons(self):
            self.prev_button.disabled = self.current_page == 0
            self.next_button.disabled = self.current_page == len(self.pages) - 1

        async def previous_page(self, interaction: discord.Interaction):
            if interaction.user != self.message.interaction.user:
                return await interaction.response.send_message("Seul l'auteur peut interagir.", ephemeral=True)
            
            self.current_page = max(0, self.current_page - 1)
            self.update_buttons()
            await interaction.response.edit_message(embed=self.pages[self.current_page], view=self)

        async def next_page(self, interaction: discord.Interaction):
            if interaction.user != self.message.interaction.user:
                return await interaction.response.send_message("Seul l'auteur peut interagir.", ephemeral=True)
            
            self.current_page = min(len(self.pages) - 1, self.current_page + 1)
            self.update_buttons()
            await interaction.response.edit_message(embed=self.pages[self.current_page], view=self)

    async def send_paginated(self, interaction: discord.Interaction, data, title: str, color: discord.Color, items_per_page: int = 5):
        """Envoie un message paginé avec les données"""
        if not data:
            return await interaction.response.send_message(
                embed=discord.Embed(
                    title=title,
                    description="Aucun élément trouvé.",
                    color=color
                ),
                ephemeral=True
            )

        # Tri par prix si ce sont des items
        if len(data) > 0 and len(data[0]) >= 5:
            data = sorted(data, key=lambda x: x[2])  # x[2] = prix

        pages = []
        for i in range(0, len(data), items_per_page):
            embed = discord.Embed(
                title=f"{title} - Page {i//items_per_page + 1}/{(len(data)-1)//items_per_page + 1}",
                color=color
            )
            
            for item in data[i:i + items_per_page]:
                if len(item) == 3:  # Format shop
                    shop_id, name, description = item
                    embed.add_field(
                        name=f"{name} (ID: {shop_id})",
                        value=f"📖 {description[:200] + ('...' if len(description) > 200 else '')}",
                        inline=False
                    )
                elif len(item) >= 5:  # Format item
                    item_id, name, price, description, stock = item[:5]
                    stock_display = "∞" if stock == -1 else stock
                    embed.add_field(
                        name=f"{name} (ID: {item_id})",
                        value=f"💰 Prix: {price} pièces\n📖 {description[:200]}\n📦 Stock: {stock_display}",
                        inline=False
                    )
            
            pages.append(embed)

        if len(pages) == 1:
            return await interaction.response.send_message(embed=pages[0])
        
        view = self.PaginatorView(pages)
        await interaction.response.send_message(embed=pages[0], view=view)
        view.message = await interaction.original_response()

    @app_commands.command(name="shops", description="Liste tous les magasins disponibles")
    async def shops(self, interaction: discord.Interaction):
        """Liste tous les magasins"""
        shops = database.get_shops()
        await self.send_paginated(interaction, shops, "🏪 Liste des magasins", discord.Color.blue())

    @app_commands.command(name="shop", description="Affiche les articles d'un magasin spécifique")
    @app_commands.describe(shop_id="L'ID du magasin à consulter")
    async def shop(self, interaction: discord.Interaction, shop_id: int):
        """Affiche les articles d'un magasin"""
        items = database.get_shop_items(shop_id)
        await self.send_paginated(interaction, items, f"🛍️ Magasin #{shop_id}", discord.Color.green())

    @app_commands.command(name="acheter", description="Acheter un article par son nom")
    @app_commands.describe(
        shop_id="ID du magasin",
        item_name="Nom de l'article",
        quantity="Quantité à acheter (défaut: 1)"
    )
    async def acheter(self, interaction: discord.Interaction, shop_id: int, item_name: str, quantity: app_commands.Range[int, 1] = 1):
        """Commande pour acheter un item"""
        item = database.get_item_by_name(item_name)
        
        if not item:
            return await interaction.response.send_message(
                embed=discord.Embed(
                    title="❌ Article introuvable",
                    description=f"Aucun article nommé '{item_name}' trouvé.",
                    color=discord.Color.red()
                ),
                ephemeral=True
            )

        item_id, name, price, description, stock, active = item

        if not active:
            return await interaction.response.send_message(
                embed=discord.Embed(
                    title="❌ Article indisponible",
                    description="Cet article n'est plus en vente.",
                    color=discord.Color.red()
                ),
                ephemeral=True
            )

        if stock != -1 and stock < quantity:
            return await interaction.response.send_message(
                embed=discord.Embed(
                    title="❌ Stock insuffisant",
                    description=f"Il ne reste que {stock} unité(s) disponible(s).",
                    color=discord.Color.red()
                ),
                ephemeral=True
            )

        total_price = price * quantity
        user_balance = database.get_balance(interaction.user.id)

        if user_balance < total_price:
            return await interaction.response.send_message(
                embed=discord.Embed(
                    title="❌ Solde insuffisant",
                    description=f"Vous n'avez que {user_balance} pièces (nécessaire: {total_price}).",
                    color=discord.Color.red()
                ),
                ephemeral=True
            )

        try:
            # Effectuer l'achat
            database.update_balance(interaction.user.id, -total_price)
            database.add_user_item(interaction.user.id, shop_id, item_id, quantity)
            
            if stock != -1:
                database.decrement_item_stock(shop_id, item_id, quantity)

            embed = discord.Embed(
                title="✅ Achat réussi",
                description=f"Vous avez acheté {quantity}x {name} pour {total_price} pièces.",
                color=discord.Color.green()
            )
            await interaction.response.send_message(embed=embed)

        except Exception as e:
            await interaction.response.send_message(
                embed=discord.Embed(
                    title="❌ Erreur lors de l'achat",
                    description="Une erreur est survenue, veuillez réessayer.",
                    color=discord.Color.red()
                ),
                ephemeral=True
            )
            print(f"Erreur achat: {e}")

    @app_commands.command(name="vendre", description="Vendre un article de votre inventaire")
    @app_commands.describe(
        shop_id="ID du magasin d'origine",
        item_name="Nom de l'article",
        quantity="Quantité à vendre (défaut: 1)"
    )
    async def vendre(self, interaction: discord.Interaction, shop_id: int, item_name: str, quantity: app_commands.Range[int, 1] = 1):
        """Commande pour vendre un item"""
        item = database.get_item_by_name(item_name)
        
        if not item:
            return await interaction.response.send_message(
                embed=discord.Embed(
                    title="❌ Article introuvable",
                    description=f"Aucun article nommé '{item_name}' trouvé.",
                    color=discord.Color.red()
                ),
                ephemeral=True
            )

        item_id, name, price = item[0], item[1], item[2]
        sell_price = int(price * 0.8) * quantity  # 80% du prix d'achat

        # Vérifier si l'utilisateur possède l'item
        inventory = database.get_user_inventory(interaction.user.id)
        has_item = any(i[0] == name and i[1] >= quantity for i in inventory)

        if not has_item:
            return await interaction.response.send_message(
                embed=discord.Embed(
                    title="❌ Quantité insuffisante",
                    description=f"Vous ne possédez pas {quantity}x {name}.",
                    color=discord.Color.red()
                ),
                ephemeral=True
            )

        try:
            database.remove_user_item(interaction.user.id, shop_id, item_id, quantity)
            database.update_balance(interaction.user.id, sell_price)

            embed = discord.Embed(
                title="💰 Vente réussie",
                description=f"Vous avez vendu {quantity}x {name} pour {sell_price} pièces.",
                color=discord.Color.green()
            )
            await interaction.response.send_message(embed=embed)

        except Exception as e:
            await interaction.response.send_message(
                embed=discord.Embed(
                    title="❌ Erreur lors de la vente",
                    description="Une erreur est survenue, veuillez réessayer.",
                    color=discord.Color.red()
                ),
                ephemeral=True
            )
            print(f"Erreur vente: {e}")

    # Commandes admin
    @app_commands.command(name="add_item", description="[ADMIN] Ajouter un article à un magasin")
    @app_commands.default_permissions(administrator=True)
    @app_commands.describe(
        shop_id="ID du magasin",
        name="Nom de l'article",
        price="Prix de l'article",
        stock="Stock initial (-1 pour illimité)",
        description="Description de l'article"
    )
    async def add_item(
        self,
        interaction: discord.Interaction,
        shop_id: int,
        name: str,
        price: app_commands.Range[int, 1],
        stock: int = -1,
        description: str = ""
    ):
        """Ajouter un item à un shop (admin)"""
        try:
            item_id = database.add_item_to_shop(shop_id, name, price, description, stock)
            embed = discord.Embed(
                title="✅ Article ajouté",
                description=f"L'article {name} a été ajouté au magasin #{shop_id}",
                color=discord.Color.green()
            )
            embed.add_field(name="ID", value=str(item_id))
            embed.add_field(name="Prix", value=f"{price} pièces")
            embed.add_field(name="Stock", value="∞" if stock == -1 else str(stock))
            await interaction.response.send_message(embed=embed)
        except Exception as e:
            await interaction.response.send_message(
                embed=discord.Embed(
                    title="❌ Erreur",
                    description=f"Impossible d'ajouter l'article: {str(e)}",
                    color=discord.Color.red()
                ),
                ephemeral=True
            )

async def setup(bot):
    await bot.add_cog(Shop(bot))
    print("✅ Module Shop chargé")
