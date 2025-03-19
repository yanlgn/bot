import discord
from discord.ext import commands

class Help(commands.Cog):
    def __init__(self, bot):
        self.bot = bot

    @commands.command()
    async def help(self, ctx):
        """Afficher l'aide pour toutes les commandes disponibles."""

        embed = discord.Embed(title="📚 Commandes Disponibles", description="Voici la liste des commandes disponibles :", color=discord.Color.blue())

        # Commandes de Shop
        embed.add_field(name="🏪 Shop", value="Affiche les commandes liées aux shops.", inline=False)
        embed.add_field(name="!shops", value="Affiche la liste de tous les shops.", inline=False)
        embed.add_field(name="!shop <shop_id>", value="Affiche les items d'un shop spécifique.", inline=False)
        embed.add_field(name="!acheter <shop_id> <item_id>", value="Acheter un item dans un shop.", inline=False)
        embed.add_field(name="!vendre <shop_id> <item_id>", value="Vendre un item dans un shop.", inline=False)

        # Commandes d'Inventaire
        embed.add_field(name="📦 Inventaire", value="Affiche les commandes liées à l'inventaire.", inline=False)
        embed.add_field(name="!inventaire", value="Affiche l'inventaire de l'utilisateur.", inline=False)

        # Commandes d'Economie
        embed.add_field(name="💰 Économie", value="Affiche les commandes liées à l'économie.", inline=False)
        embed.add_field(name="!solde", value="Affiche le solde de l'utilisateur.", inline=False)
        embed.add_field(name="!collect_salary", value="Permet de collecter le salaire en fonction des rôles de l'utilisateur.", inline=False)
        embed.add_field(name="!roles", value="Affiche les rôles et leurs salaires attribués.", inline=False)

        # Commandes Admin
        embed.add_field(name="🔧 Commandes Admin", value="Commandes réservées aux administrateurs.", inline=False)
        embed.add_field(name="!create_shop <nom>", value="Crée un shop (uniquement pour les admins).", inline=False)
        embed.add_field(name="!delete_shop <shop_id>", value="Supprime un shop (uniquement pour les admins).", inline=False)
        embed.add_field(name="!assign_salary <rôle> <salaire>", value="Attribue un salaire à un rôle (uniquement pour les admins).", inline=False)
        embed.add_field(name="!add_item <shop_id> <nom> <prix>", value="Ajoute un item à un shop (uniquement pour les admins).", inline=False)
        embed.add_field(name="!remove_item <shop_id> <item_id>", value="Supprime un item d'un shop (uniquement pour les admins).", inline=False)

        await ctx.send(embed=embed)

async def setup(bot):
    await bot.add_cog(Help(bot))
