import discord
from discord import app_commands
from discord.ext import commands
import os
import sys
from pathlib import Path
from dotenv import load_dotenv
from threading import Thread
import logging

from web.server import create_app

# Configuration du logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s | %(levelname)s | %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)
logger = logging.getLogger(__name__)

# Charger les variables d'environnement
load_dotenv(dotenv_path='token.env')
TOKEN = os.getenv('DISCORD_TOKEN')
try:
    PORT = int(os.getenv('PORT', 8080))  # Port par défaut pour Render
except (TypeError, ValueError):
    PORT = 8080
    logger.warning("PORT invalide, utilisation du port 8080 par défaut")

# Configuration des intents
intents = discord.Intents.default()
intents.message_content = True
intents.members = True

bot = commands.Bot(
    command_prefix="!",
    intents=intents,
    help_command=None,
    activity=discord.Activity(
        type=discord.ActivityType.watching,
        name="vos commandes"
    )
)

COMMANDS_DIR = Path(__file__).resolve().parent / "commands"


async def load_extensions():
    """Charge tous les cogs du dossier commands"""
    loaded = []
    failed = []

    for path in sorted(COMMANDS_DIR.glob("*.py")):
        if path.name.startswith("_"):
            continue
        try:
            await bot.load_extension(f"commands.{path.stem}")
            loaded.append(path.stem)  # Retire l'extension .py
        except Exception as e:
            failed.append((path.stem, str(e)))
            logger.error(f"Erreur chargement {path.name}: {e}")

    logger.info(f"Extensions chargées: {len(loaded)}, échecs: {len(failed)}")
    return loaded, failed

@bot.event
async def on_ready():
    """Événement déclenché quand le bot est prêt"""
    logger.info(f"Connecté en tant que {bot.user} (ID: {bot.user.id})")
    
    loaded, failed = await load_extensions()
    
    # Synchronisation des commandes slash
    try:
        synced = await bot.tree.sync()
        logger.info(f"{len(synced)} commandes slash synchronisées")
    except Exception as e:
        logger.error(f"Erreur synchronisation: {e}")


@bot.tree.error
async def on_app_command_error(interaction: discord.Interaction, error: app_commands.AppCommandError):
    """Gestionnaire d'erreurs global pour les commandes slash."""
    if isinstance(error, app_commands.MissingPermissions):
        message = "Tu n'as pas la permission d'utiliser cette commande."
    elif isinstance(error, app_commands.CommandOnCooldown):
        message = f"Commande en cooldown. Réessaie dans {int(error.retry_after)}s."
    elif isinstance(error, app_commands.CheckFailure):
        message = "Tu n'as pas le droit d'utiliser cette commande."
    else:
        message = "Une erreur inattendue s'est produite. Réessaie dans quelques instants."

    logger.exception(
        "Erreur commande slash | commande=%s | user=%s",
        getattr(error, 'command', None),
        interaction.user.id,
    )

    try:
        if interaction.response.is_done():
            await interaction.followup.send(message, ephemeral=True)
        else:
            await interaction.response.send_message(message, ephemeral=True)
    except Exception:
        pass

@bot.command()
@commands.is_owner()
async def sync(ctx):
    """Commande owner pour synchroniser les commandes slash"""
    try:
        synced = await bot.tree.sync()
        await ctx.send(f"✅ {len(synced)} commandes synchronisées")
        logger.info(f"Sync manuel: {len(synced)} commandes")
    except Exception as e:
        await ctx.send(f"❌ Erreur: {str(e)}")
        logger.error(f"Erreur sync manuel: {e}")

def run_flask():
    """Serveur web : health-check + interface d'administration"""
    app = create_app(bot)
    app.run(host='0.0.0.0', port=PORT)

if __name__ == "__main__":
    if not TOKEN:
        logger.critical("Aucun token Discord trouvé (variable DISCORD_TOKEN). Vérifie le fichier token.env")
        sys.exit(1)

    # Démarrer Flask dans un thread séparé
    flask_thread = Thread(
        target=run_flask,
        daemon=True  # Le thread s'arrêtera quand le main thread s'arrête
    )
    flask_thread.start()
    logger.info(f"Serveur Flask démarré sur le port {PORT}")

    # Démarrer le bot
    try:
        logger.info("Démarrage du bot Discord...")
        bot.run(TOKEN)
    except discord.LoginFailure:
        logger.critical("Token Discord invalide")
    except Exception as e:
        logger.critical(f"Erreur critique: {e}")
    finally:
        logger.info("Arrêt du bot")
