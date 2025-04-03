import discord
from discord.ext import commands
import database

class Shop(commands.Cog):
    def __init__(self, bot):
        self.bot = bot

    async def send_paginated(self, ctx, data, title, color, items_per_page=5):
        if not data:
            embed = discord.Embed(title=title, description="Aucun élément trouvé.", color=color)
            return await ctx.send(embed=embed)
        
        pages = []
        for i in range(0, len(data), items_per_page):
            page_data = data[i:i + items_per_page]
            embed = discord.Embed(title=f"{title} (Page {i//items_per_page + 1}/{(len(data)-1)//items_per_page + 1})", color=color)
            
            for item in page_data:
                if len(item) == 3:  # Format shop
                    shop_id, name, description = item
                    embed.add_field(
                        name=f"{name} (ID: {shop_id})",
                        value=f"📖 {description[:150] + '...' if len(description) > 150 else description}",
                        inline=False
                    )
                elif len(item) >= 5:  # Format item
                    item_id, name, price, description, stock = item[:5]
                    stock_display = "∞" if stock == -1 else str(stock)
                    embed.add_field(
                        name=f"{name} (ID: {item_id})",
                        value=f"💰 Prix: {price}\n📖 {description[:150] + '...' if len(description) > 150 else description}\n📦 Stock: {stock_display}",
                        inline=False
                    )
            
            pages.append(embed)
        
        message = await ctx.send(embed=pages[0])
        if len(pages) > 1:
            await message.add_reaction("⬅️")
            await message.add_reaction("➡️")

            def check(reaction, user):
                return user == ctx.author and str(reaction.emoji) in ["⬅️", "➡️"] and reaction.message.id == message.id

            page = 0
            while True:
                try:
                    reaction, user = await self.bot.wait_for("reaction_add", timeout=60.0, check=check)
                    
                    if str(reaction.emoji) == "➡️" and page < len(pages) - 1:
                        page += 1
                    elif str(reaction.emoji) == "⬅️" and page > 0:
                        page -= 1
                    
                    await message.edit(embed=pages[page])
                    await message.remove_reaction(reaction, user)
                
                except asyncio.TimeoutError:
                    await message.clear_reactions()
                    break

    @commands.command()
    async def shops(self, ctx):
        """Liste tous les shops avec pagination"""
        shops = database.get_shops()
        await self.send_paginated(ctx, shops, "🏪 Liste des Shops", discord.Color.blue())

    @commands.command()
    async def shop(self, ctx, shop_id: int):
        """Affiche les items d'un shop avec pagination"""
        items = database.get_shop_items(shop_id)
        await self.send_paginated(ctx, items, f"🛍️ Items du Shop {shop_id}", discord.Color.green())

    @commands.command()
    @commands.has_permissions(administrator=True)
    async def create_shop(self, ctx, name: str, *, description: str):
        """Créer un nouveau shop (Admin)"""
        shop_id = database.create_shop(name, description)
        embed = discord.Embed(
            title="🏪 Nouveau Shop créé",
            description=f"Nom: {name}\nDescription: {description}\nID: {shop_id}",
            color=discord.Color.blue()
        )
        await ctx.send(embed=embed)


    @commands.command()
    @commands.has_permissions(administrator=True)
    async def create_shop(self, ctx, name: str, *, description: str):
        """Créer un shop (Admin seulement)."""
        shop_id = database.create_shop(name, description)
        embed = discord.Embed(title="🏪 Nouveau Shop créé", 
                             description=f"Nom : {name}\n📖 {description}\nID : {shop_id}", 
                             color=discord.Color.blue())
        await ctx.send(embed=embed)

    @commands.command()
    @commands.has_permissions(administrator=True)
    async def delete_shop(self, ctx, shop_id: int):
        """Supprimer un shop (Admin seulement)."""
        success = database.delete_shop(shop_id)
        if success:
            embed = discord.Embed(title="🗑️ Shop Supprimé", 
                                description=f"Le shop ID {shop_id} a été supprimé.", 
                                color=discord.Color.red())
        else:
            embed = discord.Embed(title="❌ Erreur", 
                                description="Le shop n'a pas pu être supprimé.", 
                                color=discord.Color.red())
        await ctx.send(embed=embed)

    @commands.command()
    @commands.has_permissions(administrator=True)
    async def add_item(self, ctx, shop_id: int, name: str, price: int, stock: int = -1, *, description: str):
        """Ajouter un item à un shop (Admin seulement)."""
        if price <= 0:
            await ctx.send(embed=discord.Embed(title="❌ Erreur", 
                                             description="Le prix doit être supérieur à zéro.", 
                                             color=discord.Color.red()))
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
    async def acheter(self, ctx, shop_id: int, item_name: str, quantity: int = 1):
        """Acheter un item."""
        item = database.get_item_by_name(item_name)
        if not item:
            await ctx.send(embed=discord.Embed(
                title="❌ Item introuvable",
                description=f"Aucun item nommé **{item_name}**.",
                color=discord.Color.red()
            ))
            return

        item_id, name, price, description, stock, active = item
        if active != 1:
            await ctx.send(embed=discord.Embed(
                title="❌ Item inactif",
                description=f"L'item **{name}** n'est pas disponible.",
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
                title="❌ Erreur",
                description=f"Erreur lors de l'achat: {str(e)}",
                color=discord.Color.red()
            ))

    @commands.command()
    async def vendre(self, ctx, shop_id: int, item_name: str, quantity: int = 1):
        """Vendre un item."""
        item = database.get_item_by_name(item_name)
        if not item:
            await ctx.send(embed=discord.Embed(
                title="❌ Item introuvable",
                description=f"Aucun item nommé **{item_name}**.",
                color=discord.Color.red()
            ))
            return

        item_id, name, price = item[0], item[1], int(item[2] * 0.8)
        total_earned = price * quantity

        inventory = database.get_user_inventory(ctx.author.id)
        user_has_item = any(i[0] == name and i[1] >= quantity for i in inventory)
        if not user_has_item:
            await ctx.send(embed=discord.Embed(
                title="❌ Quantité insuffisante",
                description=f"Tu ne possèdes pas {quantity}x **{name}**.",
                color=discord.Color.red()
            ))
            return

        database.remove_user_item(ctx.author.id, shop_id, item_id, quantity)
        database.update_balance(ctx.author.id, total_earned)
        await ctx.send(embed=discord.Embed(
            title="💰 Vente réussie",
            description=f"{ctx.author.mention} a vendu {quantity}x **{name}** pour **{total_earned}** pièces.",
            color=discord.Color.blue()
        ))

async def setup(bot):
    await bot.add_cog(Shop(bot))
