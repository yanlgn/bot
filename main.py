import discord
from discord.ext import commands
import os
import asyncio
import database
from dotenv import load_dotenv
from flask import Flask
from threading import Thread

# Charger les variables d'environnement
load_dotenv(dotenv_path='token.env')
TOKEN = os.getenv('DISCORD_TOKEN')

# Configuration du bot avec les intents nécessaires
intents = discord.Intents.default()
intents.message_content = True  # Nécessaire pour les commandes
intents.members = True  # Si vous utilisez des commandes avec des membres

bot = commands.Bot(
    command_prefix="!", 
    intents=intents,
    help_command=None
)

async def load_extensions():
    """Charge tous les cogs du dossier commands"""
    for filename in os.listdir("./commands"):
        if filename.endswith(".py"):
            try:
                await bot.load_extension(f"commands.{filename[:-3]}")
                print(f"✅ Cog chargé: {filename}")
            except Exception as e:
                print(f"❌ Erreur avec {filename}: {str(e)}")

@bot.event
async def on_ready():
    """Événement déclenché quand le bot est prêt"""
    print(f"✅ Connecté en tant que {bot.user} (ID: {bot.user.id})")
    print("------")
    
    # Charge les extensions
    await load_extensions()
    
    # Synchronise les commandes slash
    try:
        synced = await bot.tree.sync()
        print(f"✅ {len(synced)} commandes slash synchronisées")
    except Exception as e:
        print(f"❌ Erreur de synchronisation: {e}")

# Serveur Flask pour keep-alive (uniquement en production)
if os.getenv('ENV') == 'production':
    app = Flask(__name__)
    
    @app.route('/')
    def home():
        return "Bot en ligne"
    
    def run():
        app.run(host='0.0.0.0', port=8080)
    
    def keep_alive():
        t = Thread(target=run)
        t.start()
    
    keep_alive()

# Lancer le bot
if __name__ == "__main__":
    try:
        bot.run(TOKEN)
    except Exception as e:
        print(f"❌ Erreur critique: {e}")
