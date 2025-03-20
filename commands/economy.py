import discord
from discord.ext import commands
import database

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

async def setup(bot):
    await bot.add_cog(Economy(bot))
