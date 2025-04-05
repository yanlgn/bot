import discord
from discord.ext import commands
import os
import asyncio
from dotenv import load_dotenv
from flask import Flask
from threading import Thread
import logging

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
PORT = int(os.getenv('PORT', 8080))  # Port par défaut pour Render

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

async def load_extensions():
    """Charge tous les cogs du dossier commands"""
    loaded = []
    failed = []
    
    for filename in os.listdir("./commands"):
        if filename.endswith(".py") and not filename.startswith("_"):
            try:
                await bot.load_extension(f"commands.{filename[:-3]}")
                loaded.append(filename[:-3])  # Retire l'extension .py
            except Exception as e:
                failed.append((filename[:-3], str(e)))
                logger.error(f"Erreur chargement {filename}: {e}")
    
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
    """Serveur web minimal pour keep-alive"""
    app = Flask(__name__)
    
    @app.route('/')
    def home():
        return "🤖 Bot Discord en ligne"
    
    @app.route('/health')
    def health():
        return "OK", 200
    
    app.run(host='0.0.0.0', port=PORT)

if __name__ == "__main__":
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
