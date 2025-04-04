import discord
from discord.ext import commands
from discord.ui import Button, View
import database
import asyncio

class Shop(commands.Cog):
    def __init__(self, bot):
        self.bot = bot
    async def send_paginated(self, ctx, data, title, color, items_per_page=5, sort_by_id=False):
        if not data:
            embed = discord.Embed(title=title, description="Aucun élément trouvé.", color=color)
            return await ctx.send(embed=embed)
        
        # Tri par ID si demandé
        if sort_by_id and len(data) > 0:
            data = sorted(data, key=lambda x: x[0])  # x[0] = ID
        
        pages = []
        for i in range(0, len(data), items_per_page):
            page_data = data[i:i + items_per_page]
            embed = discord.Embed(
                title=f"{title} (Page {i//items_per_page + 1}/{(len(data)-1)//items_per_page + 1})", 
                color=color
            )
            
            if sort_by_id:
                embed.set_footer(text="Trié par ID")
            
            for index, item in enumerate(page_data, start=i+1):
                if len(item) == 3:  # Format shop
                    shop_id, name, description = item
                    embed.add_field(
                        name=f"{index}. {name} (ID: {shop_id})",
                        value=f"📖 {description[:150] + '...' if len(description) > 150 else description}",
                        inline=False
                    )
                elif len(item) >= 5:  # Format item
                    item_id, name, price, description, stock = item[:5]
                    stock_display = "∞" if stock == -1 else str(stock)
                    embed.add_field(
                        name=f"{index}. {name} (ID: {item_id})",
                        value=f"💰 Prix: {price} pièces\n📖 {description[:150] + '...' if len(description) > 150 else description}\n📦 Stock: {stock_display}",
                        inline=False
                    )
            
            pages.append(embed)
        
        current_page = 0
        view = View(timeout=60)
        
        # Bouton Précédent
        previous_button = Button(
            style=discord.ButtonStyle.blurple,
            emoji="⬅️",
            disabled=True
        )
        
        # Bouton Suivant
        next_button = Button(
            style=discord.ButtonStyle.blurple,
            emoji="➡️",
            disabled=len(pages) <= 1
        )
        
        async def previous_callback(interaction):
            nonlocal current_page
            if interaction.user != ctx.author:
                return await interaction.response.send_message("Action non autorisée", ephemeral=True)
            current_page -= 1
            previous_button.disabled = current_page == 0
            next_button.disabled = current_page == len(pages) - 1
            await interaction.response.edit_message(embed=pages[current_page], view=view)
        
        async def next_callback(interaction):
            nonlocal current_page
            if interaction.user != ctx.author:
                return await interaction.response.send_message("Action non autorisée", ephemeral=True)
            current_page += 1
            previous_button.disabled = current_page == 0
            next_button.disabled = current_page == len(pages) - 1
            await interaction.response.edit_message(embed=pages[current_page], view=view)
        
        previous_button.callback = previous_callback
        next_button.callback = next_callback
        
        view.add_item(previous_button)
        view.add_item(next_button)
        
        message = await ctx.send(embed=pages[current_page], view=view)
        
        async def on_timeout():
            await message.edit(view=None)
        
        view.on_timeout = on_timeout
    
    @commands.command()
    async def shops(self, ctx):
        """Liste tous les shops"""
        shops = database.get_shops()
        await self.send_paginated(ctx, shops, "🏪 Liste des Shops", discord.Color.blue())

    @commands.command()
    async def shop(self, ctx, shop_id: int):
        """Affiche les items d'un shop"""
        items = database.get_shop_items(shop_id)
        await self.send_paginated(ctx, items, f"🛍️ Items du Shop {shop_id}", discord.Color.green())

    @commands.command()
    async def items_list(self, ctx):
        """[Admin] Liste complète de tous les items (triés par ID)"""
        if not ctx.author.guild_permissions.administrator:
            await ctx.send(embed=discord.Embed(
                title="❌ Permission refusée",
                description="Tu n'as pas la permission de consulter cette liste.",
                color=discord.Color.red()
            ))
            return

        items = database.get_all_items()
        await self.send_paginated(ctx, items, "📜 Tous les Items", discord.Color.blue(), sort_by_id=True)

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
        
        # Tri automatique par prix pour les items (si la structure contient un prix)
        if len(data) > 0 and len(data[0]) >= 5:  # Si ce sont des items (avec prix)
            data = sorted(data, key=lambda x: x[2])  # Tri par prix (x[2] = prix)
        
        pages = []
        for i in range(0, len(data), items_per_page):
            page_data = data[i:i + items_per_page]
            embed = discord.Embed(
                title=f"{title} - Tri par prix (Page {i//items_per_page + 1}/{(len(data)-1)//items_per_page + 1})", 
                color=color
            )
            
            for index, item in enumerate(page_data, start=i+1):  # Numérotation globale
                if len(item) == 3:  # Format shop
                    shop_id, name, description = item
                    embed.add_field(
                        name=f"{index}. {name} (ID: {shop_id})",
                        value=f"📖 {description[:150] + '...' if len(description) > 150 else description}",
                        inline=False
                    )
                elif len(item) >= 5:  # Format item
                    item_id, name, price, description, stock = item[:5]
                    stock_display = "∞" if stock == -1 else str(stock)
                    embed.add_field(
                        name=f"{index}. {name} (ID: {item_id})",
                        value=f"💰 Prix: {price} pièces\n📖 {description[:150] + '...' if len(description) > 150 else description}\n📦 Stock: {stock_display}",
                        inline=False
                    )
            
            pages.append(embed)
        
        current_page = 0
        message = await ctx.send(embed=pages[current_page])
        
        if len(pages) > 1:
            previous_button = Button(emoji="⬅️", style=discord.ButtonStyle.blurple)
            next_button = Button(emoji="➡️", style=discord.ButtonStyle.blurple)
            
            view = View(timeout=60)
            view.add_item(previous_button)
            view.add_item(next_button)
            
            await message.edit(view=view)
            
            async def button_callback(interaction):
                nonlocal current_page
                
                if interaction.user != ctx.author:
                    return await interaction.response.send_message("Seul l'auteur peut interagir.", ephemeral=True)
                
                if interaction.component == previous_button:
                    current_page = max(0, current_page - 1)
                elif interaction.component == next_button:
                    current_page = min(len(pages) - 1, current_page + 1)
                
                await interaction.response.edit_message(embed=pages[current_page], view=view)
            
            previous_button.callback = button_callback
            next_button.callback = button_callback
            
            async def on_timeout():
                await message.edit(view=None)
            
            view.on_timeout = on_timeout

    @commands.command()
    async def shops(self, ctx):
        """Liste tous les shops (non triés)"""
        shops = database.get_shops()
        await self.send_paginated(ctx, shops, "🏪 Liste des Shops", discord.Color.blue())

    @commands.command()
    async def shop(self, ctx, shop_id: int):
        """Affiche les items d'un shop (triés par prix)"""
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
        

    @commands.command()
    async def item_info(self, ctx, *, name: str):
        """Afficher les informations détaillées d’un item par son nom."""
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
