import discord
from discord.ext import commands

class HelpDropdown(discord.ui.Select):
    def __init__(self):
        options = [
            discord.SelectOption(label="Économie", description="Commandes liées à l'argent et la banque"),
            discord.SelectOption(label="Inventaire", description="Commandes liées à l'inventaire"),
            discord.SelectOption(label="Boutique", description="Commandes liées aux shops"),
            discord.SelectOption(label="Admin", description="Commandes réservées aux administrateurs"),
        ]

        super().__init__(placeholder="Choisis une catégorie de commandes...", min_values=1, max_values=1, options=options)

    async def callback(self, interaction: discord.Interaction):
        category = self.values[0]
        if category == "Économie":
            embed = discord.Embed(title="💰 Commandes Économie", color=discord.Color.green())
            embed.add_field(name="!balance", value="Affiche ton solde.", inline=False)
            embed.add_field(name="!deposit <montant>", value="Dépose de l'argent à la banque.", inline=False)
            embed.add_field(name="!withdraw <montant>", value="Retire de l'argent de la banque.", inline=False)
            embed.add_field(name="!pay <@utilisateur> <montant>", value="Paye un autre utilisateur.", inline=False)

        elif category == "Inventaire":
            embed = discord.Embed(title="📦 Commandes Inventaire", color=discord.Color.orange())
            embed.add_field(name="!inventaire", value="Affiche ton inventaire.", inline=False)

        elif category == "Boutique":
            embed = discord.Embed(title="🛒 Commandes Boutique", color=discord.Color.blue())
            embed.add_field(name="!shop", value="Affiche la liste des shops.", inline=False)
            embed.add_field(name="!shop_items <shop_id>", value="Affiche les items du shop.", inline=False)
            embed.add_field(name="!buy <shop_id> <item_id>", value="Achète un item.", inline=False)

        elif category == "Admin":
            embed = discord.Embed(title="🛡️ Commandes Admin", color=discord.Color.red())
            embed.add_field(name="!additem <@membre> <item_name> <quantité>", value="Ajoute un item à l'inventaire d'un utilisateur.", inline=False)
            embed.add_field(name="!removeitem <@membre> <item_name> <quantité>", value="Retire un item de l'inventaire d'un utilisateur.", inline=False)
            embed.add_field(name="!createshop <nom> <description>", value="Crée un nouveau shop.", inline=False)
            embed.add_field(name="!addshopitem <shop_id> <nom> <prix> <description>", value="Ajoute un item au shop.", inline=False)
            embed.add_field(name="!removeshop <shop_id>", value="Supprime un shop.", inline=False)
            embed.add_field(name="!setbalance <@membre> <montant>", value="Change le solde d'un utilisateur.", inline=False)

        await interaction.response.edit_message(embed=embed, view=None)


class HelpView(discord.ui.View):
    def __init__(self):
        super().__init__()
        self.add_item(HelpDropdown())


class Help(commands.Cog):
    def __init__(self, bot):
        self.bot = bot

    @commands.command()
    async def help(self, ctx):
        embed = discord.Embed(
            title="📚 Menu d'aide",
            description="Sélectionne une catégorie dans le menu ci-dessous pour afficher les commandes associées.",
            color=discord.Color.purple()
        )
        await ctx.send(embed=embed, view=HelpView())

async def setup(bot):
    await bot.add_cog(Help(bot))
