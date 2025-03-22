import discord
from discord.ext import commands
import database

class Inventory(commands.Cog):
    def __init__(self, bot):
        self.bot = bot

    @commands.command()
    async def inventaire(self, ctx):
        """Affiche l'inventaire de l'utilisateur."""
        try:
            # Récupère l'inventaire de l'utilisateur
            inventory = database.get_user_inventory(ctx.author.id)
            
            # Si l'inventaire est vide
            if not inventory:
                embed = discord.Embed(
                    title="📦 Inventaire",
                    description="Ton inventaire est vide.",
                    color=discord.Color.orange()
                )
                await ctx.send(embed=embed)
                return

            # Crée un embed pour afficher l'inventaire
            embed = discord.Embed(
                title=f"📦 Inventaire de {ctx.author.display_name}",
                color=discord.Color.gold()
            )
            
            # Ajoute chaque item à l'embed
            for item_name, quantity, shop_name in inventory:
                embed.add_field(
                    name=item_name,
                    value=f"Quantité : {quantity} (Shop: {shop_name})",
                    inline=False
                )

            # Envoie l'embed
            await ctx.send(embed=embed)
        except Exception as e:
            await ctx.send("❌ Une erreur s'est produite lors de l'affichage de l'inventaire.")

    @commands.command()
    @commands.has_permissions(administrator=True)
    async def additem(self, ctx, member: discord.Member, item_name: str, quantity: int = 1):
        """[ADMIN] Ajoute un item à l'inventaire d'un utilisateur."""
        try:
            # Vérifie que la quantité est valide
            if quantity <= 0:
                await ctx.send("❌ La quantité doit être supérieure à zéro.")
                return

            # Récupère les informations de l'item
            item_data = database.get_item_by_name(item_name)
            if not item_data:
                await ctx.send(f"❌ L'item **{item_name}** n'existe pas. Vérifie le nom de l'item.")
                return

            # Ajoute l'item à l'inventaire
            item_id, shop_id = item_data[0], item_data[4]  # item_id et shop_id
            database.add_user_item(member.id, shop_id, item_id, quantity)
            await ctx.send(f"✅ {quantity}x **{item_name}** ajouté à l'inventaire de {member.display_name}.")
        except Exception as e:
            await ctx.send("❌ Une erreur s'est produite lors de l'ajout de l'item.")

    @commands.command()
    @commands.has_permissions(administrator=True)
    async def removeitem(self, ctx, member: discord.Member, item_name: str, quantity: int = 1):
        """[ADMIN] Retire un item de l'inventaire d'un utilisateur."""
        try:
            # Vérifie que la quantité est valide
            if quantity <= 0:
                await ctx.send("❌ La quantité doit être supérieure à zéro.")
                return

            # Récupère les informations de l'item
            item_data = database.get_item_by_name(item_name)
            if not item_data:
                await ctx.send(f"❌ L'item **{item_name}** n'existe pas. Vérifie le nom de l'item.")
                return

            # Retire l'item de l'inventaire
            item_id, shop_id = item_data[0], item_data[4]  # item_id et shop_id
            database.remove_user_item(member.id, shop_id, item_id, quantity)
            await ctx.send(f"✅ {quantity}x **{item_name}** retiré de l'inventaire de {member.display_name}.")
        except Exception as e:
            await ctx.send("❌ Une erreur s'est produite lors de la suppression de l'item.")

async def setup(bot):
    await bot.add_cog(Inventory(bot))
