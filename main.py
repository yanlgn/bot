import discord
from discord.ext import commands
import os
import asyncio
from dotenv import load_dotenv
from flask import Flask
from threading import Thread

# Charger les variables d'environnement
load_dotenv(dotenv_path='token.env')
TOKEN = os.getenv('DISCORD_TOKEN')

# Configuration du bot avec les intents nécessaires
intents = discord.Intents.default()
intents.message_content = True  # Nécessaire pour les commandes
intents.members = True  # Pour les commandes avec mentions

bot = commands.Bot(
    command_prefix="!", 
    intents=intents,
    help_command=None
)

async def load_extensions():
    """Charge tous les cogs du dossier commands"""
    loaded = []
    failed = []
    
    for filename in os.listdir("./commands"):
        if filename.endswith(".py") and not filename.startswith("_"):
            try:
                await bot.load_extension(f"commands.{filename[:-3]}")
                loaded.append(filename)
            except Exception as e:
                failed.append((filename, str(e)))
    
    print("\n--- Chargement des extensions ---")
    for file in loaded:
        print(f"✅ {file}")
    
    for file, error in failed:
        print(f"❌ {file}: {error}")
    
    return len(loaded), len(failed)

@bot.event
async def on_ready():
    """Événement déclenché quand le bot est prêt"""
    print(f"\n✅ Connecté en tant que {bot.user} (ID: {bot.user.id})")
    print("----------------------------------")
    
    # Charge les extensions
    loaded, failed = await load_extensions()
    
    # Synchronise les commandes slash
    try:
        synced = await bot.tree.sync()
        print(f"\n🔵 {len(synced)} commandes slash synchronisées")
        
        # Affiche les commandes synchronisées pour debug
        for cmd in synced:
            print(f"- {cmd.name}")
    except Exception as e:
        print(f"\n❌ Erreur de synchronisation: {e}")
    
    print("\n🔵 Bot prêt à être utilisé")

@bot.command()
@commands.is_owner()
async def sync(ctx):
    """Commande owner pour synchroniser les commandes slash"""
    try:
        synced = await bot.tree.sync()
        await ctx.send(f"✅ {len(synced)} commandes synchronisées")
    except Exception as e:
        await ctx.send(f"❌ Erreur: {str(e)}")

def run_flask():
    """Lance le serveur Flask pour keep-alive"""
    app = Flask(__name__)
    
    @app.route('/')
    def home():
        return "Bot en ligne"
    
    app.run(host='0.0.0.0', port=8080)

if __name__ == "__main__":
    # Lancer Flask en production seulement
    if os.getenv('ENV', 'development') == 'production':
        Thread(target=run_flask).start()
        print("🔵 Serveur Flask démarré en mode production")
    
    # Lancer le bot
    try:
        print("\n🔵 Démarrage du bot...")
        bot.run(TOKEN)
    except discord.LoginFailure:
        print("❌ Erreur: Token Discord invalide")
    except Exception as e:
        print(f"❌ Erreur critique: {str(e)}")
