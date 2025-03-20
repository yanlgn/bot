import discord
from discord.ext import commands
import database

class Shop(commands.Cog):
    def __init__(self, bot):
        self.bot = bot

    @commands.command()
    @commands.has_permissions(administrator=True)
    async def addshop(self, ctx, name: str, description: str):
        database.add_shop(name, description)
        embed = discord.Embed(title="Shop ajouté ✅", description=f"Shop **{name}** ajouté avec succès.", color=discord.Color.green())
        embed.set_footer(text=f"Ajouté par {ctx.author}")
        await ctx.send(embed=embed)

    @commands.command()
    @commands.has_permissions(administrator=True)
    async def removeshop(self, ctx, shop_id: int):
        database.remove_shop(shop_id)
        embed = discord.Embed(title="Shop supprimé ✅", description=f"Le shop avec l'ID **{shop_id}** a été supprimé.", color=discord.Color.red())
        embed.set_footer(text=f"Supprimé par {ctx.author}")
        await ctx.send(embed=embed)

    @commands.command()
    @commands.has_permissions(administrator=True)
    async def additem(self, ctx, shop_id: int, name: str, price: int, description: str):
        shop = database.get_shop_by_id(shop_id)
        if not shop:
            await ctx.send(embed=discord.Embed(title="Erreur ❌", description="Shop introuvable.", color=discord.Color.red()))
            return

        database.add_item(shop_id, name, price, description)
        embed = discord.Embed(title="Item ajouté ✅", description=f"Item **{name}** ajouté au shop **{shop[1]}**.", color=discord.Color.green())
        embed.set_footer(text=f"Ajouté par {ctx.author}")
        await ctx.send(embed=embed)

    @commands.command()
    @commands.has_permissions(administrator=True)
    async def removeitem(self, ctx, item_id: int):
        database.remove_item(item_id)
        embed = discord.Embed(title="Item supprimé ✅", description=f"Item avec l'ID **{item_id}** supprimé.", color=discord.Color.red())
        embed.set_footer(text=f"Supprimé par {ctx.author}")
        await ctx.send(embed=embed)

    @commands.command()
    async def listshops(self, ctx):
        shops = database.get_all_shops()
        if not shops:
            await ctx.send(embed=discord.Embed(title="Aucun shop trouvé", description="Il n'existe actuellement aucun shop.", color=discord.Color.orange()))
            return

        embed = discord.Embed(title="Liste des shops", color=discord.Color.blue())
        for shop in shops:
            embed.add_field(name=f"{shop[1]} (ID: {shop[0]})", value=shop[2], inline=False)
        embed.set_footer(text=f"Demandé par {ctx.author}")
        await ctx.send(embed=embed)

    @commands.command()
    async def listitems(self, ctx, shop_id: int):
        shop = database.get_shop_by_id(shop_id)
        if not shop:
            await ctx.send(embed=discord.Embed(title="Erreur ❌", description="Shop introuvable.", color=discord.Color.red()))
            return

        items = database.get_items_by_shop(shop_id)
        if not items:
            await ctx.send(embed=discord.Embed(title="Shop vide", description=f"Le shop **{shop[1]}** n'a pas encore d'items.", color=discord.Color.orange()))
            return

        embed = discord.Embed(title=f"Items dans le shop : {shop[1]}", color=discord.Color.purple())
        for item in items:
            embed.add_field(name=f"{item[2]} (ID: {item[0]})", value=f"Prix: {item[3]} | {item[4]}", inline=False)
        embed.set_footer(text=f"Demandé par {ctx.author}")
        await ctx.send(embed=embed)

async def setup(bot):
    await bot.add_cog(Shop(bot))
