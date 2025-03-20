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
        """Afficher les items d'un shop spécifique avec leur description et stock."""
        items = database.get_shop_items(shop_id)
        if not items:
            embed = discord.Embed(title="❌ Shop vide", description="Ce shop n’a pas d’items actifs.", color=discord.Color.red())
            await ctx.send(embed=embed)
            return

        embed = discord.Embed(title=f"🛍️ Items du Shop {shop_id}", color=discord.Color.green())
        for item_id, name, price, description, stock in items:
            stock_display = "∞" if stock == -1 else str(stock)
            embed.add_field(
                name=f"{name} (ID : {item_id})",
                value=f"💰 Prix : {price} pièces\n📖 {description}\n📦 Stock : {stock_display}",
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
    async def add_item(self, ctx, shop_id: int, name: str, price: int, stock: int = -1, *, description: str):
        """Ajouter un item avec description et stock (admin uniquement). Stock = -1 pour illimité."""
        if not ctx.author.guild_permissions.administrator:
            await ctx.send(embed=discord.Embed(title="❌ Permission refusée", description="Tu n'as pas la permission d'ajouter un item.", color=discord.Color.red()))
            return

        if price <= 0:
            await ctx.send(embed=discord.Embed(title="❌ Erreur", description="Le prix doit être supérieur à zéro.", color=discord.Color.red()))
            return

        item_id = database.add_item_to_shop(shop_id, name, price, description, stock)
        stock_display = "∞" if stock == -1 else str(stock)
        embed = discord.Embed(
            title="🛍️ Nouvel Item ajouté",
            description=f"Item : {name}\nPrix : {price} pièces\n📖 {description}\n📦 Stock : {stock_display}\nDans le shop ID {shop_id}",
            color=discord.Color.green()
        )
        await ctx.send(embed=embed)

    @commands.command()
    async def remove_item(self, ctx, item_id: int):
        """Supprimer un item du shop (admin uniquement)."""
        if not ctx.author.guild_permissions.administrator:
            await ctx.send(embed=discord.Embed(title="❌ Permission refusée", description="Tu n'as pas la permission de supprimer un item.", color=discord.Color.red()))
            return

        success = database.remove_item(item_id)
        if success:
            await ctx.send(embed=discord.Embed(title="🗑️ Item Supprimé", description=f"Item ID {item_id} supprimé (désactivé).", color=discord.Color.red()))
        else:
            await ctx.send(embed=discord.Embed(title="❌ Erreur", description="L'item n'a pas pu être supprimé.", color=discord.Color.red()))

    @commands.command()
@commands.command()
async def acheter(self, ctx, shop_id: int, item_name: str, quantity: int = 1):
    """Acheter un item par son nom."""
    # Récupérer l'item par son nom
    item = database.get_item_by_name(item_name)
    
    # Vérifier si l'item existe
    if not item:
        await ctx.send(embed=discord.Embed(
            title="❌ Item introuvable",
            description=f"Aucun item nommé **{item_name}** n'a été trouvé.",
            color=discord.Color.red()
        ))
        return

    # Extraire les informations de l'item
    item_id, name, price, description, stock, active = item

    # Vérifier si l'item est actif
    if active != 1:
        await ctx.send(embed=discord.Embed(
            title="❌ Item inactif",
            description=f"L'item **{name}** n'est pas disponible à l'achat.",
            color=discord.Color.red()
        ))
        return

    # Vérifier si le stock est suffisant
    if stock != -1 and stock < quantity:
        await ctx.send(embed=discord.Embed(
            title="❌ Stock insuffisant",
            description=f"Il ne reste que {stock} unités de **{name}**.",
            color=discord.Color.red()
        ))
        return

    # Calculer le coût total
    total_cost = price * quantity

    # Vérifier si l'utilisateur a assez d'argent
    user_balance = database.get_balance(ctx.author.id)
    if user_balance < total_cost:
        await ctx.send(embed=discord.Embed(
            title="❌ Solde insuffisant",
            description=f"Tu n'as pas assez d'argent pour acheter {quantity}x **{name}**.",
            color=discord.Color.red()
        ))
        return

    # Effectuer l'achat
    try:
        # Retirer l'argent de l'utilisateur
        database.update_balance(ctx.author.id, -total_cost)

        # Ajouter l'item à l'inventaire de l'utilisateur
        database.add_user_item(ctx.author.id, shop_id, item_id, quantity)

        # Décrémenter le stock si nécessaire
        if stock != -1:
            database.decrement_item_stock(shop_id, item_id)

        # Envoyer un message de confirmation
        await ctx.send(embed=discord.Embed(
            title="✅ Achat réussi",
            description=f"{ctx.author.mention} a acheté {quantity}x **{name}** pour **{total_cost}** pièces.",
            color=discord.Color.green()
        ))
    except Exception as e:
        # En cas d'erreur, annuler l'achat et informer l'utilisateur
        await ctx.send(embed=discord.Embed(
            title="❌ Erreur lors de l'achat",
            description=f"Une erreur s'est produite lors de l'achat de **{name}**. Veuillez réessayer.",
            color=discord.Color.red()
        ))
        print(f"Erreur lors de l'achat : {e}")
    @commands.command()
    async def vendre(self, ctx, shop_id: int, item_name: str, quantity: int = 1):
        """Vendre un item par son nom (80% du prix)."""
        # Récupérer l'item par son nom
        item = database.get_item_by_name(item_name)
        if not item:
            await ctx.send(embed=discord.Embed(title="❌ Item introuvable", description=f"Aucun item nommé **{item_name}**.", color=discord.Color.red()))
            return

        item_id, name, price = item[0], item[1], int(item[2] * 0.8)
        total_earned = price * quantity

        # Vérifier si l'utilisateur possède l'item en quantité suffisante
        inventory = database.get_user_inventory(ctx.author.id)
        user_has_item = any(i[0] == name and i[1] >= quantity for i in inventory)
        if not user_has_item:
            await ctx.send(embed=discord.Embed(title="❌ Quantité insuffisante", description=f"Tu ne possèdes pas {quantity}x **{name}**.", color=discord.Color.red()))
            return

        # Effectuer la vente
        database.remove_user_item(ctx.author.id, shop_id, item_id, quantity)
        database.update_balance(ctx.author.id, total_earned)
        await ctx.send(embed=discord.Embed(title="💰 Vente réussie", description=f"{ctx.author.mention} a vendu {quantity}x **{name}** pour **{total_earned}** pièces.", color=discord.Color.blue()))

    @commands.command()
    async def items_list(self, ctx):
        """[Admin uniquement] Liste complète de tous les items existants, actifs et inactifs."""
        if not ctx.author.guild_permissions.administrator:
            await ctx.send(embed=discord.Embed(title="❌ Permission refusée", description="Tu n'as pas la permission de consulter cette liste.", color=discord.Color.red()))
            return

        items = database.get_all_items()
        if not items:
            embed = discord.Embed(title="📜 Liste d'Items", description="Aucun item enregistré.", color=discord.Color.orange())
            await ctx.send(embed=embed)
            return

        embed = discord.Embed(title="📜 Tous les Items", color=discord.Color.blue())
        for item in items:
            status = "✅ Actif" if item[6] == 1 else "❌ Inactif"
            stock_display = "∞" if item[5] == -1 else str(item[5])
            embed.add_field(name=f"{item[1]} (ID {item[0]})", value=f"Prix : {item[2]} | Stock : {stock_display} | {status}", inline=False)

        await ctx.send(embed=embed)

    @commands.command()
    async def item_info(self, ctx, *, name: str):
        """Afficher les informations détaillées d’un item par son nom."""
        item = database.get_item_by_name(name)
        if not item:
            await ctx.send(embed=discord.Embed(title="❌ Introuvable", description=f"Aucun item nommé **{name}**.", color=discord.Color.red()))
            return

        item_id, name, price, description, stock, active = item[0], item[1], item[2], item[3], item[5], item[6]
        status = "✅ Actif" if active == 1 else "❌ Inactif"
        stock_display = "∞" if stock == -1 else str(stock)

        embed = discord.Embed(title=f"🔎 Infos sur l'item : {name}", color=discord.Color.purple())
        embed.add_field(name="ID", value=f"{item_id}", inline=True)
        embed.add_field(name="Prix", value=f"{price} pièces", inline=True)
        embed.add_field(name="Stock", value=stock_display, inline=True)
        embed.add_field(name="État", value=status, inline=True)
        embed.add_field(name="Description", value=description, inline=False)

        await ctx.send(embed=embed)

    @commands.command()
    async def reactivate_item(self, ctx, item_id: int, stock: int = None):
        """[Admin uniquement] Réactiver un item inactif et réinitialiser son stock optionnellement."""
        if not ctx.author.guild_permissions.administrator:
            await ctx.send(embed=discord.Embed(title="❌ Permission refusée", description="Tu n'as pas la permission de réactiver un item.", color=discord.Color.red()))
            return

        item = database.get_item_by_id(item_id)
        if not item:
            await ctx.send(embed=discord.Embed(title="❌ Erreur", description=f"Aucun item trouvé avec l'ID {item_id}.", color=discord.Color.red()))
            return

        database.reactivate_item(item_id, stock)
        stock_msg = f"avec un stock de **{stock}**" if stock is not None else "sans modification de stock"
        embed = discord.Embed(title="✅ Item réactivé", description=f"L'item **{item[1]}** a été réactivé {stock_msg}.", color=discord.Color.green())
        await ctx.send(embed=embed)

async def setup(bot):
    await bot.add_cog(Shop(bot))
