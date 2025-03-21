import discord
from discord.ext import commands
import database
from datetime import datetime  # Ajoutez cette importation

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
    async def collect(self, ctx):
        """Collecte ton salaire en fonction de tes rôles."""
        user_roles = [role.id for role in ctx.author.roles]
        remaining_time = database.get_salary_cooldown(ctx.author.id, user_roles)

        if remaining_time > 0:
            await ctx.send(embed=discord.Embed(
                title="❌ Cooldown actif",
                description=f"Tu dois attendre encore **{remaining_time // 3600} heures** avant de pouvoir collecter à nouveau ton salaire.",
                color=discord.Color.red()
            ))
            return

        total_salary = 0
        for role_id in user_roles:
            salary = database.get_role_salary(role_id)
            if salary > 0:
                total_salary += salary

        if total_salary == 0:
            await ctx.send(embed=discord.Embed(
                title="❌ Aucun salaire disponible",
                description="Tu n'as aucun rôle avec un salaire attribué.",
                color=discord.Color.red()
            ))
            return

        database.update_balance(ctx.author.id, total_salary)
        # Convertir le timestamp Unix en un objet datetime avant de l'envoyer à la base de données
        last_collect = datetime.fromtimestamp(int(time.time()))
        database.set_salary_cooldown(ctx.author.id, last_collect)
        await ctx.send(embed=discord.Embed(
            title="💰 Salaire collecté",
            description=f"Tu as collecté **{total_salary}** pièces.",
            color=discord.Color.green()
        ))

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
