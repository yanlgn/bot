import discord
from discord.ext import commands
import database
import asyncio

LOG_CHANNEL_ID = 123456789012345678  # Remplace par l'ID du canal où tu veux envoyer les logs

class Economy(commands.Cog):
    def __init__(self, bot):
        self.bot = bot

    async def send_log(self, message):
        channel = self.bot.get_channel(LOG_CHANNEL_ID)
        if channel:
            await channel.send(f"📜 {message}")

    @commands.command()
    async def solde(self, ctx):
        """Affiche le solde de l'utilisateur."""
        balance = database.get_balance(ctx.author.id)
        embed = discord.Embed(title="💰 Solde", description=f"{ctx.author.mention}, tu as **{balance}** pièces.", color=discord.Color.green())
        await ctx.send(embed=embed)

    @commands.command()
    async def depot(self, ctx, montant: int):
        """Déposer de l'argent dans la banque (épargne)."""
        if montant <= 0:
            await ctx.send("❌ Le montant doit être positif.")
            return
        balance = database.get_balance(ctx.author.id)
        if montant > balance:
            await ctx.send("❌ Tu n'as pas assez de pièces.")
            return
        database.update_balance(ctx.author.id, -montant)
        database.deposit(ctx.author.id, montant)
        await ctx.send(f"✅ {ctx.author.mention}, tu as déposé **{montant}** pièces dans ta banque.")
        await self.send_log(f"{ctx.author} a déposé {montant} pièces.")

    @commands.command()
    async def retrait(self, ctx, montant: int):
        """Retirer de l'argent de la banque (épargne)."""
        if montant <= 0:
            await ctx.send("❌ Le montant doit être positif.")
            return
        depot = database.get_deposit(ctx.author.id)
        if montant > depot:
            await ctx.send("❌ Tu n'as pas assez dans ta banque.")
            return
        database.deposit(ctx.author.id, -montant)
        database.update_balance(ctx.author.id, montant)
        await ctx.send(f"✅ {ctx.author.mention}, tu as retiré **{montant}** pièces de ta banque.")
        await self.send_log(f"{ctx.author} a retiré {montant} pièces de sa banque.")

    @commands.command()
    async def collect_salary(self, ctx):
        """Collecter le salaire selon le rôle avec cooldown."""
        user_roles = ctx.author.roles
        salary = 0
        for role in user_roles:
            role_salary = database.get_role_salary(role.id)
            if role_salary:
                salary += role_salary

        if salary <= 0:
            await ctx.send("❌ Tu n'as aucun salaire à collecter.")
            return

        # Vérification cooldown
        cooldown = database.get_salary_cooldown(ctx.author.id)
        if cooldown > 0:
            await ctx.send(f"⏳ Tu dois encore attendre {cooldown} secondes avant de pouvoir collecter ton salaire.")
            return

        database.update_balance(ctx.author.id, salary)
        database.set_salary_cooldown(ctx.author.id)
        await ctx.send(f"💼 {ctx.author.mention}, tu as collecté **{salary}** pièces.")
        await self.send_log(f"{ctx.author} a collecté son salaire de {salary} pièces.")

    @commands.command()
    @commands.has_permissions(administrator=True)
    async def assign_salary(self, ctx, role: discord.Role, salary: int, cooldown: int = 3600):
        """Attribuer un salaire à un rôle avec un cooldown en secondes."""
        if salary < 0:
            await ctx.send("❌ Le salaire ne peut pas être négatif.")
            return
        database.assign_role_salary(role.id, salary, cooldown)
        await ctx.send(f"✅ Le rôle **{role.name}** a maintenant un salaire de **{salary}** pièces toutes les **{cooldown}** secondes.")
        await self.send_log(f"{ctx.author} a défini un salaire de {salary} pièces toutes les {cooldown} secondes pour le rôle {role.name}.")

    @commands.command()
    async def roles(self, ctx):
        """Afficher les rôles et leurs salaires."""
        roles_salaries = database.get_all_roles_salaries()
        if not roles_salaries:
            await ctx.send("❌ Aucun salaire attribué aux rôles.")
            return

        embed = discord.Embed(title="💼 Salaires des rôles", color=discord.Color.blue())
        for role_id, salary, cooldown in roles_salaries:
            role = discord.utils.get(ctx.guild.roles, id=role_id)
            if role:
                embed.add_field(name=role.name, value=f"Salaire : {salary} pièces (cooldown : {cooldown}s)", inline=False)
        await ctx.send(embed=embed)

    @commands.command()
    @commands.has_permissions(administrator=True)
    async def setmoney(self, ctx, member: discord.Member, montant: int):
        """Définir directement le solde d'un utilisateur."""
        if montant < 0:
            await ctx.send("❌ Le montant ne peut pas être négatif.")
            return
        database.set_balance(member.id, montant)
        await ctx.send(f"✅ Le solde de {member.mention} a été défini à **{montant}** pièces.")
        await self.send_log(f"{ctx.author} a défini le solde de {member} à {montant} pièces.")

async def setup(bot):
    await bot.add_cog(Economy(bot))
