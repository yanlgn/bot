import discord
from discord import app_commands
from discord.ext import commands
from discord.ui import Button, View
import database
import logging

class Shop(commands.Cog):
    def __init__(self, bot):
        self.bot = bot

    class PaginatorView(View):
        def __init__(self, author_id, pages, timeout=60):
            super().__init__(timeout=timeout)
            self.author_id = author_id
            self.pages = pages
            self.current_page = 0

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
            if interaction.user.id != self.author_id:
                return await interaction.response.send_message("Seul l'auteur peut interagir.", ephemeral=True)
            
            self.current_page = max(0, self.current_page - 1)
            self.update_buttons()
            await interaction.response.edit_message(embed=self.pages[self.current_page], view=self)

        async def next_page(self, interaction: discord.Interaction):
            if interaction.user.id != self.author_id:
                return await interaction.response.send_message("Seul l'auteur peut interagir.", ephemeral=True)
            
            self.current_page = min(len(self.pages) - 1, self.current_page + 1)
            self.update_buttons()
            await interaction.response.edit_message(embed=self.pages[self.current_page], view=self)

        async def on_timeout(self):
            # Désactive les boutons quand le timeout est atteint
            for item in self.children:
                item.disabled = True
            try:
                await self.message.edit(view=self)
            except Exception:
                pass

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
        total_pages = ((len(data) - 1) // items_per_page) + 1
        
        for i in range(0, len(data), items_per_page):
            embed = discord.Embed(
                title=f"{title} - Page {i//items_per_page + 1}/{total_pages}",
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
        
        view = self.PaginatorView(interaction.user.id, pages)
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

    @app_commands.command(name="create_shop", description="Créer un nouveau shop (Admin)")
    @app_commands.default_permissions(administrator=True)
    @app_commands.describe(
        name="Le nom du nouveau shop",
        description="La description du shop"
    )
    async def create_shop(self, interaction: discord.Interaction, name: str, description: str):
        shop_id = database.create_shop(name, description)
        embed = discord.Embed(
            title="🏪 Nouveau Shop créé",
            description=f"Nom: {name}\nDescription: {description}\nID: {shop_id}",
            color=discord.Color.blue()
        )
        await interaction.response.send_message(embed=embed)

    @app_commands.command(name="delete_shop", description="Supprimer un shop (Admin seulement)")
    @app_commands.default_permissions(administrator=True)
    @app_commands.describe(shop_id="L'ID du shop à supprimer")
    async def delete_shop(self, interaction: discord.Interaction, shop_id: int):
        success = database.delete_shop(shop_id)
        if success:
            embed = discord.Embed(title="🗑️ Shop Supprimé", 
                                description=f"Le shop ID {shop_id} a été supprimé.", 
                                color=discord.Color.red())
        else:
            embed = discord.Embed(title="❌ Erreur", 
                                description="Le shop n'a pas pu être supprimé.", 
                                color=discord.Color.red())
        await interaction.response.send_message(embed=embed)

    @app_commands.command(name="add_item", description="Ajouter un item à un shop (Admin seulement)")
    @app_commands.default_permissions(administrator=True)
    @app_commands.describe(
        shop_id="L'ID du shop où ajouter l'item",
        name="Le nom de l'item",
        price="Le prix de l'item (doit être > 0)",
        stock="Le stock initial (-1 pour illimité)",
        description="La description de l'item"
    )
    async def add_item(self, interaction: discord.Interaction, shop_id: int, name: str, price: app_commands.Range[int, 1], stock: int = -1, description: str = ""):
        item_id = database.add_item_to_shop(shop_id, name, price, description, stock)
        stock_display = "∞" if stock == -1 else str(stock)
        embed = discord.Embed(
            title="🛍️ Nouvel Item ajouté",
            description=f"Item : {name}\nPrix : {price} pièces\n📖 {description}\n📦 Stock : {stock_display}\nDans le shop ID {shop_id}",
            color=discord.Color.green()
        )
        await interaction.response.send_message(embed=embed)

    @app_commands.command(name="acheter", description="Acheter un item par son nom")
    @app_commands.describe(
        shop_id="L'ID du shop où acheter",
        item_name="Le nom de l'item à acheter",
        quantity="La quantité à acheter (défaut: 1)"
    )
    async def acheter(self, interaction: discord.Interaction, shop_id: int, item_name: str, quantity: app_commands.Range[int, 1] = 1):
        item = database.get_item_by_name(item_name, shop_id=shop_id)

        if not item:
            await interaction.response.send_message(embed=discord.Embed(
                title="❌ Item introuvable",
                description=f"Aucun item nommé **{item_name}** dans le shop {shop_id}.",
                color=discord.Color.red()
            ))
            return

        item_id, name, price = item[0], item[1], item[2]

        try:
            total_cost, new_balance = database.buy_item(interaction.user.id, shop_id, item_id, quantity)
            await interaction.response.send_message(embed=discord.Embed(
                title="✅ Achat réussi",
                description=f"{interaction.user.mention} a acheté {quantity}x **{name}** pour **{total_cost}** pièces.",
                color=discord.Color.green()
            ))
        except ValueError as e:
            errors = {
                "ITEM_NOT_FOUND": f"L'item **{name}** n'existe pas dans ce shop.",
                "ITEM_INACTIVE": f"L'item **{name}** n'est plus disponible à l'achat.",
                "STOCK_INSUFFICIENT": f"Stock insuffisant pour acheter {quantity}x **{name}**.",
                "INSUFFICIENT_FUNDS": f"Tu n'as pas assez d'argent pour acheter {quantity}x **{name}**.",
            }
            message = errors.get(str(e), f"Impossible de terminer l'achat : {e}")
            await interaction.response.send_message(embed=discord.Embed(
                title="❌ Achat impossible",
                description=message,
                color=discord.Color.red()
            ))
        except Exception as e:
            await interaction.response.send_message(embed=discord.Embed(
                title="❌ Erreur lors de l'achat",
                description=f"Une erreur s'est produite lors de l'achat de **{name}**. Veuillez réessayer.",
                color=discord.Color.red()
            ))
            logger = logging.getLogger(__name__)
            logger.exception("Erreur lors de l'achat : %s", e)
            
    @app_commands.command(name="vendre", description="Vendre un item")
    @app_commands.describe(
        shop_id="L'ID du shop d'origine de l'item",
        item_name="Le nom de l'item à vendre",
        quantity="La quantité à vendre (défaut: 1)"
    )
    async def vendre(self, interaction: discord.Interaction, shop_id: int, item_name: str, quantity: app_commands.Range[int, 1] = 1):
        item = database.get_item_by_name(item_name, shop_id=shop_id)
        if not item:
            await interaction.response.send_message(embed=discord.Embed(
                title="❌ Item introuvable",
                description=f"Aucun item nommé **{item_name}** dans le shop {shop_id}.",
                color=discord.Color.red()
            ))
            return

        item_id, name = item[0], item[1]

        try:
            total_earned = database.sell_item(interaction.user.id, shop_id, item_id, quantity)
            await interaction.response.send_message(embed=discord.Embed(
                title="💰 Vente réussie",
                description=f"{interaction.user.mention} a vendu {quantity}x **{name}** pour **{total_earned}** pièces.",
                color=discord.Color.blue()
            ))
        except ValueError as e:
            message = {
                "ITEM_NOT_FOUND": f"L'item **{name}** n'existe pas (ou est inactif) dans ce shop.",
                "NOT_ENOUGH_ITEMS": f"Tu ne possèdes pas {quantity}x **{name}** dans ce shop.",
            }.get(str(e), f"Impossible de terminer la vente : {e}")
            await interaction.response.send_message(embed=discord.Embed(
                title="❌ Vente impossible",
                description=message,
                color=discord.Color.red()
            ))
        except Exception as e:
            await interaction.response.send_message(embed=discord.Embed(
                title="❌ Erreur lors de la vente",
                description=f"Une erreur s'est produite lors de la vente de **{name}**. Veuillez réessayer.",
                color=discord.Color.red()
            ))
            logger = logging.getLogger(__name__)
            logger.exception("Erreur lors de la vente : %s", e)
        
    @app_commands.command(name="item_info", description="Afficher les informations détaillées d'un item")
    @app_commands.describe(name="Le nom de l'item à rechercher")
    async def item_info(self, interaction: discord.Interaction, name: str):
        item = database.get_item_by_name(name)
        if not item:
            await interaction.response.send_message(embed=discord.Embed(
                title="❌ Introuvable", 
                description=f"Aucun item nommé **{name}**.", 
                color=discord.Color.red()
            ))
            return

        item_id, name, price, description, stock, active = item[0], item[1], item[2], item[3], item[4], item[5]
        stock_display = "∞" if stock == -1 else str(stock)

        embed = discord.Embed(title=f"🔎 Infos sur l'item : {name}", color=discord.Color.purple())
        embed.add_field(name="ID", value=f"{item_id}", inline=True)
        embed.add_field(name="Prix", value=f"{price} pièces", inline=True)
        embed.add_field(name="Stock", value=stock_display, inline=True)
        embed.add_field(name="État", value="✅ Actif" if active == 1 else "❌ Inactif", inline=True)
        embed.add_field(name="Description", value=description, inline=False)

        await interaction.response.send_message(embed=embed)
        
    @app_commands.command(name="reactivate_item", description="Réactiver un item inactif (Admin seulement)")
    @app_commands.default_permissions(administrator=True)
    @app_commands.describe(
        item_id="L'ID de l'item à réactiver",
        stock="Le nouveau stock (optionnel)"
    )
    async def reactivate_item(self, interaction: discord.Interaction, item_id: int, stock: int = None):
        item = database.get_item_by_id(item_id)
        if not item:
            await interaction.response.send_message(embed=discord.Embed(
                title="❌ Erreur", 
                description=f"Aucun item trouvé avec l'ID {item_id}.", 
                color=discord.Color.red()
            ))
            return

        database.reactivate_item(item_id, stock)
        stock_msg = f"avec un stock de **{stock}**" if stock is not None else "sans modification de stock"
        embed = discord.Embed(
            title="✅ Item réactivé", 
            description=f"L'item **{item[2]}** (ID: {item_id}) a été réactivé {stock_msg}.", 
            color=discord.Color.green()
        )
        await interaction.response.send_message(embed=embed)

    @app_commands.command(name="remove_item", description="Supprimer un item du shop (admin uniquement)")
    @app_commands.default_permissions(administrator=True)
    @app_commands.describe(item_id="L'ID de l'item à supprimer")
    async def remove_item(self, interaction: discord.Interaction, item_id: int):
        item = database.get_item_by_id(item_id)  # Vérifier d'abord si l'item existe
        if not item:
            await interaction.response.send_message(embed=discord.Embed(
                title="❌ Erreur", 
                description=f"Aucun item trouvé avec l'ID {item_id}.", 
                color=discord.Color.red()
            ))
            return

        success = database.remove_item(item_id)
        if success:
            await interaction.response.send_message(embed=discord.Embed(
                title="🗑️ Item Supprimé", 
                description=f"Item **{item[1]}** (ID: {item_id}) a été désactivé.", 
                color=discord.Color.red()
            ))
        else:
            await interaction.response.send_message(embed=discord.Embed(
                title="❌ Erreur", 
                description="L'item n'a pas pu être supprimé.", 
                color=discord.Color.red()
            ))


    @app_commands.command(name="items_list", description="[ADMIN] Liste tous les items du système triés par ID")
    @app_commands.default_permissions(administrator=True)
    async def items_list(self, interaction: discord.Interaction):
        """Affiche tous les items du système (admin seulement)"""
        try:
            all_items = database.get_all_items()
            
            if not all_items:
                return await interaction.response.send_message(
                    embed=discord.Embed(
                        title="📦 Liste des items",
                        description="Aucun item trouvé dans la base de données.",
                        color=discord.Color.orange()
                    ),
                    ephemeral=True
                )
            
            await self.send_paginated(
                interaction=interaction,
                data=all_items,
                title="📦 Tous les items (Admin) - Tri par ID",
                color=discord.Color.purple(),
                items_per_page=5
            )
            
        except Exception as e:
            await interaction.response.send_message(
                embed=discord.Embed(
                    title="❌ Erreur",
                    description=f"Une erreur est survenue : {str(e)}",
                    color=discord.Color.red()
                ),
                ephemeral=True
            )
            print(f"Erreur dans items_list: {e}")

async def setup(bot):
    await bot.add_cog(Shop(bot))
