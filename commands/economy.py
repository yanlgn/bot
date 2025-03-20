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
        await ctx.send(f"💰 Solde de {member.mention} : {balance} coins\n🏦 Dépôt bancaire : {deposit} coins")

    @commands.command(name="pay")
    async def pay(self, ctx, member: discord.Member, amount: int):
        """Permet de transférer des coins à un autre utilisateur."""
        if amount <= 0:
            return await ctx.send("Le montant doit être supérieur à zéro.")
        balance = database.get_balance(ctx.author.id)
        if balance < amount:
            return await ctx.send("Tu n'as pas assez d'argent.")
        database.update_balance(ctx.author.id, -amount)
        database.update_balance(member.id, amount)
        await ctx.send(f"✅ Tu as envoyé {amount} coins à {member.mention}.")

    @commands.command(name="deposit")
    async def deposit(self, ctx, amount: int):
        """Permet de déposer des coins à la banque."""
        if amount <= 0:
            return await ctx.send("Le montant doit être supérieur à zéro.")
        balance = database.get_balance(ctx.author.id)
        if balance < amount:
            return await ctx.send("Tu n'as pas assez d'argent.")
        database.update_balance(ctx.author.id, -amount)
        database.deposit(ctx.author.id, amount)
        await ctx.send(f"🏦 Tu as déposé {amount} coins à la banque.")

    @commands.command(name="set_salary")
    @commands.has_permissions(administrator=True)
    async def set_salary(self, ctx, role: discord.Role, salary: int, cooldown: int = 3600):
        """Attribue un salaire à un rôle (commande admin)."""
        if salary < 0:
            return await ctx.send("Le salaire doit être positif.")
        database.assign_role_salary(role.id, salary, cooldown)
        await ctx.send(f"✅ Le rôle {role.name} reçoit désormais {salary} coins toutes les {cooldown} secondes.")

    @commands.command(name="salary")
    async def collect_salary(self, ctx):
        """Collecte ton salaire basé sur tes rôles."""
        cooldown_remaining = database.get_salary_cooldown(ctx.author.id, [role.id for role in ctx.author.roles])
        if cooldown_remaining > 0:
            minutes, seconds = divmod(cooldown_remaining, 60)
            return await ctx.send(f"⏳ Tu dois attendre {minutes} minutes et {seconds} secondes avant de récupérer ton salaire.")
        total_salary = 0
        for role in ctx.author.roles:
            salary = database.get_role_salary(role.id)
            if salary > 0:
                total_salary += salary
        if total_salary == 0:
            return await ctx.send("Aucun de tes rôles n'a de salaire attribué.")
        database.update_balance(ctx.author.id, total_salary)
        database.set_salary_cooldown(ctx.author.id)
        await ctx.send(f"💵 Tu as collecté ton salaire : {total_salary} coins.")

async def setup(bot):
    await bot.add_cog(Economy(bot))
