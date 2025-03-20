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

    @commands.command(name="pay")
    async def pay(self, ctx, member: discord.Member, amount: int):
        """Permet de transférer des coins à un autre utilisateur."""
        if amount <= 0:
            embed = discord.Embed(description="❌ Le montant doit être supérieur à zéro.", color=discord.Color.red())
            return await ctx.send(embed=embed)

        balance = database.get_balance(ctx.author.id)
        if balance < amount:
            embed = discord.Embed(description="❌ Tu n'as pas assez d'argent.", color=discord.Color.red())
            return await ctx.send(embed=embed)

        database.update_balance(ctx.author.id, -amount)
        database.update_balance(member.id, amount)

        embed = discord.Embed(
            description=f"✅ Tu as envoyé {amount} coins à {member.mention}.",
            color=discord.Color.green()
        )
        await ctx.send(embed=embed)

    @commands.command(name="deposit")
    async def deposit(self, ctx, amount: int):
        """Permet de déposer des coins à la banque."""
        if amount <= 0:
            embed = discord.Embed(description="❌ Le montant doit être supérieur à zéro.", color=discord.Color.red())
            return await ctx.send(embed=embed)

        balance = database.get_balance(ctx.author.id)
        if balance < amount:
            embed = discord.Embed(description="❌ Tu n'as pas assez d'argent.", color=discord.Color.red())
            return await ctx.send(embed=embed)

        database.update_balance(ctx.author.id, -amount)
        database.deposit(ctx.author.id, amount)

        embed = discord.Embed(
            description=f"🏦 Tu as déposé {amount} coins à la banque.",
            color=discord.Color.blue()
        )
        await ctx.send(embed=embed)

    @commands.command(name="set_salary")
    @commands.has_permissions(administrator=True)
    async def set_salary(self, ctx, role: discord.Role, salary: int, cooldown: int = 3600):
        """Attribue un salaire à un rôle (commande admin)."""
        if salary < 0:
            embed = discord.Embed(description="❌ Le salaire doit être positif.", color=discord.Color.red())
            return await ctx.send(embed=embed)

        database.assign_role_salary(role.id, salary, cooldown)
        embed = discord.Embed(
            description=f"✅ Le rôle **{role.name}** reçoit désormais {salary} coins toutes les {cooldown} secondes.",
            color=discord.Color.green()
        )
        await ctx.send(embed=embed)

    @commands.command(name="salary")
    async def collect_salary(self, ctx):
        """Collecte ton salaire basé sur tes rôles."""
        cooldown_remaining = database.get_salary_cooldown(ctx.author.id, [role.id for role in ctx.author.roles])
        if cooldown_remaining > 0:
            minutes, seconds = divmod(cooldown_remaining, 60)
            embed = discord.Embed(
                description=f"⏳ Tu dois attendre {minutes} minutes et {seconds} secondes avant de récupérer ton salaire.",
                color=discord.Color.orange()
            )
            return await ctx.send(embed=embed)

        total_salary = 0
        for role in ctx.author.roles:
            salary = database.get_role_salary(role.id)
            if salary > 0:
                total_salary += salary

        if total_salary == 0:
            embed = discord.Embed(description="❌ Aucun de tes rôles n'a de salaire attribué.", color=discord.Color.red())
            return await ctx.send(embed=embed)

        database.update_balance(ctx.author.id, total_salary)
        database.set_salary_cooldown(ctx.author.id)

        embed = discord.Embed(
            description=f"💵 Tu as collecté ton salaire : {total_salary} coins.",
            color=discord.Color.green()
        )
        await ctx.send(embed=embed)

async def setup(bot):
    await bot.add_cog(Economy(bot))
