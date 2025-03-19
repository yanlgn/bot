import discord
from discord.ext import commands
import database

class Inventory(commands.Cog):
    def __init__(self, bot):
        self.bot = bot

    @commands.command()
    async def inventaire(self, ctx):
        """Affiche l'inventaire de l'utilisateur."""
        inventory = database.get_inventory(ctx.author.id)
        if not inventory:
            embed = discord.Embed(title="📦 Inventaire", description="Ton inventaire est vide.", color=discord.Color.orange())
            await ctx.send(embed=embed)
            return

        embed = discord.Embed(title=f"📦 Inventaire de {ctx.author.name}", color=discord.Color.gold())
        for item_name, quantity, shop_name in inventory:
            embed.add_field(name=item_name, value=f"Quantité : {quantity} (Shop: {shop_name})", inline=False)

        await ctx.send(embed=embed)

async def setup(bot):
    await bot.add_cog(Inventory(bot))
