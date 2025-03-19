import discord
from discord.ext import commands
import database

class Shop(commands.Cog):
    def __init__(self, bot):
        self.bot = bot

    @commands.command()
    async def shops(self, ctx):
        """Afficher la liste de tous les shops."""
        shops = database.get_shops()
        if not shops:
            embed = discord.Embed(title="🏪 Shops", description="Aucun shop disponible.", color=discord.Color.red())
            await ctx.send(embed=embed)
            return

        embed = discord.Embed(title="🏪 Liste des Shops", color=discord.Color.blue())
        for shop_id, name in shops:
            embed.add_field(name=f"Shop {shop_id}", value=name, inline=False)

        await ctx.send(embed=embed)

    @commands.command()
    async def shop(self, ctx, shop_id: int):
        """Afficher les items d'un shop spécifique."""
        items = database.get_shop_items(shop_id)
        if not items:
            embed = discord.Embed(title="❌ Shop sans items", description="Ce shop n’a pas d’items.", color=discord.Color.red())
            await ctx.send(embed=embed)
            return

        embed = discord.Embed(title=f"🛍️ Items du Shop {shop_id}", color=discord.Color.green())
        for item_id, name, price in items:
            embed.add_field(name=name, value=f"💰 Prix : {price} pièces (ID : {item_id})", inline=False)

        await ctx.send(embed=embed)

    @commands.command()
    async def create_shop(self, ctx, name: str):
        """Créer un nouveau shop (uniquement pour les admins)."""
        if not ctx.author.guild_permissions.administrator:
            embed = discord.Embed(title="❌ Permission refusée", description="Tu n'as pas la permission de créer un shop.", color=discord.Color.red())
            await ctx.send(embed=embed)
            return

        shop_id = database.create_shop(name)
        if not shop_id:
            embed = discord.Embed(title="❌ Erreur", description="Une erreur est survenue lors de la création du shop.", color=discord.Color.red())
            await ctx.send(embed=embed)
            return

        embed = discord.Embed(title="🏪 Nouveau Shop", description=f"Le shop **{name}** a été créé avec l'ID : {shop_id}.", color=discord.Color.blue())
        await ctx.send(embed=embed)

    @commands.command()
    async def delete_shop(self, ctx, shop_id: int):
        """Supprimer un shop (uniquement pour les admins)."""
        if not ctx.author.guild_permissions.administrator:
            embed = discord.Embed(title="❌ Permission refusée", description="Tu n'as pas la permission de supprimer un shop.", color=discord.Color.red())
            await ctx.send(embed=embed)
            return

        success = database.delete_shop(shop_id)
        if success:
            embed = discord.Embed(title="🗑️ Shop Supprimé", description=f"Le shop avec l'ID {shop_id} a été supprimé.", color=discord.Color.red())
        else:
            embed = discord.Embed(title="❌ Erreur", description="Le shop n'a pas pu être supprimé.", color=discord.Color.red())
        await ctx.send(embed=embed)

    @commands.command()
    async def add_item(self, ctx, shop_id: int, name: str, price: int):
        """Ajouter un item à un shop (uniquement pour les admins)."""
        if not ctx.author.guild_permissions.administrator:
            embed = discord.Embed(title="❌ Permission refusée", description="Tu n'as pas la permission d'ajouter un item.", color=discord.Color.red())
            await ctx.send(embed=embed)
            return
        
        if price <= 0:
            embed = discord.Embed(title="❌ Erreur", description="Le prix doit être supérieur à zéro.", color=discord.Color.red())
            await ctx.send(embed=embed)
            return

        item_id = database.add_item_to_shop(shop_id, name, price)
        embed = discord.Embed(title="🛍️ Nouvel Item", description=f"L'item **{name}** a été ajouté au shop avec l'ID {shop_id}.", color=discord.Color.green())
        await ctx.send(embed=embed)

    @commands.command()
    async def remove_item(self, ctx, shop_id: int, item_id: int):
        """Supprimer un item d'un shop (uniquement pour les admins)."""
        if not ctx.author.guild_permissions.administrator:
            embed = discord.Embed(title="❌ Permission refusée", description="Tu n'as pas la permission de supprimer un item.", color=discord.Color.red())
            await ctx.send(embed=embed)
            return

        success = database.remove_item_from_shop(shop_id, item_id)
        if success:
            embed = discord.Embed(title="🗑️ Item Supprimé", description=f"L'item avec l'ID {item_id} a été supprimé du shop.", color=discord.Color.red())
        else:
            embed = discord.Embed(title="❌ Erreur", description="L'item n'a pas pu être supprimé.", color=discord.Color.red())
        await ctx.send(embed=embed)

    @commands.command()
    async def acheter(self, ctx, shop_id: int, item_id: int):
        """Acheter un item dans un shop."""
        item = database.get_shop_item(shop_id, item_id)
        if not item:
            embed = discord.Embed(title="❌ Item introuvable", description="Cet item n'existe pas.", color=discord.Color.red())
            await ctx.send(embed=embed)
            return

        item_name, price = item[1], item[2]
        user_balance = database.get_balance(ctx.author.id)

        if user_balance < price:
            embed = discord.Embed(title="❌ Solde insuffisant", description="Tu n'as pas assez d'argent.", color=discord.Color.red())
            await ctx.send(embed=embed)
            return

        database.update_balance(ctx.author.id, -price)
        database.add_user_item(ctx.author.id, shop_id, item_id)
        embed = discord.Embed(title="🛒 Achat réussi", description=f"{ctx.author.mention} a acheté **{item_name}** pour **{price}** pièces.", color=discord.Color.green())
        await ctx.send(embed=embed)

    @commands.command()
    async def vendre(self, ctx, shop_id: int, item_id: int):
        """Vendre un item dans un shop."""
        item = database.get_shop_item(shop_id, item_id)
        if not item:
            embed = discord.Embed(title="❌ Item introuvable", description="Cet item n'existe pas.", color=discord.Color.red())
            await ctx.send(embed=embed)
            return

        item_name, price = item[1], int(item[2] * 0.8)  # Vendre à 80% du prix initial
        database.remove_user_item(ctx.author.id, shop_id, item_id)
        database.update_balance(ctx.author.id, price)
        embed = discord.Embed(title="💰 Vente réussie", description=f"{ctx.author.mention} a vendu **{item_name}** pour **{price}** pièces.", color=discord.Color.blue())
        await ctx.send(embed=embed)

async def setup(bot):
    await bot.add_cog(Shop(bot))
