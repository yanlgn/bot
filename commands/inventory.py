import discord
from discord import app_commands
from discord.ext import commands
import database

class Inventory(commands.Cog):
    def __init__(self, bot):
        self.bot = bot

    @app_commands.command(name="inventaire", description="Affiche ton inventaire")
    async def inventaire(self, interaction: discord.Interaction):
        """Affiche l'inventaire de l'utilisateur en utilisant une commande slash"""
        try:
            inventory = database.get_user_inventory(interaction.user.id)
            
            if not inventory:
                embed = discord.Embed(
                    title="📦 Inventaire",
                    description="Ton inventaire est vide.",
                    color=discord.Color.orange()
                )
                await interaction.response.send_message(embed=embed)
                return

            embed = discord.Embed(
                title=f"📦 Inventaire de {interaction.user.display_name}",
                color=discord.Color.gold()
            )
            
            for item in inventory:
                if len(item) == 3:
                    item_name, quantity, shop_name = item
                    embed.add_field(
                        name=item_name,
                        value=f"Quantité : {quantity} (Shop: {shop_name})",
                        inline=False
                    )
                else:
                    embed = discord.Embed(
                        title="❌ Erreur",
                        description="Une erreur s'est produite : format d'inventaire invalide.",
                        color=discord.Color.red()
                    )
                    await interaction.response.send_message(embed=embed)
                    return

            await interaction.response.send_message(embed=embed)
        except Exception as e:
            embed = discord.Embed(
                title="❌ Erreur",
                description=f"Une erreur s'est produite lors de l'affichage de l'inventaire : {str(e)}",
                color=discord.Color.red()
            )
            await interaction.response.send_message(embed=embed)

    @app_commands.command(name="additem", description="[ADMIN] Ajoute un item à l'inventaire d'un utilisateur")
    @app_commands.default_permissions(administrator=True)
    @app_commands.describe(
        member="Le membre à qui ajouter l'item",
        item_name="Le nom de l'item à ajouter",
        quantity="La quantité à ajouter (défaut: 1)"
    )
    async def additem(
        self, 
        interaction: discord.Interaction, 
        member: discord.Member,
        item_name: str,
        quantity: app_commands.Range[int, 1] = 1
    ):
        """Commande slash pour ajouter un item à l'inventaire"""
        try:
            item_data = database.get_item_by_name(item_name)
            if not item_data:
                embed = discord.Embed(
                    title="❌ Erreur",
                    description=f"L'item **{item_name}** n'existe pas. Vérifie le nom de l'item.",
                    color=discord.Color.red()
                )
                await interaction.response.send_message(embed=embed)
                return

            item_id = item_data[0]
            if not isinstance(item_id, int):
                embed = discord.Embed(
                    title="❌ Erreur",
                    description="L'ID de l'item est invalide.",
                    color=discord.Color.red()
                )
                await interaction.response.send_message(embed=embed)
                return

            item_details = database.get_item_by_id(item_id)
            if not item_details:
                embed = discord.Embed(
                    title="❌ Erreur",
                    description=f"Les détails de l'item **{item_name}** n'ont pas pu être récupérés.",
                    color=discord.Color.red()
                )
                await interaction.response.send_message(embed=embed)
                return

            shop_id = item_details[1]
            database.add_user_item(member.id, shop_id, item_id, quantity)
            embed = discord.Embed(
                title="✅ Item ajouté",
                description=f"{quantity}x **{item_name}** ont été ajoutés à l'inventaire de {member.mention}.",
                color=discord.Color.green()
            )
            await interaction.response.send_message(embed=embed)
        except Exception as e:
            embed = discord.Embed(
                title="❌ Erreur",
                description=f"Une erreur s'est produite lors de l'ajout de l'item : {str(e)}",
                color=discord.Color.red()
            )
            await interaction.response.send_message(embed=embed)

    @app_commands.command(name="removeitem", description="[ADMIN] Retire un item de l'inventaire d'un utilisateur")
    @app_commands.default_permissions(administrator=True)
    @app_commands.describe(
        member="Le membre à qui retirer l'item",
        item_name="Le nom de l'item à retirer",
        quantity="La quantité à retirer (défaut: 1)"
    )
    async def removeitem(
        self, 
        interaction: discord.Interaction, 
        member: discord.Member,
        item_name: str,
        quantity: app_commands.Range[int, 1] = 1
    ):
        """Commande slash pour retirer un item de l'inventaire"""
        try:
            item_data = database.get_item_by_name(item_name)
            if not item_data:
                embed = discord.Embed(
                    title="❌ Erreur",
                    description=f"L'item **{item_name}** n'existe pas. Vérifie le nom de l'item.",
                    color=discord.Color.red()
                )
                await interaction.response.send_message(embed=embed)
                return

            item_id = item_data[0]
            item_details = database.get_item_by_id(item_id)
            if not item_details:
                embed = discord.Embed(
                    title="❌ Erreur",
                    description=f"Les détails de l'item **{item_name}** n'ont pas pu être récupérés.",
                    color=discord.Color.red()
                )
                await interaction.response.send_message(embed=embed)
                return

            shop_id = item_details[1]
            database.remove_user_item(member.id, shop_id, item_id, quantity)
            embed = discord.Embed(
                title="✅ Item retiré",
                description=f"{quantity}x **{item_name}** ont été retirés de l'inventaire de {member.mention}.",
                color=discord.Color.green()
            )
            await interaction.response.send_message(embed=embed)
        except Exception as e:
            embed = discord.Embed(
                title="❌ Erreur",
                description=f"Une erreur s'est produite lors de la suppression de l'item : {str(e)}",
                color=discord.Color.red()
            )
            await interaction.response.send_message(embed=embed)

async def setup(bot):
    await bot.add_cog(Inventory(bot))
