import discord
from discord.ext import commands
import database

class Inventory(commands.Cog):
    def __init__(self, bot):
        self.bot = bot

    @commands.command()
@commands.command()
async def inventaire(self, ctx):
    """Affiche l'inventaire de l'utilisateur."""
    inventory = database.get_user_inventory(ctx.author.id)
    if not inventory:
        embed = discord.Embed(title="📦 Inventaire", description="Ton inventaire est vide.", color=discord.Color.orange())
        await ctx.send(embed=embed)
        return

    embed = discord.Embed(title=f"📦 Inventaire de {ctx.author.name}", color=discord.Color.gold())
    for item_name, quantity, shop_name in inventory:
        embed.add_field(name=item_name, value=f"Quantité : {quantity} (Shop: {shop_name})", inline=False)

    await ctx.send(embed=embed)

    @commands.command()
    @commands.has_permissions(administrator=True)
    async def additem(self, ctx, member: discord.Member, item_name: str, quantity: int = 1):
        """[ADMIN] Ajoute un item à l'inventaire d'un utilisateur par nom d'item."""
        item_data = database.get_item_by_name(item_name)
        if not item_data:
            await ctx.send(f"❌ L'item **{item_name}** n'existe pas.")
            return

        shop_id, item_id = item_data
        database.add_user_item(member.id, shop_id, item_id, quantity)
        await ctx.send(f"✅ {quantity}x **{item_name}** ajouté à l'inventaire de {member.display_name}.")

    @commands.command()
    @commands.has_permissions(administrator=True)
    async def removeitem(self, ctx, member: discord.Member, item_name: str, quantity: int = 1):
        """[ADMIN] Supprime un item de l'inventaire d'un utilisateur par nom d'item."""
        item_data = database.get_item_by_name(item_name)
        if not item_data:
            await ctx.send(f"❌ L'item **{item_name}** n'existe pas.")
            return

        shop_id, item_id = item_data
        database.remove_user_item(member.id, shop_id, item_id, quantity)
        await ctx.send(f"✅ {quantity}x **{item_name}** retiré de l'inventaire de {member.display_name}.")

async def setup(bot):
    await bot.add_cog(Inventory(bot))
