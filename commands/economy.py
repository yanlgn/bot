import discord
from discord import app_commands
from discord.ext import commands
from discord.ui import Button, View, Select
import database
import asyncio

class ShopCommands(commands.Cog):
    def __init__(self, bot):
        self.bot = bot

    # Système de pagination
    class PaginationView(View):
        def __init__(self, interaction, pages):
            super().__init__(timeout=60)
            self.interaction = interaction
            self.pages = pages
            self.current_page = 0
            
            # Boutons de navigation
            self.prev_button = Button(emoji="⬅️", style=discord.ButtonStyle.blurple, disabled=True)
            self.next_button = Button(emoji="➡️", style=discord.ButtonStyle.blurple, disabled=len(pages) <= 1)
            
            self.prev_button.callback = self.previous_page
            self.next_button.callback = self.next_page
            
            self.add_item(self.prev_button)
            self.add_item(self.next_button)
        
        async def previous_page(self, interaction: discord.Interaction):
            if interaction.user != self.interaction.user:
                return await interaction.response.send_message("Seul l'auteur peut interagir.", ephemeral=True)
            
            self.current_page = max(0, self.current_page - 1)
            await self.update_buttons(interaction)
        
        async def next_page(self, interaction: discord.Interaction):
            if interaction.user != self.interaction.user:
                return await interaction.response.send_message("Seul l'auteur peut interagir.", ephemeral=True)
            
            self.current_page = min(len(self.pages) - 1, self.current_page + 1)
            await self.update_buttons(interaction)
        
        async def update_buttons(self, interaction):
            self.prev_button.disabled = self.current_page == 0
            self.next_button.disabled = self.current_page == len(self.pages) - 1
            await interaction.response.edit_message(embed=self.pages[self.current_page], view=self)

    # Commandes principales
    @app_commands.command(name="shops", description="Affiche la liste de tous les magasins disponibles")
    async def shops(self, interaction: discord.Interaction):
        """Liste tous les magasins avec pagination"""
        shops_data = database.get_shops()
        pages = []
        
        for i in range(0, len(shops_data), 5):
            embed = discord.Embed(title="🏪 Liste des Magasins", color=discord.Color.blue())
            for shop in shops_data[i:i+5]:
                embed.add_field(
                    name=f"{shop[1]} (ID: {shop[0]})",
                    value=shop[2][:100] + ("..." if len(shop[2]) > 100 else ""),
                    inline=False
                )
            pages.append(embed)
        
        if not pages:
            return await interaction.response.send_message("Aucun magasin trouvé.", ephemeral=True)
        
        view = self.PaginationView(interaction, pages)
        await interaction.response.send_message(embed=pages[0], view=view)

    @app_commands.command(name="shop", description="Affiche les articles d'un magasin spécifique")
    @app_commands.describe(shop_id="L'ID du magasin à consulter")
    async def shop(self, interaction: discord.Interaction, shop_id: int):
        """Affiche les articles d'un magasin avec pagination"""
        items_data = database.get_shop_items(shop_id)
        pages = []
        
        for i in range(0, len(items_data), 5):
            embed = discord.Embed(title=f"🛍️ Magasin #{shop_id}", color=discord.Color.green())
            for item in items_data[i:i+5]:
                stock = "∞" if item[4] == -1 else item[4]
                embed.add_field(
                    name=f"{item[1]} (ID: {item[0]})",
                    value=f"💰 Prix: {item[2]} pièces\n📦 Stock: {stock}",
                    inline=False
                )
            pages.append(embed)
        
        if not pages:
            return await interaction.response.send_message("Ce magasin est vide ou n'existe pas.", ephemeral=True)
        
        view = self.PaginationView(interaction, pages)
        await interaction.response.send_message(embed=pages[0], view=view)

    # Commandes d'achat/vente
    @app_commands.command(name="acheter", description="Acheter un article dans un magasin")
    @app_commands.describe(
        shop_id="ID du magasin",
        item_name="Nom de l'article",
        quantity="Quantité à acheter"
    )
    async def acheter(self, interaction: discord.Interaction, shop_id: int, item_name: str, quantity: app_commands.Range[int, 1] = 1):
        """Commande pour acheter un item"""
        try:
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
            
            total_price = item[2] * quantity
            user_balance = database.get_balance(interaction.user.id)
            
            if user_balance < total_price:
                return await interaction.response.send_message(
                    embed=discord.Embed(
                        title="❌ Solde insuffisant",
                        description=f"Vous avez {user_balance} pièces, il en faut {total_price}.",
                        color=discord.Color.red()
                    ),
                    ephemeral=True
                )
            
            # Processus d'achat
            database.update_balance(interaction.user.id, -total_price)
            database.add_user_item(interaction.user.id, shop_id, item[0], quantity)
            
            await interaction.response.send_message(
                embed=discord.Embed(
                    title="✅ Achat réussi",
                    description=f"Vous avez acheté {quantity}x {item[1]} pour {total_price} pièces.",
                    color=discord.Color.green()
                )
            )
        except Exception as e:
            await interaction.response.send_message(
                embed=discord.Embed(
                    title="❌ Erreur",
                    description=f"Une erreur est survenue: {str(e)}",
                    color=discord.Color.red()
                ),
                ephemeral=True
            )

    # Commandes admin
    @app_commands.command(name="create_shop", description="[ADMIN] Créer un nouveau magasin")
    @app_commands.default_permissions(administrator=True)
    @app_commands.describe(
        name="Nom du magasin",
        description="Description du magasin"
    )
    async def create_shop(self, interaction: discord.Interaction, name: str, description: str):
        """Création d'un nouveau shop"""
        try:
            shop_id = database.create_shop(name, description)
            await interaction.response.send_message(
                embed=discord.Embed(
                    title="✅ Magasin créé",
                    description=f"**{name}** a été créé avec l'ID {shop_id}",
                    color=discord.Color.green()
                )
            )
        except Exception as e:
            await interaction.response.send_message(
                embed=discord.Embed(
                    title="❌ Erreur",
                    description=f"Impossible de créer le magasin: {str(e)}",
                    color=discord.Color.red()
                ),
                ephemeral=True
            )

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
        """Ajout d'un item à un shop"""
        try:
            item_id = database.add_item_to_shop(shop_id, name, price, description, stock)
            await interaction.response.send_message(
                embed=discord.Embed(
                    title="✅ Article ajouté",
                    description=f"L'article {name} a été ajouté au magasin #{shop_id}",
                    color=discord.Color.green()
                ).add_field(
                    name="Détails",
                    value=f"ID: {item_id}\nPrix: {price}\nStock: {'∞' if stock == -1 else stock}"
                )
            )
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
    await bot.add_cog(ShopCommands(bot))
