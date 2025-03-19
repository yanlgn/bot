import discord
from discord.ext import commands
import os
import asyncio
import database
from dotenv import load_dotenv
from flask import Flask
from threading import Thread

# Charger les variables d'environnement depuis le fichier 'token.env'
load_dotenv(dotenv_path='token.env')

# Récupérer le token du bot depuis les variables d'environnement
TOKEN = os.getenv('DISCORD_TOKEN')

# Configuration du bot
intents = discord.Intents.default()
intents.message_content = True

bot = commands.Bot(command_prefix="!", intents=intents, help_command=None)


# Charger les commandes depuis le dossier "commands"
async def load_extensions():
    for filename in os.listdir("commands"):
        if filename.endswith(".py"):
            try:
                await bot.load_extension(f"commands.{filename[:-3]}")
                print(f"✅ {filename} chargé avec succès !")
            except Exception as e:
                print(f"❌ Erreur en chargeant {filename}: {e}")


@bot.event
async def on_ready():
    print(f"✅ {bot.user} est en ligne !")
    await load_extensions()


# --- Serveur Flask pour maintenir le bot en ligne ---
app = Flask(__name__)

@app.route('/')
def home():
    return "Le bot est en ligne !"

def run():
    app.run(host="0.0.0.0", port=8080)

def keep_alive():
    t = Thread(target=run)
    t.start()

# Lancer Flask avant le bot
if __name__ == "__main__":
    keep_alive()
    bot.run(TOKEN)
