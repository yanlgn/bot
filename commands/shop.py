import discord
from discord.ext import commands
import database

class Shop(commands.Cog):
    def __init__(self, bot):
        self.bot = bot

    @commands.command()
    async def shops(self, ctx):
        """Afficher la liste de tous les shops avec description."""
        shops = database.get_shops()
        if not shops:
            embed = discord.Embed(title="🏪 Shops", description="Aucun shop disponible.", color=discord.Color.red())
            await ctx.send(embed=embed)
            return

        embed = discord.Embed(title="🏪 Liste des Shops", color=discord.Color.blue())
        for shop_id, name, description in shops:
            embed.add_field(name=f"{name} (ID : {shop_id})", value=f"📖 {description}", inline=False)

        await ctx.send(embed=embed)

    @commands.command()
    async def shop(self, ctx, shop_id: int):
        """Afficher les items d'un shop spécifique avec leur description."""
        items = database.get_shop_items(shop_id)
        if not items:
            embed = discord.Embed(title="❌ Shop vide", description="Ce shop n’a pas d’items.", color=discord.Color.red())
            await ctx.send(embed=embed)
            return

        embed = discord.Embed(title=f"🛍️ Items du Shop {shop_id}", color=discord.Color.green())
        for item_id, name, price, description in items:
            embed.add_field(
                name=f"{name} (ID : {item_id})",
                value=f"💰 Prix : {price} pièces\n📖 {description}",
                inline=False
            )

        await ctx.send(embed=embed)

    @commands.command()
    async def create_shop(self, ctx, name: str, *, description: str):
        """Créer un shop avec description (admin uniquement)."""
        if not ctx.author.guild_permissions.administrator:
            await ctx.send(embed=discord.Embed(title="❌ Permission refusée", description="Tu n'as pas la permission de créer un shop.", color=discord.Color.red()))
            return

        shop_id = database.create_shop(name, description)
        if not shop_id:
            await ctx.send(embed=discord.Embed(title="❌ Erreur", description="Erreur lors de la création du shop.", color=discord.Color.red()))
            return

        embed = discord.Embed(title="🏪 Nouveau Shop créé", description=f"Nom : {name}\n📖 {description}\nID : {shop_id}", color=discord.Color.blue())
        await ctx.send(embed=embed)

    @commands.command()
    async def delete_shop(self, ctx, shop_id: int):
        """Supprimer un shop (admin uniquement)."""
        if not ctx.author.guild_permissions.administrator:
            await ctx.send(embed=discord.Embed(title="❌ Permission refusée", description="Tu n'as pas la permission de supprimer un shop.", color=discord.Color.red()))
            return

        success = database.delete_shop(shop_id)
        if success:
            await ctx.send(embed=discord.Embed(title="🗑️ Shop Supprimé", description=f"Le shop ID {shop_id} a été supprimé.", color=discord.Color.red()))
        else:
            await ctx.send(embed=discord.Embed(title="❌ Erreur", description="Le shop n'a pas pu être supprimé.", color=discord.Color.red()))

    @commands.command()
    async def add_item(self, ctx, shop_id: int, name: str, price: int, *, description: str):
        """Ajouter un item avec description à un shop (admin uniquement)."""
        if not ctx.author.guild_permissions.administrator:
            await ctx.send(embed=discord.Embed(title="❌ Permission refusée", description="Tu n'as pas la permission d'ajouter un item.", color=discord.Color.red()))
            return

        if price <= 0:
            await ctx.send(embed=discord.Embed(title="❌ Erreur", description="Le prix doit être supérieur à zéro.", color=discord.Color.red()))
            return

        item_id = database.add_item_to_shop(shop_id, name, price, description)
        embed = discord.Embed(title="🛍️ Nouvel Item ajouté", description=f"Item : {name}\nPrix : {price} pièces\n📖 {description}\nDans le shop ID {shop_id}", color=discord.Color.green())
        await ctx.send(embed=embed)

    @commands.command()
    async def remove_item(self, ctx, shop_id: int, item_id: int):
        """Supprimer un item d'un shop (admin uniquement)."""
        if not ctx.author.guild_permissions.administrator:
            await ctx.send(embed=discord.Embed(title="❌ Permission refusée", description="Tu n'as pas la permission de supprimer un item.", color=discord.Color.red()))
            return

        success = database.remove_item_from_shop(shop_id, item_id)
        if success:
            await ctx.send(embed=discord.Embed(title="🗑️ Item Supprimé", description=f"Item ID {item_id} supprimé du shop.", color=discord.Color.red()))
        else:
            await ctx.send(embed=discord.Embed(title="❌ Erreur", description="L'item n'a pas pu être supprimé.", color=discord.Color.red()))

    @commands.command()
    async def acheter(self, ctx, shop_id: int, item_id: int):
        """Acheter un item."""
        item = database.get_shop_item(shop_id, item_id)
        if not item:
            await ctx.send(embed=discord.Embed(title="❌ Item introuvable", description="Cet item n'existe pas.", color=discord.Color.red()))
            return

        item_name, price = item[1], item[2]
        user_balance = database.get_balance(ctx.author.id)

        if user_balance < price:
            await ctx.send(embed=discord.Embed(title="❌ Solde insuffisant", description="Tu n'as pas assez d'argent.", color=discord.Color.red()))
            return

        database.update_balance(ctx.author.id, -price)
        database.add_user_item(ctx.author.id, shop_id, item_id)
        await ctx.send(embed=discord.Embed(title="✅ Achat réussi", description=f"{ctx.author.mention} a acheté **{item_name}** pour **{price}** pièces.", color=discord.Color.green()))

    @commands.command()
    async def vendre(self, ctx, shop_id: int, item_id: int):
        """Vendre un item (80% du prix)."""
        item = database.get_shop_item(shop_id, item_id)
        if not item:
            await ctx.send(embed=discord.Embed(title="❌ Item introuvable", description="Cet item n'existe pas.", color=discord.Color.red()))
            return

        item_name, price = item[1], int(item[2] * 0.8)
        database.remove_user_item(ctx.author.id, shop_id, item_id)
        database.update_balance(ctx.author.id, price)
        await ctx.send(embed=discord.Embed(title="💰 Vente réussie", description=f"{ctx.author.mention} a vendu **{item_name}** pour **{price}** pièces.", color=discord.Color.blue()))

async def setup(bot):
    await bot.add_cog(Shop(bot))
