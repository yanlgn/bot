import discord
from discord import app_commands
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
            embed.add_field(name="/balance [membre]", value="Affiche le solde d'un utilisateur.", inline=False)
            embed.add_field(name="/deposit <montant|all>", value="Dépose de l'argent à la banque. Utilise 'all' pour tout déposer.", inline=False)
            embed.add_field(name="/withdraw <montant|all>", value="Retire de l'argent de la banque. Utilise 'all' pour tout retirer.", inline=False)
            embed.add_field(name="/pay <membre> <montant>", value="Paye un autre utilisateur.", inline=False)
            embed.add_field(name="/collect", value="Collecte ton salaire en fonction de tes rôles.", inline=False)

        elif category == "Inventaire":
            embed = discord.Embed(title="📦 Commandes Inventaire", color=discord.Color.orange())
            embed.add_field(name="/inventaire", value="Affiche ton inventaire.", inline=False)

        elif category == "Boutique":
            embed = discord.Embed(title="🛒 Commandes Boutique", color=discord.Color.blue())
            embed.add_field(name="/shops", value="Affiche la liste des shops.", inline=False)
            embed.add_field(name="/shop <shop_id>", value="Affiche les items d'un shop spécifique.", inline=False)
            embed.add_field(name="/acheter <shop_id> <nom_item> <quantité>", value="Achète un item par son nom.", inline=False)
            embed.add_field(name="/vendre <shop_id> <nom_item> <quantité>", value="Vend un item par son nom.", inline=False)
            embed.add_field(name="/item_info <nom_item>", value="Affiche les informations détaillées d'un item.", inline=False)

        elif category == "Admin":
            embed = discord.Embed(title="🛡️ Commandes Admin", color=discord.Color.red())
            embed.add_field(name="/setbalance <membre> <montant>", value="Change le solde d'un utilisateur.", inline=False)
            embed.add_field(name="/add_money <membre> <montant>", value="Ajoute de l'argent à un utilisateur.", inline=False)
            embed.add_field(name="/remove_money <membre> <montant>", value="Retire de l'argent à un utilisateur.", inline=False)
            embed.add_field(name="/additem <membre> <nom_item> <quantité>", value="Ajoute un item à l'inventaire d'un utilisateur.", inline=False)
            embed.add_field(name="/removeitem <membre> <nom_item> <quantité>", value="Retire un item de l'inventaire d'un utilisateur.", inline=False)
            embed.add_field(name="/setsalary <rôle> <salaire> <cooldown>", value="Attribue un salaire à un rôle.", inline=False)
            embed.add_field(name="/removesalary <rôle>", value="Supprime le salaire d'un rôle.", inline=False)
            embed.add_field(name="/editsalary <rôle> <salaire> <cooldown>", value="Modifie le salaire et le cooldown d'un rôle.", inline=False)
            embed.add_field(name="/salaries", value="Affiche la liste des rôles avec un salaire attribué.", inline=False)
            embed.add_field(name="/create_shop <nom> <description>", value="Crée un nouveau shop.", inline=False)
            embed.add_field(name="/delete_shop <shop_id>", value="Supprime un shop.", inline=False)
            embed.add_field(name="/add_item <shop_id> <nom> <prix> <stock> <description>", value="Ajoute un item à un shop.", inline=False)
            embed.add_field(name="/remove_item <item_id>", value="Supprime un item d'un shop.", inline=False)
            embed.add_field(name="/reactivate_item <item_id> <stock>", value="Réactive un item inactif.", inline=False)

        await interaction.response.edit_message(embed=embed, view=HelpView())

class HelpView(discord.ui.View):
    def __init__(self):
        super().__init__()
        self.add_item(HelpDropdown())

class Help(commands.Cog):
    def __init__(self, bot):
        self.bot = bot

    @app_commands.command(name="help", description="Affiche le menu d'aide avec toutes les commandes")
    async def help(self, interaction: discord.Interaction):
        embed = discord.Embed(
            title="📚 Menu d'aide",
            description="Sélectionne une catégorie dans le menu ci-dessous pour afficher les commandes associées.",
            color=discord.Color.purple()
        )
        await interaction.response.send_message(embed=embed, view=HelpView())

async def setup(bot):
    await bot.add_cog(Help(bot))
