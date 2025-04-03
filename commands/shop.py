import discord
from discord.ext import commands, menus
import database

class ShopPaginator(menus.ListPageSource):
    def __init__(self, data, title, color, per_page=5):
        super().__init__(data, per_page=per_page)
        self.title = title
        self.color = color

    async def format_page(self, menu, entries):
        embed = discord.Embed(title=self.title, color=self.color)
        
        for entry in entries:
            if len(entry) == 3:  # Format shops (id, name, description)
                shop_id, name, description = entry
                short_desc = (description[:150] + '...') if len(description) > 150 else description
                embed.add_field(
                    name=f"{name} (ID: {shop_id})",
                    value=f"📖 {short_desc}",
                    inline=False
                )
            elif len(entry) == 5:  # Format items (id, name, price, description, stock)
                item_id, name, price, description, stock = entry
                stock_display = "∞" if stock == -1 else str(stock)
                short_desc = (description[:150] + '...') if len(description) > 150 else description
                embed.add_field(
                    name=f"{name} (ID: {item_id})",
                    value=f"💰 Prix: {price} pièces\n📖 {short_desc}\n📦 Stock: {stock_display}",
                    inline=False
                )
            elif len(entry) >= 6:  # Format items_list (id, name, price, description, stock, active, ...)
                status = "✅ Actif" if entry[5] == 1 else "❌ Inactif"
                stock_display = "∞" if entry[4] == -1 else str(entry[4])
                embed.add_field(
                    name=f"{entry[1]} (ID: {entry[0]})",
                    value=f"Prix: {entry[2]} | Stock: {stock_display} | {status}",
                    inline=False
                )
        
        embed.set_footer(text=f"Page {menu.current_page + 1}/{self.get_max_pages()}")
        return embed

class Shop(commands.Cog):
    def __init__(self, bot):
        self.bot = bot

    async def paginate(self, ctx, data, title, color):
        if not data:
            embed = discord.Embed(title=title, description="Aucun élément trouvé.", color=discord.Color.red())
            return await ctx.send(embed=embed)
        
        pages = menus.MenuPages(source=ShopPaginator(data, title, color), clear_reactions_after=True)
        await pages.start(ctx)

    @commands.command()
    async def shops(self, ctx):
        """Affiche la liste paginée de tous les shops"""
        shops = database.get_shops()
        await self.paginate(ctx, shops, "🏪 Liste des Shops", discord.Color.blue())

    @commands.command()
    async def shop(self, ctx, shop_id: int):
        """Affiche les items d'un shop spécifique avec pagination"""
        items = database.get_shop_items(shop_id)
        await self.paginate(ctx, items, f"🛍️ Items du Shop {shop_id}", discord.Color.green())

    @commands.command()
    async def create_shop(self, ctx, name: str, *, description: str):
        """Créer un shop avec description (admin uniquement)."""
        if not ctx.author.guild_permissions.administrator:
            await ctx.send(embed=discord.Embed(title="❌ Permission refusée", description="Tu n'as pas la permission de créer un shop.", color=discord.Color.red()))
            return

        shop_id = database.create_shop(name, description)
        embed = discord.Embed(title="🏪 Nouveau Shop créé", description=f"Nom : {name}\n📖 {description}\nID : {shop_id}", color=discord.Color.blue())
        await ctx.send(embed=embed)

    @commands.command()
    async def delete_shop(self, ctx, shop_id: int):
        """Supprimer un shop (admin uniquement)."""
        if not ctx.author.guild_permissions.administrator:
            await ctx.send(embed=discord.Embed(title="❌ Permission refusée", description="Tu n'as pas la permission de supprimer un shop.", color=discord.Color.red()))
            return

        success = database.delete_shop(shop_id)
        if success:
            await ctx.send(embed=discord.Embed(title="🗑️ Shop Supprimé", description=f"Le shop ID {shop_id} a été supprimé.", color=discord.Color.red()))
        else:
            await ctx.send(embed=discord.Embed(title="❌ Erreur", description="Le shop n'a pas pu être supprimé.", color=discord.Color.red()))

    @commands.command()
    async def add_item(self, ctx, shop_id: int, name: str, price: int, stock: int = -1, *, description: str):
        """Ajouter un item avec description et stock (admin uniquement). Stock = -1 pour illimité."""
        if not ctx.author.guild_permissions.administrator:
            await ctx.send(embed=discord.Embed(title="❌ Permission refusée", description="Tu n'as pas la permission d'ajouter un item.", color=discord.Color.red()))
            return

        if price <= 0:
            await ctx.send(embed=discord.Embed(title="❌ Erreur", description="Le prix doit être supérieur à zéro.", color=discord.Color.red()))
            return

        item_id = database.add_item_to_shop(shop_id, name, price, description, stock)
        stock_display = "∞" if stock == -1 else str(stock)
        embed = discord.Embed(
            title="🛍️ Nouvel Item ajouté",
            description=f"Item : {name}\nPrix : {price} pièces\n📖 {description}\n📦 Stock : {stock_display}\nDans le shop ID {shop_id}",
            color=discord.Color.green()
        )
        await ctx.send(embed=embed)

    @commands.command()
    async def remove_item(self, ctx, item_id: int):
        """Supprimer un item du shop (admin uniquement)."""
        if not ctx.author.guild_permissions.administrator:
            await ctx.send(embed=discord.Embed(title="❌ Permission refusée", description="Tu n'as pas la permission de supprimer un item.", color=discord.Color.red()))
            return

        success = database.remove_item(item_id)
        if success:
            await ctx.send(embed=discord.Embed(title="🗑️ Item Supprimé", description=f"Item ID {item_id} supprimé (désactivé).", color=discord.Color.red()))
        else:
            await ctx.send(embed=discord.Embed(title="❌ Erreur", description="L'item n'a pas pu être supprimé.", color=discord.Color.red()))

    @commands.command()
    async def acheter(self, ctx, shop_id: int, item_name: str, quantity: int = 1):
        """Acheter un item par son nom."""
        item = database.get_item_by_name(item_name)
        
        if not item:
            await ctx.send(embed=discord.Embed(
                title="❌ Item introuvable",
                description=f"Aucun item nommé **{item_name}** n'a été trouvé.",
                color=discord.Color.red()
            ))
            return

        item_id, name, price, description, stock, active = item

        if active != 1:
            await ctx.send(embed=discord.Embed(
                title="❌ Item inactif",
                description=f"L'item **{name}** n'est pas disponible à l'achat.",
                color=discord.Color.red()
            ))
            return

        if stock != -1 and stock < quantity:
            await ctx.send(embed=discord.Embed(
                title="❌ Stock insuffisant",
                description=f"Il ne reste que {stock} unités de **{name}**.",
                color=discord.Color.red()
            ))
            return

        total_cost = price * quantity
        user_balance = database.get_balance(ctx.author.id)
        if user_balance < total_cost:
            await ctx.send(embed=discord.Embed(
                title="❌ Solde insuffisant",
                description=f"Tu n'as pas assez d'argent pour acheter {quantity}x **{name}**.",
                color=discord.Color.red()
            ))
            return

        try:
            database.update_balance(ctx.author.id, -total_cost)
            database.add_user_item(ctx.author.id, shop_id, item_id, quantity)

            if stock != -1:
                database.decrement_item_stock(shop_id, item_id, quantity)

            await ctx.send(embed=discord.Embed(
                title="✅ Achat réussi",
                description=f"{ctx.author.mention} a acheté {quantity}x **{name}** pour **{total_cost}** pièces.",
                color=discord.Color.green()
            ))
        except Exception as e:
            await ctx.send(embed=discord.Embed(
                title="❌ Erreur lors de l'achat",
                description=f"Une erreur s'est produite lors de l'achat de **{name}**. Veuillez réessayer.",
                color=discord.Color.red()
            ))
            print(f"Erreur lors de l'achat : {e}")

    @commands.command()
    async def vendre(self, ctx, shop_id: int, item_name: str, quantity: int = 1):
        """Vendre un item par son nom (80% du prix)."""
        item = database.get_item_by_name(item_name)
        if not item:
            await ctx.send(embed=discord.Embed(title="❌ Item introuvable", description=f"Aucun item nommé **{item_name}**.", color=discord.Color.red()))
            return

        item_id, name, price = item[0], item[1], int(item[2] * 0.8)
        total_earned = price * quantity

        inventory = database.get_user_inventory(ctx.author.id)
        user_has_item = any(i[0] == name and i[1] >= quantity for i in inventory)
        if not user_has_item:
            await ctx.send(embed=discord.Embed(title="❌ Quantité insuffisante", description=f"Tu ne possèdes pas {quantity}x **{name}**.", color=discord.Color.red()))
            return

        database.remove_user_item(ctx.author.id, shop_id, item_id, quantity)
        database.update_balance(ctx.author.id, total_earned)
        await ctx.send(embed=discord.Embed(title="💰 Vente réussie", description=f"{ctx.author.mention} a vendu {quantity}x **{name}** pour **{total_earned}** pièces.", color=discord.Color.blue()))

    @commands.command()
    async def items_list(self, ctx):
        """[Admin uniquement] Liste complète de tous les items existants, actifs et inactifs."""
        if not ctx.author.guild_permissions.administrator:
            await ctx.send(embed=discord.Embed(title="❌ Permission refusée", description="Tu n'as pas la permission de consulter cette liste.", color=discord.Color.red()))
            return

        items = database.get_all_items()
        await self.paginate(ctx, items, "📜 Tous les Items", discord.Color.blue())

    @commands.command()
    async def item_info(self, ctx, *, name: str):
        """Afficher les informations détaillées d'un item par son nom."""
        item = database.get_item_by_name(name)
        if not item:
            await ctx.send(embed=discord.Embed(title="❌ Introuvable", description=f"Aucun item nommé **{name}**.", color=discord.Color.red()))
            return

        item_id, name, price, description, stock, active = item[0], item[1], item[2], item[3], item[4], item[5]
        stock_display = "∞" if stock == -1 else str(stock)

        embed = discord.Embed(title=f"🔎 Infos sur l'item : {name}", color=discord.Color.purple())
        embed.add_field(name="ID", value=f"{item_id}", inline=True)
        embed.add_field(name="Prix", value=f"{price} pièces", inline=True)
        embed.add_field(name="Stock", value=stock_display, inline=True)
        embed.add_field(name="État", value="✅ Actif" if active == 1 else "❌ Inactif", inline=True)
        embed.add_field(name="Description", value=description, inline=False)

        await ctx.send(embed=embed)

    @commands.command()
    async def reactivate_item(self, ctx, item_id: int, stock: int = None):
        """[Admin uniquement] Réactiver un item inactif et réinitialiser son stock optionnellement."""
        if not ctx.author.guild_permissions.administrator:
            await ctx.send(embed=discord.Embed(title="❌ Permission refusée", description="Tu n'as pas la permission de réactiver un item.", color=discord.Color.red()))
            return

        item = database.get_item_by_id(item_id)
        if not item:
            await ctx.send(embed=discord.Embed(title="❌ Erreur", description=f"Aucun item trouvé avec l'ID {item_id}.", color=discord.Color.red()))
            return

        database.reactivate_item(item_id, stock)
        stock_msg = f"avec un stock de **{stock}**" if stock is not None else "sans modification de stock"
        embed = discord.Embed(title="✅ Item réactivé", description=f"L'item **{item[1]}** a été réactivé {stock_msg}.", color=discord.Color.green())
        await ctx.send(embed=embed)

async def setup(bot):
    await bot.add_cog(Shop(bot))
