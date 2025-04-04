import discord
from discord import app_commands
from discord.ext import commands
import database
import time

class Economy(commands.Cog):
    def __init__(self, bot):
        self.bot = bot
    
    @app_commands.command(name="balance", description="Affiche le solde d'un utilisateur")
    @app_commands.describe(membre="Le membre dont vous voulez voir le solde")
    async def balance(self, interaction: discord.Interaction, membre: discord.Member = None):
        """Affiche le solde d'un utilisateur."""
        member = membre or interaction.user
        balance = database.get_balance(member.id)
        deposit = database.get_deposit(member.id)

        embed = discord.Embed(title=f"Solde de {member.display_name}", color=discord.Color.gold())
        embed.add_field(name="💰 Argent en poche", value=f"{balance} coins", inline=False)
        embed.add_field(name="🏦 En banque", value=f"{deposit} coins", inline=False)
        embed.set_thumbnail(url=member.avatar.url if member.avatar else discord.Embed.Empty)
        await interaction.response.send_message(embed=embed)

    @app_commands.command(name="deposit", description="Dépose de l'argent à la banque")
    @app_commands.describe(montant="Le montant à déposer (nombre ou 'all' pour tout déposer)")
    async def deposit(self, interaction: discord.Interaction, montant: str):
        """Dépose de l'argent à la banque. Utilise 'all' pour tout déposer."""
        try:
            if montant.lower() == 'all':
                balance = database.get_balance(interaction.user.id)
                if balance <= 0:
                    embed = discord.Embed(
                        title="❌ Erreur",
                        description="Tu n'as pas d'argent à déposer.",
                        color=discord.Color.red()
                    )
                    await interaction.response.send_message(embed=embed)
                    return
                amount_to_deposit = balance
            else:
                amount_to_deposit = int(montant)
                if amount_to_deposit <= 0:
                    embed = discord.Embed(
                        title="❌ Erreur",
                        description="Montant invalide.",
                        color=discord.Color.red()
                    )
                    await interaction.response.send_message(embed=embed)
                    return

            if database.get_balance(interaction.user.id) < amount_to_deposit:
                embed = discord.Embed(
                    title="❌ Erreur",
                    description="Tu n'as pas assez d'argent dans ton portefeuille.",
                    color=discord.Color.red()
                )
                await interaction.response.send_message(embed=embed)
                return

            database.deposit(interaction.user.id, amount_to_deposit)
            embed = discord.Embed(
                title="✅ Dépôt réussi",
                description=f"Tu as déposé **{amount_to_deposit}** pièces à la banque.",
                color=discord.Color.green()
            )
            await interaction.response.send_message(embed=embed)
        except ValueError:
            embed = discord.Embed(
                title="❌ Erreur",
                description="Montant invalide. Utilise un nombre ou 'all' pour tout déposer.",
                color=discord.Color.red()
            )
            await interaction.response.send_message(embed=embed)

    @app_commands.command(name="withdraw", description="Retire de l'argent de la banque")
    @app_commands.describe(montant="Le montant à retirer (nombre ou 'all' pour tout retirer)")
    async def withdraw(self, interaction: discord.Interaction, montant: str):
        """Retire de l'argent de la banque. Utilise 'all' pour tout retirer."""
        try:
            if montant.lower() == 'all':
                deposit = database.get_deposit(interaction.user.id)
                if deposit <= 0:
                    embed = discord.Embed(
                        title="❌ Erreur",
                        description="Tu n'as pas d'argent à retirer.",
                        color=discord.Color.red()
                    )
                    await interaction.response.send_message(embed=embed)
                    return
                amount_to_withdraw = deposit
            else:
                amount_to_withdraw = int(montant)
                if amount_to_withdraw <= 0:
                    embed = discord.Embed(
                        title="❌ Erreur",
                        description="Montant invalide.",
                        color=discord.Color.red()
                    )
                    await interaction.response.send_message(embed=embed)
                    return

            if database.get_deposit(interaction.user.id) < amount_to_withdraw:
                embed = discord.Embed(
                    title="❌ Erreur",
                    description="Tu n'as pas assez d'argent à la banque.",
                    color=discord.Color.red()
                )
                await interaction.response.send_message(embed=embed)
                return

            database.withdraw(interaction.user.id, amount_to_withdraw)
            embed = discord.Embed(
                title="✅ Retrait réussi",
                description=f"Tu as retiré **{amount_to_withdraw}** pièces de la banque.",
                color=discord.Color.green()
            )
            await interaction.response.send_message(embed=embed)
        except ValueError:
            embed = discord.Embed(
                title="❌ Erreur",
                description="Montant invalide. Utilise un nombre ou 'all' pour tout retirer.",
                color=discord.Color.red()
            )
            await interaction.response.send_message(embed=embed)

    @app_commands.command(name="pay", description="Paye un autre utilisateur")
    @app_commands.describe(membre="Le membre à payer", montant="Le montant à payer")
    async def pay(self, interaction: discord.Interaction, membre: discord.Member, montant: int):
        """Paye un autre utilisateur."""
        if membre == interaction.user:
            embed = discord.Embed(
                title="❌ Erreur",
                description="Tu ne peux pas te payer toi-même.",
                color=discord.Color.red()
            )
            await interaction.response.send_message(embed=embed)
            return
        if montant <= 0:
            embed = discord.Embed(
                title="❌ Erreur",
                description="Montant invalide.",
                color=discord.Color.red()
            )
            await interaction.response.send_message(embed=embed)
            return
        if database.transfer_money(interaction.user.id, membre.id, montant):
            embed = discord.Embed(
                title="✅ Paiement réussi",
                description=f"Tu as payé **{montant}** pièces à {membre.display_name}.",
                color=discord.Color.green()
            )
            await interaction.response.send_message(embed=embed)
        else:
            embed = discord.Embed(
                title="❌ Erreur",
                description="Tu n'as pas assez d'argent dans ton portefeuille.",
                color=discord.Color.red()
            )
            await interaction.response.send_message(embed=embed)

    @app_commands.command(name="setbalance", description="[ADMIN] Change le solde d'un utilisateur")
    @app_commands.default_permissions(administrator=True)
    @app_commands.describe(membre="Le membre dont vous voulez modifier le solde", montant="Le nouveau solde")
    async def setbalance(self, interaction: discord.Interaction, membre: discord.Member, montant: int):
        """[ADMIN] Change le solde d'un utilisateur."""
        if montant < 0:
            embed = discord.Embed(
                title="❌ Erreur",
                description="Montant invalide.",
                color=discord.Color.red()
            )
            await interaction.response.send_message(embed=embed)
            return
        database.set_balance(membre.id, montant)
        embed = discord.Embed(
            title="✅ Solde mis à jour",
            description=f"Le solde de {membre.display_name} a été mis à **{montant}** pièces.",
            color=discord.Color.green()
        )
        await interaction.response.send_message(embed=embed)

    @app_commands.command(name="add_money", description="[ADMIN] Ajoute de l'argent à un utilisateur")
    @app_commands.default_permissions(administrator=True)
    @app_commands.describe(membre="Le membre à qui ajouter de l'argent", montant="Le montant à ajouter")
    async def add_money(self, interaction: discord.Interaction, membre: discord.Member, montant: int):
        """[ADMIN] Ajoute de l'argent à un utilisateur."""
        if montant <= 0:
            embed = discord.Embed(
                title="❌ Erreur",
                description="Montant invalide.",
                color=discord.Color.red()
            )
            await interaction.response.send_message(embed=embed)
            return
        try:
            database.add_money(membre.id, montant)
            embed = discord.Embed(
                title="✅ Argent ajouté",
                description=f"**{montant}** pièces ont été ajoutées à {membre.display_name}.",
                color=discord.Color.green()
            )
            await interaction.response.send_message(embed=embed)
        except Exception as e:
            embed = discord.Embed(
                title="❌ Erreur",
                description=f"Une erreur s'est produite : {str(e)}",
                color=discord.Color.red()
            )
            await interaction.response.send_message(embed=embed)

    @app_commands.command(name="remove_money", description="[ADMIN] Retire de l'argent à un utilisateur")
    @app_commands.default_permissions(administrator=True)
    @app_commands.describe(membre="Le membre à qui retirer de l'argent", montant="Le montant à retirer")
    async def remove_money(self, interaction: discord.Interaction, membre: discord.Member, montant: int):
        """[ADMIN] Retire de l'argent à un utilisateur."""
        if montant <= 0:
            embed = discord.Embed(
                title="❌ Erreur",
                description="Montant invalide.",
                color=discord.Color.red()
            )
            await interaction.response.send_message(embed=embed)
            return
        try:
            database.remove_money(membre.id, montant)
            embed = discord.Embed(
                title="✅ Argent retiré",
                description=f"**{montant}** pièces ont été retirées de {membre.display_name}.",
                color=discord.Color.green()
            )
            await interaction.response.send_message(embed=embed)
        except ValueError as e:
            embed = discord.Embed(
                title="❌ Erreur",
                description=str(e),
                color=discord.Color.red()
            )
            await interaction.response.send_message(embed=embed)
        except Exception as e:
            embed = discord.Embed(
                title="❌ Erreur",
                description=f"Une erreur s'est produite : {str(e)}",
                color=discord.Color.red()
            )
            await interaction.response.send_message(embed=embed)

    @app_commands.command(name="setsalary", description="[ADMIN] Attribue un salaire à un rôle")
    @app_commands.default_permissions(administrator=True)
    @app_commands.describe(role="Le rôle à qui attribuer un salaire", salaire="Le montant du salaire", cooldown="Le cooldown en secondes (par défaut 3600)")
    async def setsalary(self, interaction: discord.Interaction, role: discord.Role, salaire: int, cooldown: int = 3600):
        """[ADMIN] Attribue un salaire à un rôle."""
        if salaire <= 0:
            embed = discord.Embed(
                title="❌ Erreur",
                description="Le salaire doit être supérieur à zéro.",
                color=discord.Color.red()
            )
            await interaction.response.send_message(embed=embed)
            return

        database.assign_role_salary(role.id, salaire, cooldown)
        embed = discord.Embed(
            title="✅ Salaire attribué",
            description=f"Le rôle **{role.name}** a maintenant un salaire de **{salaire}** pièces toutes les **{cooldown // 3600} heures**.",
            color=discord.Color.green()
        )
        await interaction.response.send_message(embed=embed)

    @app_commands.command(name="removesalary", description="[ADMIN] Supprime complètement le salaire d'un rôle")
    @app_commands.default_permissions(administrator=True)
    @app_commands.describe(role="Le rôle dont vous voulez supprimer le salaire")
    async def removesalary(self, interaction: discord.Interaction, role: discord.Role):
        """[ADMIN] Supprime complètement le salaire d'un rôle."""
        database.remove_role_salary(role.id)
        embed = discord.Embed(
            title="✅ Salaire supprimé",
            description=f"Le rôle **{role.name}** a été complètement supprimé de la liste des salaires.",
            color=discord.Color.green()
        )
        await interaction.response.send_message(embed=embed)

    @app_commands.command(name="editsalary", description="[ADMIN] Modifie le salaire et le cooldown d'un rôle")
    @app_commands.default_permissions(administrator=True)
    @app_commands.describe(role="Le rôle à modifier", salaire="Le nouveau salaire", cooldown="Le nouveau cooldown en secondes")
    async def editsalary(self, interaction: discord.Interaction, role: discord.Role, salaire: int, cooldown: int):
        """[ADMIN] Modifie le salaire et le cooldown d'un rôle."""
        if salaire < 0 or cooldown < 0:
            embed = discord.Embed(
                title="❌ Erreur",
                description="Le salaire et le cooldown doivent être supérieurs ou égaux à zéro.",
                color=discord.Color.red()
            )
            await interaction.response.send_message(embed=embed)
            return

        database.assign_role_salary(role.id, salaire, cooldown)
        embed = discord.Embed(
            title="✅ Salaire modifié",
            description=f"Le rôle **{role.name}** a maintenant un salaire de **{salaire}** pièces toutes les **{cooldown // 3600} heures**.",
            color=discord.Color.green()
        )
        await interaction.response.send_message(embed=embed)

    @app_commands.command(name="collect", description="Collecte ton salaire en fonction de tes rôles")
    async def collect(self, interaction: discord.Interaction):
        """Collecte ton salaire en fonction de tes rôles."""
        user_roles = [role.id for role in interaction.user.roles]
        total_salary = 0
        eligible_roles = []
        non_eligible_roles = []

        conn = database.connect_db()
        cursor = conn.cursor()
        cursor.execute("SELECT last_collect FROM salary_cooldowns WHERE user_id = %s", (interaction.user.id,))
        last_collect_result = cursor.fetchone()
        last_collect = last_collect_result[0].timestamp() if last_collect_result else None

        for role_id in user_roles:
            salary = database.get_role_salary(role_id)
            if salary > 0:
                cursor.execute("SELECT cooldown FROM role_salaries WHERE role_id = %s", (role_id,))
                cooldown_result = cursor.fetchone()
                cooldown = cooldown_result[0] if cooldown_result else 3600

                if last_collect:
                    remaining_time = (last_collect + cooldown) - time.time()
                    remaining_time = max(0, remaining_time)
                else:
                    remaining_time = 0

                hours = int(remaining_time // 3600)
                minutes = int((remaining_time % 3600) // 60)
                seconds = int(remaining_time % 60)

                role = interaction.guild.get_role(role_id)
                if role:
                    if remaining_time <= 0:
                        eligible_roles.append(f"**{role.name}** : {salary} pièces")
                        total_salary += salary
                    else:
                        non_eligible_roles.append(
                            f"**{role.name}** : {salary} pièces (cooldown : {hours}h {minutes}m {seconds}s)"
                        )

        conn.close()

        if not eligible_roles:
            embed = discord.Embed(
                title="❌ Aucun salaire disponible",
                description="Tu ne peux pas collecter de salaire pour le moment.\n\n" +
                            ("**Rôles avec cooldown actif :**\n" + "\n".join(non_eligible_roles) if non_eligible_roles else "Aucun rôle avec salaire attribué."),
                color=discord.Color.red()
            )
            await interaction.response.send_message(embed=embed)
            return

        database.update_balance(interaction.user.id, total_salary)
        database.set_salary_cooldown(interaction.user.id)

        embed = discord.Embed(
            title="💰 Salaire collecté",
            description=f"Tu as collecté **{total_salary}** pièces.\n\n" +
                        "**Rôles éligibles :**\n" + "\n".join(eligible_roles) + "\n\n" +
                        ("**Rôles non éligibles :**\n" + "\n".join(non_eligible_roles) if non_eligible_roles else ""),
            color=discord.Color.green()
        )
        await interaction.response.send_message(embed=embed)

    @app_commands.command(name="salaries", description="[ADMIN] Affiche la liste de tous les rôles ayant un salaire")
    @app_commands.default_permissions(administrator=True)
    async def salaries(self, interaction: discord.Interaction):
        """[ADMIN] Affiche la liste de tous les rôles ayant un salaire dans le serveur."""
        roles_salaries = database.get_all_roles_salaries()
        if not roles_salaries:
            embed = discord.Embed(
                title="📜 Salaires des rôles",
                description="Aucun rôle n'a de salaire attribué.",
                color=discord.Color.orange()
            )
            await interaction.response.send_message(embed=embed)
            return

        embed = discord.Embed(title="📜 Salaires des rôles", color=discord.Color.blue())
        for role_id, salary, cooldown in roles_salaries:
            role = interaction.guild.get_role(role_id)
            if role:
                embed.add_field(
                    name=f"Rôle : {role.name}",
                    value=f"💰 Salaire : {salary} pièces\n⏳ Cooldown : {cooldown // 3600} heures",
                    inline=False
                )

        await interaction.response.send_message(embed=embed)

async def setup(bot):
    await bot.add_cog(Economy(bot))
