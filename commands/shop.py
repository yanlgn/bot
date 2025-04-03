import discord
from discord.ext import commands
from discord.ui import Button, View
import database
import asyncio

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
        
        current_page = 0
        message = await ctx.send(embed=pages[current_page])
        
        if len(pages) > 1:
            # Création des boutons
            previous_button = Button(emoji="⬅️", style=discord.ButtonStyle.blurple)
            next_button = Button(emoji="➡️", style=discord.ButtonStyle.blurple)
            
            # Création de la vue
            view = View(timeout=60)
            view.add_item(previous_button)
            view.add_item(next_button)
            
            await message.edit(view=view)
            
            # Gestion des interactions
            async def button_callback(interaction):
                nonlocal current_page
                
                if interaction.user != ctx.author:
                    return await interaction.response.send_message("Seul l'auteur de la commande peut interagir.", ephemeral=True)
                
                if interaction.component == previous_button:
                    current_page = max(0, current_page - 1)
                elif interaction.component == next_button:
                    current_page = min(len(pages) - 1, current_page + 1)
                
                await interaction.response.edit_message(embed=pages[current_page], view=view)
            
            previous_button.callback = button_callback
            next_button.callback = button_callback
            
            # Timeout
            async def on_timeout():
                await message.edit(view=None)
            
            view.on_timeout = on_timeout

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
        """Acheter un item par son nom."""
        # Récupérer l'item par son nom
        item = database.get_item_by_name(item_name)
        
        # Vérifier si l'item existe
        if not item:
            await ctx.send(embed=discord.Embed(
                title="❌ Item introuvable",
                description=f"Aucun item nommé **{item_name}** n'a été trouvé.",
                color=discord.Color.red()
            ))
            return

        # Extraire les informations de l'item
        item_id, name, price, description, stock, active = item

        # Vérifier si l'item est actif
        if active != 1:
            await ctx.send(embed=discord.Embed(
                title="❌ Item inactif",
                description=f"L'item **{name}** n'est pas disponible à l'achat.",
                color=discord.Color.red()
            ))
            return

        # Vérifier si le stock est suffisant
        if stock != -1 and stock < quantity:
            await ctx.send(embed=discord.Embed(
                title="❌ Stock insuffisant",
                description=f"Il ne reste que {stock} unités de **{name}**.",
                color=discord.Color.red()
            ))
            return

        # Calculer le coût total
        total_cost = price * quantity

        # Vérifier si l'utilisateur a assez d'argent
        user_balance = database.get_balance(ctx.author.id)
        if user_balance < total_cost:
            await ctx.send(embed=discord.Embed(
                title="❌ Solde insuffisant",
                description=f"Tu n'as pas assez d'argent pour acheter {quantity}x **{name}**.",
                color=discord.Color.red()
            ))
            return

        # Effectuer l'achat
        try:
            # Retirer l'argent de l'utilisateur
            database.update_balance(ctx.author.id, -total_cost)

            # Ajouter l'item à l'inventaire de l'utilisateur
            database.add_user_item(ctx.author.id, shop_id, item_id, quantity)

            # Décrémenter le stock si nécessaire
            if stock != -1:
                print(f"Décrémentation du stock pour shop_id={shop_id}, item_id={item_id}, quantité={quantity}")  # Log
                database.decrement_item_stock(shop_id, item_id, quantity)  # Décrémenter de la quantité totale

            # Envoyer un message de confirmation
            await ctx.send(embed=discord.Embed(
                title="✅ Achat réussi",
                description=f"{ctx.author.mention} a acheté {quantity}x **{name}** pour **{total_cost}** pièces.",
                color=discord.Color.green()
            ))
        except Exception as e:
            # En cas d'erreur, annuler l'achat et informer l'utilisateur
            await ctx.send(embed=discord.Embed(
                title="❌ Erreur lors de l'achat",
                description=f"Une erreur s'est produite lors de l'achat de **{name}**. Veuillez réessayer.",
                color=discord.Color.red()
            ))
            print(f"Erreur lors de l'achat : {e}")
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
