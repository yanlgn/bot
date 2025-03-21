import discord
from discord.ext import commands
import database
import time

class Economy(commands.Cog):
    def __init__(self, bot):
        self.bot = bot

    @commands.command(name="balance")
    async def balance(self, ctx, member: discord.Member = None):
        """Affiche le solde d'un utilisateur."""
        member = member or ctx.author
        balance = database.get_balance(member.id)
        deposit = database.get_deposit(member.id)

        embed = discord.Embed(title=f"Solde de {member.display_name}", color=discord.Color.gold())
        embed.add_field(name="💰 Argent en poche", value=f"{balance} coins", inline=False)
        embed.add_field(name="🏦 En banque", value=f"{deposit} coins", inline=False)
        embed.set_thumbnail(url=member.avatar.url if member.avatar else discord.Embed.Empty)
        await ctx.send(embed=embed)

    @commands.command()
    async def deposit(self, ctx, amount: int):
        """Dépose de l'argent à la banque."""
        if amount <= 0:
            await ctx.send("❌ Montant invalide.")
            return
        if database.deposit(ctx.author.id, amount):
            embed = discord.Embed(description=f"✅ Tu as déposé {amount} pièces à la banque.", color=discord.Color.green())
            await ctx.send(embed=embed)
        else:
            await ctx.send("❌ Tu n'as pas assez d'argent dans ton portefeuille.")

    @commands.command()
    async def withdraw(self, ctx, amount: int):
        """Retire de l'argent de la banque."""
        if amount <= 0:
            await ctx.send("❌ Montant invalide.")
            return
        if database.withdraw(ctx.author.id, amount):
            embed = discord.Embed(description=f"✅ Tu as retiré {amount} pièces de la banque.", color=discord.Color.green())
            await ctx.send(embed=embed)
        else:
            await ctx.send("❌ Tu n'as pas assez d'argent à la banque.")

    @commands.command()
    async def pay(self, ctx, member: discord.Member, amount: int):
        """Paye un autre utilisateur."""
        if member == ctx.author:
            await ctx.send("❌ Tu ne peux pas te payer toi-même.")
            return
        if amount <= 0:
            await ctx.send("❌ Montant invalide.")
            return
        if database.pay(ctx.author.id, member.id, amount):
            embed = discord.Embed(description=f"✅ Tu as payé {amount} pièces à {member.display_name}.", color=discord.Color.green())
            await ctx.send(embed=embed)
        else:
            await ctx.send("❌ Tu n'as pas assez d'argent dans ton portefeuille.")

    @commands.command()
    @commands.has_permissions(administrator=True)
    async def setbalance(self, ctx, member: discord.Member, amount: int):
        """[ADMIN] Change le solde d'un utilisateur."""
        if amount < 0:
            await ctx.send("❌ Montant invalide.")
            return
        database.set_balance(member.id, amount)
        embed = discord.Embed(description=f"✅ Le solde de {member.display_name} a été mis à {amount} pièces.", color=discord.Color.red())
        await ctx.send(embed=embed)

    @commands.command()
    @commands.has_permissions(administrator=True)
    async def setsalary(self, ctx, role: discord.Role, salary: int, cooldown: int = 3600):
        """[ADMIN] Attribue un salaire à un rôle."""
        if salary <= 0:
            await ctx.send(embed=discord.Embed(
                title="❌ Erreur",
                description="Le salaire doit être supérieur à zéro.",
                color=discord.Color.red()
            ))
            return

        database.assign_role_salary(role.id, salary, cooldown)
        await ctx.send(embed=discord.Embed(
            title="✅ Salaire attribué",
            description=f"Le rôle **{role.name}** a maintenant un salaire de **{salary}** pièces toutes les **{cooldown // 3600} heures**.",
            color=discord.Color.green()
        ))

    @commands.command()
    @commands.has_permissions(administrator=True)
    async def removesalary(self, ctx, role: discord.Role):
        """[ADMIN] Supprime complètement le salaire d'un rôle."""
        database.remove_role_salary(role.id)
        await ctx.send(embed=discord.Embed(
            title="✅ Salaire supprimé",
            description=f"Le rôle **{role.name}** a été complètement supprimé de la liste des salaires.",
            color=discord.Color.green()
        ))

    @commands.command()
    @commands.has_permissions(administrator=True)
    async def editsalary(self, ctx, role: discord.Role, salary: int, cooldown: int):
        """[ADMIN] Modifie le salaire et le cooldown d'un rôle."""
        if salary < 0 or cooldown < 0:
            await ctx.send(embed=discord.Embed(
                title="❌ Erreur",
                description="Le salaire et le cooldown doivent être supérieurs ou égaux à zéro.",
                color=discord.Color.red()
            ))
            return

        database.assign_role_salary(role.id, salary, cooldown)
        await ctx.send(embed=discord.Embed(
            title="✅ Salaire modifié",
            description=f"Le rôle **{role.name}** a maintenant un salaire de **{salary}** pièces toutes les **{cooldown // 3600} heures**.",
            color=discord.Color.green()
        ))

    @commands.command()
    async def collect(self, ctx):
        """Collecte ton salaire en fonction de tes rôles."""
        user_roles = [role.id for role in ctx.author.roles]
        total_salary = 0
        eligible_roles = []  # Rôles éligibles (cooldown terminé)
        non_eligible_roles = []  # Rôles non éligibles (cooldown actif)

        # Récupérer le dernier moment de collecte
        conn = database.connect_db()
        cursor = conn.cursor()
        cursor.execute("SELECT last_collect FROM salary_cooldowns WHERE user_id = %s", (ctx.author.id,))
        last_collect_result = cursor.fetchone()
        last_collect = last_collect_result[0].timestamp() if last_collect_result else None

        # Parcourir chaque rôle pour calculer le salaire et le cooldown
        for role_id in user_roles:
            salary = database.get_role_salary(role_id)
            if salary > 0:  # Ignorer les rôles avec un salaire à 0
                # Récupérer le cooldown du rôle
                cursor.execute("SELECT cooldown FROM role_salaries WHERE role_id = %s", (role_id,))
                cooldown_result = cursor.fetchone()
                cooldown = cooldown_result[0] if cooldown_result else 3600  # Cooldown par défaut de 1 heure

                # Calculer le temps restant pour ce rôle
                if last_collect:
                    remaining_time = (last_collect + cooldown) - time.time()
                    remaining_time = max(0, remaining_time)  # Ne pas afficher de temps négatif
                else:
                    remaining_time = 0  # Pas de cooldown enregistré

                # Convertir le temps restant en heures, minutes et secondes
                hours = int(remaining_time // 3600)
                minutes = int((remaining_time % 3600) // 60)
                seconds = int(remaining_time % 60)

                # Ajouter les informations à la liste appropriée
                role = ctx.guild.get_role(role_id)
                if role:
                    if remaining_time <= 0:
                        eligible_roles.append(f"**{role.name}** : {salary} pièces")
                        total_salary += salary
                    else:
                        non_eligible_roles.append(
                            f"**{role.name}** : {salary} pièces (cooldown : {hours}h {minutes}m {seconds}s)"
                        )

        conn.close()

        # Si aucun rôle n'est éligible
        if not eligible_roles:
            embed = discord.Embed(
                title="❌ Aucun salaire disponible",
                description="Tu ne peux pas collecter de salaire pour le moment.\n\n" +
                            ("**Rôles avec cooldown actif :**\n" + "\n".join(non_eligible_roles) if non_eligible_roles else "Aucun rôle avec salaire attribué."),
                color=discord.Color.red()
            )
            await ctx.send(embed=embed)
            return

        # Mettre à jour le solde de l'utilisateur
        database.update_balance(ctx.author.id, total_salary)

        # Enregistrer le cooldown pour les rôles collectés
        database.set_salary_cooldown(ctx.author.id)

        # Envoyer un message de confirmation
        embed = discord.Embed(
            title="💰 Salaire collecté",
            description=f"Tu as collecté **{total_salary}** pièces.\n\n" +
                        "**Rôles éligibles :**\n" + "\n".join(eligible_roles) + "\n\n" +
                        ("**Rôles non éligibles :**\n" + "\n".join(non_eligible_roles) if non_eligible_roles else ""),
            color=discord.Color.green()
        )
        await ctx.send(embed=embed)

    @commands.command()
    @commands.has_permissions(administrator=True)
    async def salaries(self, ctx):
        """[ADMIN] Affiche la liste de tous les rôles ayant un salaire dans le serveur."""
        roles_salaries = database.get_all_roles_salaries()
        if not roles_salaries:
            await ctx.send(embed=discord.Embed(
                title="📜 Salaires des rôles",
                description="Aucun rôle n'a de salaire attribué.",
                color=discord.Color.orange()
            ))
            return

        embed = discord.Embed(title="📜 Salaires des rôles", color=discord.Color.blue())
        for role_id, salary, cooldown in roles_salaries:
            role = ctx.guild.get_role(role_id)
            if role:
                embed.add_field(
                    name=f"Rôle : {role.name}",
                    value=f"💰 Salaire : {salary} pièces\n⏳ Cooldown : {cooldown // 3600} heures",
                    inline=False
                )

        await ctx.send(embed=embed)

async def setup(bot):
    await bot.add_cog(Economy(bot))
