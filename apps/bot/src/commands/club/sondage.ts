import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('sondage')
  .setDescription('Sondages scientifiques et consultations internes CORTEX')
  .addSubcommand(sub =>
    sub.setName('creer')
      .setDescription('Créer un sondage avec réactions et choix multiples')
      .addStringOption(opt => opt.setName('question').setDescription('Question du sondage').setRequired(true))
      .addStringOption(opt => opt.setName('option1').setDescription('Option 1').setRequired(true))
      .addStringOption(opt => opt.setName('option2').setDescription('Option 2').setRequired(true))
      .addStringOption(opt => opt.setName('option3').setDescription('Option 3').setRequired(false))
      .addStringOption(opt => opt.setName('option4').setDescription('Option 4').setRequired(false))
      .addStringOption(opt => opt.setName('option5').setDescription('Option 5').setRequired(false))
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  if (!interaction.guild) return;
  const question = interaction.options.getString('question', true);
  const opt1 = interaction.options.getString('option1', true);
  const opt2 = interaction.options.getString('option2', true);
  const opt3 = interaction.options.getString('option3');
  const opt4 = interaction.options.getString('option4');
  const opt5 = interaction.options.getString('option5');

  const emojis = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣'];
  const options = [opt1, opt2];
  if (opt3) options.push(opt3);
  if (opt4) options.push(opt4);
  if (opt5) options.push(opt5);

  const desc = options.map((opt, i) => `${emojis[i]} **${opt}**`).join('\n\n');

  const embed = new EmbedBuilder()
    .setTitle(`📊 Consultation CORTEX — ${question}`)
    .setDescription(desc)
    .setColor(0xE5092E)
    .setFooter({ text: `Consultation initiée par ${interaction.user.tag} • Cliquez sur les réactions pour voter` })
    .setTimestamp();

  const reply = await interaction.reply({ embeds: [embed], fetchReply: true });

  for (let i = 0; i < options.length; i++) {
    await reply.react(emojis[i]!).catch(() => null);
  }
}
