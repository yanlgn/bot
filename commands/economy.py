import discord
from discord.ext import commands
import database

class Economy(commands.Cog):
    def __init__(self, bot):
        self.bot = bot

    @commands.command()
    async def solde(self, ctx):
        """Affiche le solde de l'utilisateur."""
        balance = database.get_balance(ctx.author.id)
        embed = discord.Embed(title="💰 Solde", description=f"{ctx.author.mention}, tu as **{balance}** pièces.", color=discord.Color.green())
        await ctx.send(embed=embed)

    @commands.command()
    async def collect_salary(self, ctx):
        """Collecter le salaire en fonction du rôle."""
        user_roles = ctx.author.roles
        salary = 0
        for role in user_roles:
            role_salary = database.get_role_salary(role.id)
            if role_salary:
                salary += role_salary

        if salary <= 0:
            embed = discord.Embed(title="❌ Aucun salaire", description="Tu n'as pas de salaire à collecter.", color=discord.Color.red())
            await ctx.send(embed=embed)
            return

        database.update_balance(ctx.author.id, salary)
        embed = discord.Embed(title="💼 Collecte de salaire", description=f"{ctx.author.mention} a collecté **{salary}** pièces de salaire.", color=discord.Color.green())
        await ctx.send(embed=embed)

    @commands.command()
    async def assign_salary(self, ctx, role: discord.Role, salary: int):
        """Attribuer un salaire à un rôle."""
        if salary < 0:
            await ctx.send("❌ Le salaire ne peut pas être négatif.")
            return
        database.assign_role_salary(role.id, salary)
        embed = discord.Embed(title="💼 Salaire attribué", description=f"Le salaire de **{role.name}** est maintenant de **{salary}** pièces.", color=discord.Color.blue())
        await ctx.send(embed=embed)

    @commands.command()
    async def roles(self, ctx):
        """Afficher les rôles et leurs salaires attribués."""
        roles_salaries = database.get_all_roles_salaries()
        if not roles_salaries:
            embed = discord.Embed(title="❌ Aucuns salaires attribués", description="Aucun salaire n'a été attribué aux rôles.", color=discord.Color.red())
            await ctx.send(embed=embed)
            return

        embed = discord.Embed(title="💼 Salaires des Rôles", color=discord.Color.blue())
        for role_id, salary in roles_salaries:
            role = discord.utils.get(ctx.guild.roles, id=role_id)
            if role:
                embed.add_field(name=role.name, value=f"Salaire : {salary} pièces", inline=False)

        await ctx.send(embed=embed)

async def setup(bot):
    await bot.add_cog(Economy(bot))
