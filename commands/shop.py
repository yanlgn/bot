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
        
        previous_button = Button(emoji="⬅️", style=discord.ButtonStyle.blurple, disabled=True)
        next_button = Button(emoji="➡️", style=discord.ButtonStyle.blurple)
        
        async def button_callback(interaction):
            nonlocal current_page
            
            if interaction.user != ctx.author:
                return await interaction.response.send_message("Seul l'auteur peut interagir.", ephemeral=True)
            
            if interaction.custom_id == "previous":
                current_page -= 1
            elif interaction.custom_id == "next":
                current_page += 1
            
            previous_button.disabled = current_page == 0
            next_button.disabled = current_page == len(pages) - 1
            
            await interaction.response.edit_message(
                embed=pages[current_page],
                view=view
            )
        
        previous_button.custom_id = "previous"
        next_button.custom_id = "next"
        previous_button.callback = button_callback
        next_button.callback = button_callback
        
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

    # ... (le reste de vos commandes inchangé) ...

async def setup(bot):
    await bot.add_cog(Shop(bot))
